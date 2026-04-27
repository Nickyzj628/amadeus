import { MODELS } from "@/constants.js";
import type { Model } from "@/schemas/openai/index.js";

/** 当前使用的模型 */
export const modelRef = {
	value: MODELS[0] as Model,
};

/**
 * 切换当前使用的模型
 * @param providerOrModel 模型供应商或模型名称
 *
 * @example
 * // 通过模型供应商切换
 * switchModel("OpenRouter");
 *
 * @example
 * // 通过模型名称切换
 * switchModel("openai/gpt-5.4-nano");
 */
export const switchModel = (providerOrModel: string) => {
	const targetModel = MODELS.find(
		(model) =>
			model.provider === providerOrModel || model.model === providerOrModel,
	);
	if (!targetModel) {
		return "切换失败，模型不存在";
	}

	modelRef.value = targetModel;
	return `模型已切换至${targetModel.provider}（${targetModel.model}）`;
};
