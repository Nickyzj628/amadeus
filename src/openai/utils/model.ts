import { MODELS } from "@/constants.js";
import type { InputModality, Model } from "@/openai/schemas/model.js";

/** 当前使用的模型 */
export const modelRef = {
	current: MODELS[0] as Model,
};

/**
 * 按照名称/供应商查找模型
 */
export const findModelByName = (keyword: string) => {
	// 按供应商精准匹配
	const byProvider = MODELS.find((model) => model.provider === keyword);
	if (byProvider) {
		return byProvider;
	}

	// 按模型名精准匹配
	const byModel = MODELS.find((model) => model.model === keyword);
	if (byModel) {
		return byModel;
	}

	// 模糊匹配
	const normalizedInput = keyword.toLowerCase().trim();
	return MODELS.find(
		({ model, provider }) =>
			model.toLowerCase().includes(normalizedInput) ||
			provider.toLowerCase().includes(normalizedInput),
	);
};

/**
 * 按照多模态能力查找模型
 * @remarks 如果当前使用的模型具有对应能力，则优先使用
 */
export const findModelByModality = (modality: InputModality) => {
	if (modelRef.current.inputModalities?.includes(modality)) {
		return modelRef.current;
	}
	return MODELS.find((model) => model.inputModalities?.includes(modality));
};
