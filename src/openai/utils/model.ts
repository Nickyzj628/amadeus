import type { Model } from "@nickyzj2023/ai";
import config from "@/config.js";

/** 当前使用的模型 */
export const modelRef = {
	current: config.models[0] as Model,
};

/**
 * 按照模型名称查找模型
 */
export const findModelByName = (keyword: string) => {
	// 精准匹配
	const exact = config.models.find((model) => model.model === keyword);
	if (exact) {
		return exact;
	}

	// 模糊匹配
	const normalizedInput = keyword.toLowerCase().trim();
	return config.models.find((model) =>
		model.model?.toLowerCase().includes(normalizedInput),
	);
};

/**
 * 按照多模态能力查找模型
 * @remarks 如果当前使用的模型具有对应能力，则优先使用
 */
export const findModelByModality = (
	modality: NonNullable<Model["modalities"]>[number],
) => {
	if (modelRef.current.modalities?.includes(modality)) {
		return modelRef.current;
	}
	return config.models.find((model) => model.modalities?.includes(modality));
};
