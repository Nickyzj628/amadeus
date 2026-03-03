import { createOpenAI, type OpenAIProviderSettings } from "@ai-sdk/openai";
import { log } from "@nickyzj2023/utils";
import type { LanguageModel } from "ai";
import { MODELS } from "@/constants.js";
import type { Model } from "@/schemas/openai.js";

// 当前活跃模型引用
export const modelRef: { value: Model | null } = { value: MODELS[0] ?? null };

/**
 * 根据模型配置创建 Vercel AI SDK 模型实例
 * 支持任何 OpenAI 兼容的 API（OpenRouter、iFlow、七牛云等）
 */
export function createModel(model?: Model): LanguageModel {
	const targetModel = model ?? modelRef.value;

	if (!targetModel) {
		throw new Error("当前没有运行中的模型，可以对我说“切换到XX模型”启用一个");
	}

	const config: OpenAIProviderSettings = {
		apiKey: targetModel.apiKey,
		baseURL: targetModel.baseUrl,
	};

	// 如果有额外选项（如代理），合并进去
	if (targetModel.extraOptions) {
		Object.assign(config, targetModel.extraOptions);
	}

	const provider = createOpenAI(config);

	log(`激活模型: ${targetModel.provider} (${targetModel.model})`);

	// 使用 .chat() 明确使用 Chat Completions API，而非默认的 Responses API
	return provider.chat(targetModel.model);
}

/**
 * 切换当前活跃模型
 */
export function switchModel(provider: string): string {
	const targetModel = MODELS.find((m) => m.provider === provider);
	if (!targetModel) {
		return "切换失败，模型不存在";
	}

	modelRef.value = targetModel;
	return `模型已切换至${targetModel.provider}（${targetModel.model}）`;
}
