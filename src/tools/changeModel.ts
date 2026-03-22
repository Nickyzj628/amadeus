import { jsonSchema } from "ai";
import { MODELS } from "@/constants.js";
import { switchModel } from "@/utils/openai/provider.js";

export interface ChangeModelInput {
	model: string;
}

const findModel = (input: string) => {
	const normalized = input.toLowerCase().trim();

	const byProvider = MODELS.find(
		(m) => m.provider.toLowerCase() === normalized,
	);
	if (byProvider) return byProvider;

	const byModel = MODELS.find((m) => m.model.toLowerCase() === normalized);
	if (byModel) return byModel;

	return MODELS.find(
		(m) =>
			m.model.toLowerCase().includes(normalized) ||
			m.provider.toLowerCase().includes(normalized),
	);
};

const modelList = MODELS.map(
	(m, i) => `${i + 1}. ${m.provider} - ${m.model}`,
).join("\n");

export const changeModelTool = {
	description: `切换远程通话频道（大语言模型）\n\n可用模型列表：\n${modelList}\n\n用户可能会用简称或别名来指代模型，请从上述列表中选择最匹配的 model。`,
	inputSchema: jsonSchema({
		type: "object",
		properties: {
			model: {
				type: "string",
				description: "用户想要切换到的模型名称（可以是简称、别名或完整模型ID）",
			},
		},
		required: ["model"],
	}),
	execute: async ({ model }: ChangeModelInput) => {
		const target = findModel(model);
		if (!target) {
			const available = MODELS.map((m) => `- ${m.provider}（${m.model}）`).join(
				"\n",
			);
			return `切换失败，找不到匹配的模型。\n\n可用模型：\n${available}`;
		}
		return switchModel(target.provider);
	},
};
