import {
	type ChatCompletions,
	chatCompletions,
	compactStr,
	defineModel,
	logger,
} from "@nickyzj2023/utils";
import { checkUrlType, normalizeText } from "@/common/util.js";
import config from "@/config.js";
import type { Model } from "@/openai/schemas/model.js";
import { openaiTools, toolHandlers } from "@/openai/tools/index.js";
import { findModelByModality, modelRef } from "@/openai/utils/model.js";
import { IDENTITY_ANCHOR, VISION_UNDERSTANDING_PROMPT } from "./constants.js";
import { contentToMessage, urlToContentPart } from "./convert.js";

/**
 * 传入 OpenAI API 兼容的 messages 数组，返回大模型最终回复内容
 * @remarks 没有可用的模型/请求失败时会抛出异常
 */
export const generateContent = async (
	messages: ChatCompletions.Message[],
	options?: {
		/** 默认使用当前模型发请求，可临时更改 */
		model?: Model;
		/** 自定义请求体，会覆盖原先存在的同名字段 */
		extraBody?: Record<string, any>;
	},
) => {
	const { model = modelRef.current, extraBody } = options ?? {};
	if (!model) {
		throw new Error("当前没有可用的模型，请完善配置文件");
	}
	const modelConfig = defineModel(model);

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

	const { reasoningContent, content, usage } = await chatCompletions(
		modelConfig,
		messages,
		{
			tools: openaiTools,
			toolHandlers,
			...model.extraBody,
			...extraBody,
		},
	);

	// 打印对话数据
	reasoningContent && logger("思考内容：", compactStr(reasoningContent));
	logger("回复内容：", compactStr(content));
	logger("本轮消耗：", usage, "\n");

	return {
		reasoningContent,
		content: normalizeText(content),
		usage,
	};
};

/**
 * 使用多模态模型，把视觉消息翻译成自然语言
 * @param url base64或公网可访问的URL
 * @throws 可能抛出异常
 */
export const visionToText = async (
	url: string,
	type: "image" | "video" | "audio" = "image",
) => {
	const urlType = checkUrlType(url);
	if (urlType !== "base64" && urlType !== "remote") {
		throw new Error(`不支持的URL：${url}`);
	}

	const multiModel = findModelByModality(type);
	if (!multiModel) {
		throw new Error(`未配置支持${type}的多模态模型，请完善/src/config.ts`);
	}

	const { content } = await generateContent(
		[
			contentToMessage([
				urlToContentPart(url, { type }),
				{ type: "text", text: VISION_UNDERSTANDING_PROMPT },
			]),
		],
		{ model: multiModel },
	);
	return content;
};
