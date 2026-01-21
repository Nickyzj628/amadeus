import {
	compactStr,
	fetcher,
	imageUrlToBase64,
	mergeObjects,
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
	MAX_ACTIVE_GROUPS,
	MODELS,
	SUMMARIZE_THRESHOLD,
} from "@/constants";
import type {
	ImageSegment,
	MinimalMessageEvent,
	Sender,
} from "@/schemas/onebot";
import type { Model } from "@/schemas/openai";
import { modelRef } from "@/tools/changeModel";
import summarizeChat from "@/tools/summarizeChat";
import { loadJSON, saveJSON } from "./common";
import {
	flattenForwardSegment,
	getGroupMessageHistory,
	getMessage,
	isAtSegment,
	isForwardSegment,
	isImageSegment,
	isReplySegment,
	isTextSegment,
} from "./onebot";

const groupMessagesMap = new Map<number, ChatCompletionMessageParam[]>();
export const pendingGroupIds: number[] = [];

/**
 * 根据群号读取消息数组
 * @param groupId 群号
 * @param initialMessages 如果群里没有存放消息，则用它来作为初始消息
 */
export const readGroupMessages = async (
	groupId: number,
	initialMessages: ChatCompletionMessageParam[] = [],
) => {
	// 如果内存中有该群的消息，则直接返回
	if (groupMessagesMap.has(groupId)) {
		return groupMessagesMap.get(groupId)!;
	}

	// 否则从文件读取群消息，并加入活跃群聊 Map
	const messages = await loadJSON(`/data/${groupId}.json`, {
		createWithDataIfNotExist: initialMessages,
	});
	groupMessagesMap.set(groupId, messages);

	// 优化：释放不活跃的群聊消息内存
	if (groupMessagesMap.size > MAX_ACTIVE_GROUPS) {
		for (const [groupId, messages] of groupMessagesMap) {
			if (!pendingGroupIds.includes(groupId)) {
				// 先存入本地 JSON 文件
				saveJSON(`/data/${groupId}.json`, messages)
					.then(() => {
						// 再释放内存，不阻塞当前函数
						groupMessagesMap.delete(groupId);
						timeLog(`释放了${groupId}的消息内存`);
					})
					.catch((e) => {
						timeLog(`释放${groupId}的消息内存失败：${e.message}`);
					});
				break;
			}
		}
	}

	return messages;
};

