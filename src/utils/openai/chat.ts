import { compactStr, fetcher, log, mergeObjects, to } from "@nickyzj2023/utils";
import type {
	ChatCompletion,
	ChatCompletionMessageParam,
} from "openai/resources";
import { ANCHOR_THRESHOLD, IDENTITY_ANCHOR, SAFE_WORD } from "@/constants.js";
import type { Model } from "@/schemas/openai.js";
import { modelRef } from "@/tools/changeModel.js";
import { contentToMessage } from "./message.js";

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
		throw new Error("当前没有运行中的模型，@我并输入「切换到XX模型」启用一个");
	}

	const wipMessages = [...messages];
	const getLastUserMessage = () => {
		const index = wipMessages.findLastIndex(
			(message) => message.role === "user",
		);
		const message = wipMessages[index];
		return [message, index] as const;
	};

	/**
	 * 如果消息中包含安全词，则在用户提问前添加永久人设锚点
	 */

	let [lastUserMessage, lastUserMessageIndex] = getLastUserMessage();

	if (
		lastUserMessage !== undefined &&
		typeof lastUserMessage.content === "string" &&
		lastUserMessage.content.includes(SAFE_WORD)
	) {
		const identityAnchorMessage = contentToMessage(IDENTITY_ANCHOR, {
			role: "system",
		});
		wipMessages.splice(lastUserMessageIndex, 0, identityAnchorMessage);
		lastUserMessage.content = lastUserMessage.content.replace(SAFE_WORD, "");
		lastUserMessageIndex++;
	}

	/**
	 * 如果消息超过 X 条，则在用户提问前添加临时人设锚点
	 */

	const needTempIdentityAnchor =
		disableMessagesOptimization !== false &&
		wipMessages.length > ANCHOR_THRESHOLD &&
		lastUserMessageIndex !== -1;

	if (needTempIdentityAnchor) {
		const anchorMessage = contentToMessage(IDENTITY_ANCHOR, {
			role: "system",
		});
		wipMessages.splice(lastUserMessageIndex, 0, anchorMessage);
	}

	/**
	 * 正式发出请求
	 */

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
		const errMessage = compactStr(JSON.stringify(error, null, 2), {
			disableNewLineReplace: true,
		});
		log(`请求失败：${errMessage}`);
		throw new Error(errMessage);
	}

	const result = response.choices[0]?.message;
	if (!result) {
		log(`模型回复了空消息：${JSON.stringify(response, null, 2)}`);
		throw new Error("模型回复了空消息，快找群主排查！");
	}

	// 如果启用了临时人设锚点，则在消费后移除
	if (needTempIdentityAnchor) {
		wipMessages.splice(lastUserMessageIndex, 1);
	}

	// 阅后即焚图片，防止图片过期导致模型请求报错
	// wipMessages = wipMessages.filter((message) => {
	// 	if (!Array.isArray(message.content)) {
	// 		return true;
	// 	}
	// 	return message.content.every((part) => part.type !== "image_url");
	// });

	/**
	 * 如果即将到达上下文窗口，则清理前半（保留系统消息）（理论上永不触发）
	 */

	// const totalTokens = response.usage?.total_tokens ?? 0;

	// if (totalTokens > model.contextWindow * 0.8) {
	// 	const deleteCount = Math.floor(wipMessages.length / 2);
	// 	const systemPrompts = wipMessages.filter(
	// 		(message, i) => i < deleteCount && message.role === "system",
	// 	);
	// 	wipMessages.splice(0, deleteCount, ...systemPrompts);
	// 	log("(上下文过长，已清理前半段非必要消息)");
	// }

	// 同步 wipMessages 回原数组
	messages.length = 0;
	messages.push(...wipMessages);

	return result;
};
