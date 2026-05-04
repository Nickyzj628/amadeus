import { chatCompletions, imageUrlToBase64, log } from "@nickyzj2023/utils";
import sharp from "sharp";
import config from "@/config.js";
import {
	IDENTITY_ANCHOR,
	IMAGE_UNDERSTANDING_PROMPT,
	MODELS,
} from "@/constants.js";
import type { Message, Model } from "@/schemas/openai/index.js";
import { openaiTools, toolHandlers } from "@/tools/index.js";
import { contentToMessage, imageUrlToContentPart, modelRef } from "./index.js";

/**
 * 传入 OpenAI API 兼容的 messages 数组，返回大模型最终回复内容
 * @remarks 没有可用的模型/请求失败时会抛出异常
 */
export const generateContent = async (
	messages: Message[],
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

	console.time("本轮对话耗时");
	const { content, usage } = await chatCompletions(
		{
			baseURL: model.baseUrl,
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
	log(usage);
	console.timeEnd("本轮对话耗时");
	console.log();

	return {
		content,
		isTokenNearLimit: usage.total_tokens >= modelRef.value.totalContext * 0.8,
	};
};

/**
 * 根据当前模型能力，把图片转换成base64或自然语言
 * @remarks 可能抛出异常
 */
export const imageUrlToText = async (imageUrl: string) => {
	const currentModel = modelRef.value;
	if (!currentModel) {
		throw new Error("当前没有可用的图片理解模型，请完善配置文件");
	}

	// 如果当前是多模态模型，则使用 sharp 把图片转换为 base64 字符串
	if (currentModel.inputModalities?.includes("image")) {
		return imageUrlToBase64(imageUrl, {
			compressor: async (buffer, mime, _quality) => {
				const input = Buffer.from(buffer);
				const maxDimension = 1600; // 最大边长
				const targetSize = 300 * 1024; // 目标大小（KB）

				// 获取图片元数据
				const image = sharp(input);
				const metadata = await image.metadata();
				const width = metadata.width || 0;
				const height = metadata.height || 0;
				const maxSide = Math.max(width, height);

				// 如果已经小于目标大小，则直接返回
				if (input.length <= targetSize) {
					return `data:${mime};base64,${input.toString("base64")}`;
				}

				// 计算缩放后的尺寸
				const ratio = maxSide > maxDimension ? maxDimension / maxSide : 1;
				const resizeWidth = Math.floor(width * ratio);
				const resizeHeight = Math.floor(height * ratio);

				// 经验公式估算 quality：目标大小 / 原图大小 * 100，限制在 40-80 之间
				const estimatedQuality = Math.max(
					40,
					Math.min(80, Math.floor((targetSize / input.length) * 100)),
				);

				const compressed = await image
					.resize(resizeWidth, resizeHeight, { fit: "inside" })
					.jpeg({ quality: estimatedQuality, progressive: true })
					.toBuffer();

				log(
					`压缩了一张图片：${width}x${height}(${(input.length / 1024).toFixed(2)}KB) -> ${resizeWidth}x${resizeHeight}(${(compressed.length / 1024).toFixed(2)}KB)`,
				);
				return `data:image/jpeg;base64,${compressed.toString("base64")}`;
			},
		});
	}

	// 如果当前是纯文本模型，则使用其他多模态模型把图片翻译成自然语言
	const multiModel = MODELS.find((model) =>
		model.inputModalities?.includes("image"),
	);
	if (!multiModel) {
		throw new Error("当前模型不支持图片理解，且未配置多模态模型，无法识别图片");
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
