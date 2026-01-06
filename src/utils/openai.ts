import {
	compactStr,
	fetcher,
	imageUrlToBase64,
	timeLog,
	to,
} from "@nickyzj2023/utils";
import type {
	ChatCompletion,
	ChatCompletionMessageParam,
} from "openai/resources";
import {
	ANCHOR_THRESHOLD,
	IDENTITY_ANCHOR,
	IMAGE_UNDERSTANDING_PROMPT,
	MAX_TOKEN_THRESHOLD,
	MODELS,
	SUMMARIZE_THRESHOLD,
} from "@/constants";
import type {
	ImageSegment,
	MinimalMessageEvent,
	Sender,
} from "@/schemas/onebot";
import type { ChatCompletionError, Model } from "@/schemas/openai";
import { modelRef } from "@/tools/changeModel";
import summarizeChat from "@/tools/summarizeChat";
import {
	flattenForwardSegment,
	getReplyMessage,
	isAtSegment,
	isForwardSegment,
	isImageSegment,
	isReplySegment,
	isTextSegment,
} from "./onebot";

/** 和机器人相关的消息列表，按群号划分，准备放入 sqlite */
export const groupMessagesMap = new Map<number, ChatCompletionMessageParam[]>();

export const pendingGroups: number[] = [];

/**
 * 根据群号读取消息数组（仅和机器人相关的）
 * @param groupId 群号
 * @param initialMessages 如果群里没有存放消息，则用它来作为初始消息
 */
export const readGroupMessages = (
	groupId: number,
	initialMessages: ChatCompletionMessageParam[] = [],
) => {
	const messages = groupMessagesMap.get(groupId);
	if (!Array.isArray(messages) || messages.length === 0) {
		groupMessagesMap.set(groupId, initialMessages);
		return initialMessages;
	}
	return messages;
};

/**
 * 构造 OpenAI API 消息对象
 * @remarks 通过泛型 K 捕获 role 的具体类型，从而精准推导剩余字段
 */
export const textToMessage = <K extends ChatCompletionMessageParam["role"]>(
	text: string,
	options?: {
		/** 修改消息对应的角色，默认 user */
		role?: K;
		/** 修改发送人信息，默认 user */
		sender?: Sender;
		/** 从外部篡改即将完成的消息 content 字段 */
		makeContent?: (content: string) => string;
		/** 禁止装饰 text 后，将不再携带 [FROM]、[BODY]、[CONTEXT_BLOCK] 等标签，默认不禁 */
		disableDecoration?: boolean;
	} & Partial<
		Omit<Extract<ChatCompletionMessageParam, { role: K }>, "content" | "role">
	>,
): ChatCompletionMessageParam => {
	const {
		role = "user" as K,
		sender,
		makeContent = (content: string) => content,
		disableDecoration = false,
		...restOptions
	} = options ?? {};

	const from = sender ? `${sender.nickname}(${sender.user_id})` : role;

	return {
		role,
		content: makeContent(
			disableDecoration ? text : `[FROM: ${from}][BODY: ${text}]`,
		),
		...restOptions,
	} as ChatCompletionMessageParam;
};

/**
 * 把消息格式从 OneBot 转成 OpenAI API
 * @remarks 保证安全返回消息对象
 */
export const onebotToOpenai = async (
	e: MinimalMessageEvent,
	options?: {
		/** 是否调用视觉模型，把图片翻译为自然语言 */
		enableImageUnderstanding?: boolean;
		/** 每条转发消息允许递归获取的消息数 */
		forwardCount?: number;
	},
) => {
	const { sender } = e;

	const contextBlockItems: string[] = [];
	const consumeContextBlock = () => {
		let content = "";
		if (contextBlockItems.length > 0) {
			content = compactStr(
				`[CONTEXT_BLOCK:\n${contextBlockItems.map((item) => `\t- ${item}`).join("\n")}]`,
			);
			contextBlockItems.length = 0;
		}
		return content;
	};

	// 解析消息段数组
	const contentItems: string[] = [];
	for (const segment of e.message) {
		// 文字
		if (isTextSegment(segment)) {
			contentItems.push(segment.data.text);
		}
		// 图片
		else if (isImageSegment(segment) && options?.enableImageUnderstanding) {
			const [error, description] = await to(imageToText(segment.data));
			if (error) {
				timeLog(`图片识别失败：${error.message}`);
				contentItems.push("[IMAGE_PARSED: 图片识别失败]");
			} else {
				contentItems.push(`[IMAGE_PARSED: ${description}]`);
			}
		}
		// @某人
		else if (isAtSegment(segment)) {
			contentItems.push(`@${segment.data.qq}`);
		}
		// 合并转发
		else if (isForwardSegment(segment)) {
			const forwardedMessages = await flattenForwardSegment(segment.data.id, {
				count: options?.forwardCount,
				processMessageEvent: onebotToOpenai,
			});
			contextBlockItems.push(
				...forwardedMessages.map((message) => message.content as string),
			);
		}
		// 回复
		else if (isReplySegment(segment)) {
			const e = await getReplyMessage(segment.data.id);
			if (e) {
				const flatRepliedMessage = await onebotToOpenai(e, options);
				contextBlockItems.push(flatRepliedMessage.content as string);
			}
		}
	}

	const content = contentItems.join(" ");
	return textToMessage(content, {
		sender,
		makeContent: (mixedContent) =>
			consumeContextBlock() + (content === "" ? "" : mixedContent),
	});
};

