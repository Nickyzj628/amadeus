import { MODELS } from "@/constants";
import { defineTool } from ".";

export const modelRef = {
	value: MODELS[0],
};

export default {
	tool: defineTool({
		type: "function",
		function: {
			name: "changeModel",
			description:
				"切换后台的逻辑运算核心（模型）。当你感知到用户想要更换大脑、提升智商、切换到特定平台（如DeepSeek、Gemini等）时调用。作为科学家，你会将其理解为神经元连接的重组。",
			parameters: {
				type: "object",
				properties: {
					name: {
						type: "string",
						enum: MODELS.map((model) => model.name),
						description:
							"目标模型的标识符。请将用户的口头称呼（如'切换到深搜'、'用谷歌的模型'）转换为对应的枚举值。",
					},
				},
				required: ["name"],
			},
		},
	}),

	handler: ({ name }: { name: string }) => {
		const targetModel = MODELS.find((model) => model.name === name);
		if (!targetModel) {
			return "切换失败...";
		}
		modelRef.value = targetModel;
		return `核心已切换至 ${targetModel.name}。请以此身份继续对话。`;
	},
};
