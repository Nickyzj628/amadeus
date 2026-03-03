import { jsonSchema } from "ai";
import { MODELS } from "@/constants.js";
import { switchModel } from "@/utils/openai/provider.js";

/**
 * 根据用户输入模糊匹配模型
 */
const findModel = (input: string) => {
	const normalizedInput = input.toLowerCase().trim();

	// 1. 精确匹配 provider
	const byProvider = MODELS.find(
		(m) => m.provider.toLowerCase() === normalizedInput,
	);
	if (byProvider) return byProvider;

	// 2. 精确匹配 model
	const byModel = MODELS.find((m) => m.model.toLowerCase() === normalizedInput);
	if (byModel) return byModel;

	// 3. 模糊匹配
	const fuzzyMatch = MODELS.find(
		(m) =>
			m.model.toLowerCase().includes(normalizedInput) ||
			m.provider.toLowerCase().includes(normalizedInput),
	);

	return fuzzyMatch;
};

/**
 * 切换模型工具定义
 * 使用 as any 绕过类型检查，因为 jsonSchema 和 tool() 的类型不兼容
 */
export const changeModelTool: any = {
	description: `切换远程通话频道（大语言模型）

可用模型列表：
${MODELS.map((m, i) => `${i + 1}. ${m.provider} - ${m.model}`).join("\n")}

用户可能会用简称或别名来指代模型，请从上述列表中选择最匹配的 model。`,
	inputSchema: jsonSchema({
		type: "object",
		properties: {
			model: {
				type: "string",
				description:
					"用户想要切换到的模型名称（可以是简称、别名或完整model ID）",
			},
		},
		required: ["model"],
	}),
	execute: async ({ model }: { model: string }) => {
		const targetModel = findModel(model);
		if (!targetModel) {
			return `切换失败，找不到匹配的模型。\n\n可用模型：\n${MODELS.map((m) => `- ${m.provider}（${m.model}）`).join("\n")}`;
		}
		return switchModel(targetModel.provider);
	},
};
