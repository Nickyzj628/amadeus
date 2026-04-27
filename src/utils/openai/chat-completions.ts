import { fetcher, imageUrlToBase64, log } from "@nickyzj2023/utils";
import sharp from "sharp";
import config from "@/config.js";
import {
	IDENTITY_ANCHOR,
	IMAGE_UNDERSTANDING_PROMPT,
	MODELS,
} from "@/constants.js";
import type {
	ChatCompletions,
	ChatCompletionUsage,
	Message,
	Model,
} from "@/schemas/openai/index.js";
import { executeTool, openaiTools } from "@/tools/index.js";
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
	 * 单轮对话限制 `MAX_REQUEST_COUNT` 次请求，防止无限调用工具
	 */

	const api = fetcher(model.baseUrl, {
		headers: {
			Authorization: `Bearer ${model.apiKey}`,
		},
	});

	let content = "";
	let usage: ChatCompletionUsage | null = null;

	console.log();
	console.time("本轮对话耗时");
	for (let i = 0; i <= config.etc.maxRequestCount; i++) {
		console.log("请求大模型", model.model, messages.at(-1));

		// 如果超过请求次数限制，则在最后一条消息追加警告
		if (i === config.etc.maxRequestCount) {
			messages.at(-1)!.content +=
				"\n**注意：已达到单轮对话请求次数限制，请立即结束工具调用并输出最终结果。**";
		}

		const response = await api.post<ChatCompletions>("/chat/completions", {
			model: model.model,
			messages,
			tools: openaiTools,
			...model.extraBody,
		});
		const { message } = response.choices[0] ?? {};
		if (!message) {
			throw new Error("模型没有返回任何内容");
		}
		messages.push(message);
		console.log("大模型回复", message);

		// 如果无需调用工具，则完成本轮对话
		if (!Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
			content = message.content;
			usage = response.usage;
			break;
		}

		// 批量调用本轮对话所需工具
		const toolCallResults = await Promise.all(
			message.tool_calls.map(async (toolCall) => {
				// 暂不支持 function 以外的类型
				if (toolCall.type !== "function") {
					return "调用失败：暂不支持 function 以外的工具类型";
				}

				const { name, arguments: args } = toolCall.function;
				const result = await executeTool(name, JSON.parse(args));
				if (!result) {
					return "调用失败：工具返回了空结果";
				}
				// console.log(`调用了工具${name}(${args})`, result);
				return result;
			}),
		);

		// 推入工具调用结果
		messages.push(
			...toolCallResults.map((result, i) =>
				contentToMessage(result, {
					role: "tool",
					tool_call_id: message.tool_calls![i]!.id,
				}),
			),
		);
	}
	console.timeEnd("本轮对话耗时");
	console.log();

	return {
		content,
		isTokenNearLimit: usage!.total_tokens >= modelRef.value.totalContext * 0.8,
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
