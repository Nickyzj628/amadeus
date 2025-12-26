import { fetcher, imageUrlToBase64, timeLog, to } from "@nickyzj2023/utils";
import { SPECIAL_MODELS } from "@/constants";
import { modelRef } from "@/function-calls/changeModel";
import type { ImageSegment } from "@/schemas/onebot";
import type {
	BaseChatCompletionMessage,
	OpenAIError,
	OpenAIResponse,
} from "@/schemas/openai";

/**
 * OpenAI.chat.completions() 的轻量实现，直接返回模型生成的文本
 */
export const chatCompletions = async (
	messages: BaseChatCompletionMessage[],
	options?: {
		/** 是否在上下文长度超过模型 maxTokens 时自动清理，默认开启 */
		enableAutoCleanMessages?: boolean;
	},
) => {
	const { value: model } = modelRef;
	if (!model) {
		throw new Error("当前没有运行中的模型，@我并输入“切换到XX模型”启用一个");
	}

	const [error, response] = await to<OpenAIResponse, OpenAIError>(
		fetcher(model.baseUrl).post(
			"/chat/completions",
			{
				model: model.model,
				messages,
				...model.extraBody,
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

	const { content } = response.choices[0]?.message ?? {};
	if (!content) {
		throw new Error("生成的消息为空，快找群主排查！");
	}

	// 如果当前对话上下文 token 超过最大限制，则保留一半
	const { total_tokens = 0 } = response.usage ?? {};
	if (total_tokens >= model.maxTokens) {
		const systemPrompts = messages.filter(
			(message) => message.role === "system",
		);

		messages.splice(0, Math.floor(messages.length / 2));
		if (systemPrompts.length > 0) {
			messages.unshift(...systemPrompts);
		}
		timeLog("上下文过长，已清理前半段消息");
	}

	return content;
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

	const [error, base64] = await to<
		string,
		{
			retcode: number;
			retmsg: string;
			retryflag: number;
		}
	>(imageUrlToBase64(image.url));
	if (error) {
		throw new Error(error.retmsg);
	}
	if (base64.includes("image/gif;base64")) {
		throw new Error("不支持动图");
	}

	const content = await chatCompletions(
		[
			{
				role: "user",
				content: [
					// {
					// 	type: "text",
					// 	text: IMAGE_UNDERSTANDING_PROMPT,
					// },
					{ type: "image_url", image_url: { url: base64 } },
				],
			},
		],
		model,
	);
	return content;
};
