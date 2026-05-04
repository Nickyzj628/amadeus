import { MODELS } from "@/constants.js";
import { defineFunctionTool } from "@/utils/openai/function-tool.js";
import { switchModel } from "@/utils/openai/model.js";

const findModel = (input: string) => {
	// 按供应商精准匹配
	const byProvider = MODELS.find((model) => model.provider === input);
	if (byProvider) {
		return byProvider;
	}

	// 按模型名精准匹配
	const byModel = MODELS.find((model) => model.model === input);
	if (byModel) {
		return byModel;
	}

	// 模糊匹配
	const normalizedInput = input.toLowerCase().trim();
	return MODELS.find(
		({ model, provider }) =>
			model.toLowerCase().includes(normalizedInput) ||
			provider.toLowerCase().includes(normalizedInput),
	);
};

export default defineFunctionTool({
	name: "changeModel",
	description: `切换大语言模型。可用的供应商-模型列表：\n${MODELS.map((model, index) => `${index + 1}. ${model.provider} - ${model.model}`).join("\n")}`,
	parameters: {
		type: "object",
		properties: {
			model: {
				type: "string",
				description:
					"用户想要切换的模型，他可能用供应商、模型名或简称来指代模型。请从工具描述中选择最匹配的一个，将模型名作为参数传入。",
			},
		},
		required: ["model"],
	},
	_handler: async ({ model }) => {
		const target = findModel(model);
		if (!target) {
			return `切换失败，找不到匹配的模型。可用模型：\n${MODELS.map((model) => `- ${model.model}（${model.provider}）`).join("\n")}`;
		}
		return switchModel(target.model);
	},
});
