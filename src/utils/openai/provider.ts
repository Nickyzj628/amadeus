import { createOpenAI, type OpenAIProviderSettings } from "@ai-sdk/openai";
import { log } from "@nickyzj2023/utils";
import type { LanguageModel } from "ai";
import { MODELS } from "@/constants.js";
import type { Model } from "@/schemas/openai.js";

// 当前活跃模型配置和实例引用
export const modelRef: {
  config: Model | null;
  instance: LanguageModel | null;
} = {
  config: MODELS[0] ?? null,
  instance: null,
};

/**
 * 根据模型配置创建 Vercel AI SDK 模型实例
 * 支持任何 OpenAI 兼容的 API（OpenRouter、iFlow、七牛云等）
 *
 * 如果请求的模型与当前活跃模型一致，直接返回缓存的实例
 */
export function createModel(model?: Model): LanguageModel {
  const targetModel = model ?? modelRef.config;

  if (!targetModel) {
    throw new Error("当前没有运行中的模型，可以对我说“切换到XX模型”启用一个");
  }

  // 如果缓存的实例+配置相同，则复用
  if (
    modelRef.instance &&
    modelRef.config &&
    modelRef.config.provider === targetModel.provider &&
    modelRef.config.model === targetModel.model
  ) {
    return modelRef.instance;
  }

  const config: OpenAIProviderSettings = {
    apiKey: targetModel.apiKey,
    baseURL: targetModel.baseUrl,
  };

  // 如果有 extraBody，则拦截请求并注入
  if (targetModel.extraBody && Object.keys(targetModel.extraBody).length > 0) {
    config.fetch = async (url, init) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      return fetch(url, {
        ...init,
        body: JSON.stringify({ ...body, ...targetModel.extraBody }),
      });
    };
  }

  const provider = createOpenAI(config);

  log(`激活模型: ${targetModel.provider} (${targetModel.model})`);

  // 使用 .chat() 明确使用 Chat Completions API，而非默认的 Responses API
  modelRef.config = targetModel;
  modelRef.instance = provider.chat(targetModel.model);

  return modelRef.instance;
}

/**
 * 切换当前活跃模型
 */
export function switchModel(provider: string): string {
  const targetModel = MODELS.find((m) => m.provider === provider);
  if (!targetModel) {
    return "切换失败，模型不存在";
  }

  // 清除缓存，下次 createModel 时会重新创建
  modelRef.config = targetModel;
  modelRef.instance = null;
  return `模型已切换至${targetModel.provider}（${targetModel.model}）`;
}
