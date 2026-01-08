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
			description:
				"切换系统底层的大语言模型。只有当用户发出了明确的切换指令时才可调用。若用户仅是询问、了解有哪些模型，严禁调用此工具。",
			parameters: {
				type: "object",
				properties: {
					provider: {
						type: "string",
						enum: MODELS.filter((model) =>
							model.abilities.includes("chat"),
						).map((model) => model.provider),
						description:
							"目标模型的唯一标识符。需根据用户上下文中的描述映射至对应枚举值。",
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
		return `模型已切换至 ${targetModel.provider}（${targetModel.model}）`;
	},
);
