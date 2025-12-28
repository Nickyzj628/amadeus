import type { ChatCompletionTool } from "openai/resources";
import { MODELS } from "@/constants";

export const modelRef = {
	value: MODELS[0],
};

export default {
	tool: {
		type: "function",
		function: {
			name: "changeModel",
			description: "切换系统底层的大语言模型。当用户请求切换到特定模型时调用",
			parameters: {
				type: "object",
				properties: {
					name: {
						type: "string",
						enum: MODELS.map((model) => model.name),
						description:
							"目标模型的唯一标识符。需根据用户上下文中的描述映射至对应枚举值",
					},
				},
				required: ["name"],
			},
		},
	} as ChatCompletionTool,

	handle: ({ name }: { name: string }) => {
		const targetModel = MODELS.find((model) => model.name === name);
		if (!targetModel) {
			return "切换失败，模型不存在";
		}
		modelRef.value = targetModel;
		return `模型已切换至 ${targetModel.name}`;
	},
};
