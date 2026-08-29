import { defineTool } from "@nickyzj2023/ai";
import config from "@/config.js";
import { findModelByName, modelRef } from "@/openai/utils/model.js";

export default defineTool(
	"changeModel",
	`切换大语言模型。可用的模型列表：\n${config.models.map((model, index) => `${index + 1}. ${model.model}`).join("\n")}`,
	{
		model: {
			type: "string",
			description:
				"用户想要切换的模型。他无需输入模型的完整名称，但你必须从工具描述中选择最匹配的，将模型全名作为传参。",
			required: true,
		},
	},
	async ({ model }) => {
		const target = findModelByName(model);
		if (!target) {
			return `切换失败，找不到匹配的模型。可用模型：\n${config.models.map((model) => `- ${model.model}`).join("\n")}`;
		}
		modelRef.current = target;
		return `模型已切换至${target.model}`;
	},
);
