import { MODELS } from "@/openai/utils/constants.js";
import { findModelByName, modelRef } from "@/openai/utils/model.js";
import { defineFunctionTool } from "@/openai/utils/tool.js";

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
		const target = findModelByName(model);
		if (!target) {
			return `切换失败，找不到匹配的模型。可用模型：\n${MODELS.map((model) => `- ${model.model}（${model.provider}）`).join("\n")}`;
		}
		modelRef.current = target;
		return `模型已切换至${target.provider}（${target.model}）`;
	},
});
