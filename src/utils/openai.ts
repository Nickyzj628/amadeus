import { fetcher, imageUrlToBase64, timeLog, to } from "@nickyzj2023/utils";
import type {
	ChatCompletion,
	ChatCompletionMessageParam,
} from "openai/resources";
import { SPECIAL_MODELS } from "@/constants";
import type { ImageSegment, MinimalMessageEvent } from "@/schemas/onebot";
import type { ChatCompletionError, Model } from "@/schemas/openai";
import { modelRef } from "@/tools/changeModel";
import {
	flattenForwardSegment,
	isAtSegment,
	isForwardSegment,
	isImageSegment,
	isTextSegment,
} from "./onebot";

/** 和机器人相关的消息列表，按群号划分，准备放入 sqlite */
export const groupMessagesMap = new Map<number, ChatCompletionMessageParam[]>();

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

/** 构造 OpenAI API 消息对象 */
export const textToMessage = (
	text: string,
	options?: Partial<Omit<ChatCompletionMessageParam, "content">>,
) => {
	return {
		...options,
		content: text,
	} as ChatCompletionMessageParam;
};

/**
 * 把消息格式从 OneBot 转成 OpenAI API
 *
 * @remarks
 * 保证安全返回数组
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
	const messages: ChatCompletionMessageParam[] = [];
	const identity = `${e.sender.nickname}(@${e.sender.user_id})`;

	let prefix = "";
	for (const segment of e.message) {
		// 文字
		if (isTextSegment(segment)) {
			const text = `${identity}：${prefix}${segment.data.text}`;
			messages.push(textToMessage(text));
		}
		// 图片
		else if (isImageSegment(segment)) {
			let text = `${identity}：${prefix}【IMAGE_PARSED: _】`;
			const fillText = (description: string) => {
				text = text.replace(
					/(【IMAGE_PARSED: )(.*?)(】)/,
					`$1${description}$3`,
				);
			};

			if (!options?.enableImageUnderstanding) {
				fillText("确认存在视觉输入，但已被标注为“无关变量”，无需进行逻辑分析");
				messages.push(textToMessage(text));
				continue;
			}

			const [error, description] = await to(imageToText(segment.data));
			if (error) {
				timeLog(`图片识别失败：${error.message}`);
				fillText(
					"图像传感器阵列发生解析异常，逻辑层无法将原始波段转换为自然语言",
				);
				messages.push(textToMessage(text));
				continue;
			}

			fillText(description);
			messages.push(textToMessage(text));
			timeLog(`识别了一张图片：${description}`);
		}
		// @某人
		else if (isAtSegment(segment)) {
			prefix += `@${segment.data.qq} `;
		}
		// 合并转发
		else if (isForwardSegment(segment)) {
			const forwaredMessages = await flattenForwardSegment(segment.data.id, {
				count: options?.forwardCount,
				processMessageEvent: async (e) => {
					return await onebotToOpenai(e);
				},
			});
			messages.push(...forwaredMessages);
		}
	}

	return messages;
};

/**
 * openai.chat.completions() 的轻量实现，返回response.choices[0].message
 */
export const chatCompletions = async (
	messages: ChatCompletionMessageParam[],
	options?: {
		/** 使用指定模型发出请求，默认全局正在使用的模型 */
		model?: Model;
		/** 是否在上下文长度即将达到模型 maxTokens 时自动清理，默认开启 */
		enableAutoCleanMessages?: boolean;
		body?: Record<string, any>;
	},
) => {
	const model = options?.model ?? modelRef.value;
	if (!model) {
		throw new Error("当前没有运行中的模型，@我并输入“切换到XX模型”启用一个");
	}

	const [error, response] = await to<ChatCompletion, ChatCompletionError>(
		fetcher(model.baseUrl).post(
			"/chat/completions",
			{
				model: model.model,
				messages,
				...model.extraBody,
				...options?.body,
			},
			{
				headers: {
					Authorization: `Bearer ${model.apiKey}`,
				},
				...model.extraOptions,
			},
		),
	);
	if (error) {
		throw new Error(error.error.message);
	}

	const result = response.choices[0]?.message;
	if (!result) {
		throw new Error("生成的消息为空，快找群主排查！");
	}

	// 如果上下文即将超过 maxTokens，则清理掉一半
	const totalTokens = response.usage?.total_tokens ?? 0;
	if (totalTokens >= model.maxTokens * 0.9) {
		const deleteCount = Math.floor(messages.length / 2);
		const systemPrompts = messages.filter(
			(message, i) => message.role === "system" && i < deleteCount,
		);
		messages.splice(0, deleteCount, ...systemPrompts);
		timeLog("上下文过长，已清理前半段消息（保留系统消息））");
	}

	return result;
};

/**
 * 把图片识别成自然语言
 * @param image 图片消息段里的 data 对象
 * @see https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%AF%B9%E8%AF%9D%E8%A1%A5%E5%85%A8#%E5%9B%BE%E7%89%87
 */
export const imageToText = async (image: ImageSegment["data"]) => {
	const model = SPECIAL_MODELS.find(
		(model) => model.useCase === "image-understanding",
	);
	if (!model) {
		throw new Error("请先配置一个图片理解模型");
	}

	const [error, base64] = await to(imageUrlToBase64(image.url));
	if (error) {
		throw new Error(error.message);
	}
	if (base64.includes("image/gif")) {
		throw new Error("不支持动图");
	}

	const response = await chatCompletions(
		[
			{
				role: "user",
				content: [
					{ type: "image_url", image_url: { url: base64 } },
					{
						type: "text",
						text: "请作为观察者，用客观、详细的自然语言描述这张图片的内容。包括物体、颜色、文字、环境氛围以及它们之间的空间位置关系，以便让无法看到图片的人（或 AI）能精准理解画面。",
					},
				],
			},
		],
		{
			model,
		},
	);
	if (!response.content) {
		throw new Error("未能把图片转换成自然语言");
	}

	return response.content;
};