/** openai.chat.completions() 的替代实现，返回response.choices[0].message */
export const chatCompletions = async (
	messages: ChatCompletionMessageParam[],
	options?: {
		/** 使用指定模型发出请求，默认全局正在使用的模型 */
		model?: Model;
		body?: Record<string, any>;
		/**
		 * 是否自动优化上下文，默认开启。处理逻辑如下：
		 * 1. 超过 X 条消息时添加临时人设锚点
		 * 2. 超过 Y 条消息时滑动窗口总结一部分消息
		 * 3. 达到上下文窗口的 85% 时删除前半消息
		 */
		disableMessagesOptimization?: boolean;
	},
) => {
	const {
		model = modelRef.value,
		body: bodyFromParams = {},
		disableMessagesOptimization = false,
	} = options ?? {};

	if (!model) {
		throw new Error("当前没有运行中的模型，@我并输入“切换到XX模型”启用一个");
	}

	const wipMessages = [...messages];

	// 如果消息超过 X 条，则总结一部分消息，并替代原消息
	const needSummarize =
		!disableMessagesOptimization && wipMessages.length > SUMMARIZE_THRESHOLD;
	if (needSummarize) {
		const firstUserMessageIndex = wipMessages.findIndex(
			(message) => message.role === "user",
		);

		const count = SUMMARIZE_THRESHOLD * 0.5;
		const providedMessages = wipMessages.slice(
			firstUserMessageIndex,
			firstUserMessageIndex + count,
		);
		const summarized = await summarizeChat.handle({
			count,
			providedMessages,
		});

		wipMessages.splice(
			firstUserMessageIndex,
			count,
			textToMessage(`[MEMORANDUM] ${summarized}`, { role: "system" }),
		);
	}

	// 如果消息仍超过 Y 条，则添加临时人设锚点
	const needIdentityAnchor =
		!disableMessagesOptimization && wipMessages.length > ANCHOR_THRESHOLD;
	let anchorIndex = -1;
	if (needIdentityAnchor) {
		anchorIndex = wipMessages.findLastIndex(
			(message) => message.role === "user",
		);
		if (anchorIndex !== -1) {
			wipMessages.splice(
				anchorIndex,
				0,
				textToMessage(IDENTITY_ANCHOR, { role: "system" }),
			);
		}
	}

	// 发起请求
	const body = {
		model: model.model,
		messages: wipMessages,
		...model.extraBody,
		...bodyFromParams,
	};
	const requestInit = {
		headers: {
			Authorization: `Bearer ${model.apiKey}`,
		},
		...model.extraOptions,
	};
	const [error, response] = await to<ChatCompletion, ChatCompletionError[]>(
		fetcher(model.baseUrl).post("/chat/completions", body, requestInit),
	);
	if (error) {
		const errMessage = compactStr(JSON.stringify(error, null, 2));
		timeLog(`请求失败：${errMessage}`, body, requestInit);
		throw new Error(errMessage);
	}
	const result = response.choices[0]?.message;
	if (!result) {
		throw new Error("生成的消息为空，快找群主排查！");
	}

	// 如果启用了临时人设锚点，则在使用后移除
	if (anchorIndex !== -1) {
		wipMessages.splice(anchorIndex + 1, 1);
	}

	// 如果上下文即将达到 maxTokens，则清理掉一半
	const totalTokens = response.usage?.total_tokens ?? 0;
	if (totalTokens >= model.contextWindow * MAX_TOKEN_THRESHOLD) {
		const deleteCount = Math.floor(wipMessages.length / 2);
		// 保留系统消息
		const systemPrompts = wipMessages.filter(
			(message, i) => message.role === "system" && i < deleteCount,
		);
		wipMessages.splice(0, deleteCount, ...systemPrompts);
		timeLog("上下文过长，已清理前半段垃圾消息）");
	}

	// 同步 wipMessages 到原数组
	messages.length = 0;
	messages.push(...wipMessages);

	return result;
};

/**
 * 把图片识别成自然语言
 * @param image 图片消息段里的 data 对象
 * @see https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%AF%B9%E8%AF%9D%E8%A1%A5%E5%85%A8#%E5%9B%BE%E7%89%87
 */
export const imageToText = async (image: ImageSegment["data"]) => {
	const model = MODELS.find((model) =>
		model.useCases.includes("image-understanding"),
	);
	if (!model) {
		throw new Error("请先配置一个视觉理解模型");
	}

	const base64 = await imageUrlToBase64(image.url);
	if (base64.includes("image/gif")) {
		throw new Error("不支持动图");
	}

	const response = await chatCompletions(
		[
			{
				role: "user",
				content: [
					{ type: "image_url", image_url: { url: base64 } },
					{ type: "text", text: IMAGE_UNDERSTANDING_PROMPT },
				],
			},
		],
		{
			model,
		},
	);
	if (!response.content) {
		throw new Error("图片识别失败");
	}

	return response.content;
};