/** 根据群号保存消息数组 */
export const saveGroupMessages = async (
	groupId: number,
	messages: ChatCompletionMessageParam[],
	options?: {
		/** 是否在保存消息后释放内存 */
		disableGC?: boolean;
	},
) => {
	await saveJSON(`/data/${groupId}.json`, messages);
	if (!options?.disableGC) {
		groupMessagesMap.delete(groupId);
		timeLog(`释放了${groupId}的消息内存`);
	}
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
		/** 是否忽略回复的消息 */
		ignoreReply?: boolean;
		/** 是否忽略合并转发消息 */
		ignoreForward?: boolean;
		/** 每条转发消息允许递归获取的消息数 */
		forwardCount?: number;
		/** 是否补充上下文背景，推荐在主动发言时开启 */
		enableExtraContextBlock?: boolean;
	},
) => {
	const { sender } = e;

	const contextBlockItems: string[] = [];
	const consumeContextBlock = () => {
		let content = "";
		if (contextBlockItems.length > 0) {
			content = `[CONTEXT_BLOCK:\n${contextBlockItems.join("\n")}]`;
			contextBlockItems.length = 0;
		}
		return content;
	};

	// 如果启用了补充上下文背景，则从群历史消息中获取最近 2 条消息
	if (options?.enableExtraContextBlock && "group_id" in e) {
		const extraMessages = await getGroupMessageHistory(e.group_id as number, 3);
		for (const e of extraMessages.slice(0, -1)) {
			const message = await onebotToOpenai(e, {
				ignoreForward: true,
				ignoreReply: true,
			});
			contextBlockItems.push(message.content as string);
		}
	}

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
		else if (isForwardSegment(segment) && !options?.ignoreForward) {
			const forwardedMessages = await flattenForwardSegment(segment.data.id, {
				count: options?.forwardCount,
				processMessageEvent: onebotToOpenai,
			});
			contextBlockItems.push(
				...forwardedMessages.map((message) => message.content as string),
			);
		}
		// 回复
		else if (isReplySegment(segment) && !options?.ignoreReply) {
			const e = await getMessage(segment.data.id);
			if (e) {
				const flatRepliedMessage = await onebotToOpenai(e, options);
				contextBlockItems.push(flatRepliedMessage.content as string);
			}
		}
	}

	const content = contentItems.join(" ");
	const contextBlock = consumeContextBlock();
	return textToMessage(content, {
		sender,
		makeContent: (formattedContent) => {
			return [contextBlock, content && formattedContent]
				.filter(Boolean)
				.join("\n");
		},
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
		 * 3. 达到上下文窗口前删除前半消息
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

	// 如果消息超过 X 条，则在用户提问前添加临时人设锚点
	const anchorIndex = wipMessages.findLastIndex(
		(message) => message.role === "user",
	);
	const needIdentityAnchor =
		disableMessagesOptimization !== false &&
		wipMessages.length > ANCHOR_THRESHOLD &&
		anchorIndex !== -1;
	if (needIdentityAnchor) {
		const anchorMessage = textToMessage(IDENTITY_ANCHOR, {
			role: "system",
			disableDecoration: true,
		});
		wipMessages.splice(anchorIndex, 0, anchorMessage);
	}

	// 发起请求
	const body = {
		model: model.model,
		messages: wipMessages,
		...model.extraBody,
		...bodyFromParams,
	};
	const requestInit = mergeObjects(
		{
			headers: {
				Authorization: `Bearer ${model.apiKey}`,
			},
		},
		model.extraOptions ?? {},
	);

	const [error, response] = await to<ChatCompletion>(
		fetcher(model.baseUrl).post("/chat/completions", body, requestInit),
	);

	if (error) {
		const errMessage = compactStr(JSON.stringify(error, null, 2));
		timeLog(`请求失败：${errMessage}`);
		throw new Error(errMessage);
	}

	const result = response.choices[0]?.message;
	if (!result) {
		timeLog(`模型回复了空消息：${JSON.stringify(response, null, 2)}`);
		throw new Error("模型回复了空消息，快找群主排查！");
	}

	// 如果启用了临时人设锚点，则在消费后移除
	if (needIdentityAnchor) {
		wipMessages.splice(anchorIndex, 1);
	}

	// 如果消息超过 Y 条，则总结一部分消息
	const needSummarize =
		!disableMessagesOptimization && wipMessages.length > SUMMARIZE_THRESHOLD;
	if (needSummarize) {
		const firstUserMessageIndex = wipMessages.findIndex(
			(message) => message.role === "user",
		);

		const count = Math.floor(SUMMARIZE_THRESHOLD * 0.5);
		const summarizingMessages = wipMessages.slice(
			firstUserMessageIndex,
			firstUserMessageIndex + count,
		);
		const summarizedContent = await summarizeChat.handle({
			count,
			messages: summarizingMessages,
		});

		wipMessages.splice(
			firstUserMessageIndex,
			count,
			textToMessage(`[SUMMARIZED ${count} MESSAGES] ${summarizedContent}`, {
				role: "assistant",
				disableDecoration: true,
			}),
		);
	}

	// 如果即将到达上下文窗口，则清理前半（保留系统消息）（理论上永不触发）
	const totalTokens = response.usage?.total_tokens ?? 0;
	if (totalTokens > model.contextWindow * 0.8) {
		const deleteCount = Math.floor(wipMessages.length / 2);
		const systemPrompts = wipMessages.filter(
			(message, i) => i < deleteCount && message.role === "system",
		);
		wipMessages.splice(0, deleteCount, ...systemPrompts);
		timeLog("(上下文过长，已清理前半段非必要消息)");
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
		model.abilities.includes("vision-understanding"),
	);
	if (!model) {
		throw new Error("请先配置一个视觉理解模型");
	}

	const base64 = await imageUrlToBase64(image.url);
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
