import {
	type ChatCompletions,
	chatCompletions,
	compactStr,
	log,
} from "@nickyzj2023/utils";
import config from "@/config.js";
import {
	IDENTITY_ANCHOR,
	IMAGE_UNDERSTANDING_PROMPT,
	MODELS,
} from "@/constants.js";
import type { Model } from "@/openai/schemas/model.js";
import { openaiTools, toolHandlers } from "@/openai/tools/index.js";
import { modelRef } from "@/openai/utils/model.js";
import { contentToMessage, imageUrlToContentPart } from "./message.js";

/**
 * 传入 OpenAI API 兼容的 messages 数组，返回大模型最终回复内容
 * @remarks 没有可用的模型/请求失败时会抛出异常
 */
export const generateContent = async (
	messages: ChatCompletions.Message[],
	options?: {
		/** 默认使用当前模型发请求，可临时更改 */
		model?: Model;
	},
) => {
	const { model = modelRef.value } = options ?? {};
	if (!model) {
		throw new Error("当前没有可用的模型，请完善配置文件");
	}

	/**
	 * 巩固人设
	 * 如果最后一条用户发言包含安全词，则在其之前插入提示词
	 */

	let lastUserMessageIndex = messages.findLastIndex(
		(message) => message.role === "user",
	);

	const lastUserMessage = messages[lastUserMessageIndex];
	if (lastUserMessage?.content.toString().includes(config.etc.safeWord)) {
		messages.splice(lastUserMessageIndex, 0, {
			role: "system",
			content: IDENTITY_ANCHOR,
		});
		lastUserMessageIndex++;
	}

	/**
	 * 发出请求
	 */

	console.time("对话响应时间");
	const { reasoningContent, content, usage } = await chatCompletions(
		{
			baseUrl: model.baseUrl,
			apiKey: model.apiKey,
			model: model.model,
		},
		messages,
		{
			tools: openaiTools,
			toolHandlers,
			...model.extraBody,
		},
	);

	// 打印对话数据
	if (reasoningContent) {
		log(["思考内容", compactStr(reasoningContent)]);
	}
	log(["回复内容", compactStr(content)]);
	log(["本轮消耗", usage]);
	console.timeEnd("对话响应时间");
	console.log();

	return {
		content,
		isTokenNearLimit: usage.total_tokens >= modelRef.value.totalContext * 0.8,
	};
};

/**
 * 使用多模态模型，把图片翻译成自然语言
 * @remarks 可能抛出异常
 */
export const imageUrlToText = async (imageUrl: string) => {
	const currentModel = modelRef.value;
	if (!currentModel) {
		throw new Error("当前没有可用的模型，请完善配置文件");
	}

	const multiModel = MODELS.find((model) =>
		model.inputModalities?.includes("image"),
	);
	if (!multiModel) {
		throw new Error("未配置多模态模型，请完善配置文件");
	}

	const { content } = await generateContent(
		[
			contentToMessage(IMAGE_UNDERSTANDING_PROMPT, { role: "system" }),
			contentToMessage([imageUrlToContentPart(imageUrl)]),
		],
		{ model: multiModel },
	);
	return content;
};
