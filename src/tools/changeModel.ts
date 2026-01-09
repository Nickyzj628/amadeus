import { MODELS } from "@/constants";
import { defineTool } from "./utils";

export const modelRef = {
	value: MODELS[0],
};

export default defineTool(
	{
		type: "function",
		function: {
			name: "changeModel",
			description: "切换作为通讯链路的大语言模型",
			parameters: {
				type: "object",
				properties: {
					provider: {
						type: "string",
						enum: MODELS.filter((model) =>
							model.abilities.includes("chat"),
						).map((model) => model.provider),
						description: "模型名称，需要把用户的描述映射到对应枚举值",
					},
				},
				required: ["provider"],
			},
		},
	},
	({ provider }) => {
		const targetModel = MODELS.filter((model) =>
			model.abilities.includes("chat"),
		).find((model) => model.provider === provider);
		if (!targetModel) {
			return "切换失败，模型不存在";
		}

		modelRef.value = targetModel;
		return `模型已切换至${targetModel.provider}（${targetModel.model}）`;
	},
);
