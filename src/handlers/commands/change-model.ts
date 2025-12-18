// --- 切换 AI 模型 ---

import { makeTextSegment, reply } from "../../utils/onebot";
import { Ai } from "../plain-text";
import { defineCommand } from ".";

const command = defineCommand({
	description: "切换 AI 聊天模型",
	example: "/模型 <模型名称>",
	handle: async ([name]) => {
		const nextModel = Ai.changeModel(name);
		if (!nextModel) {
			return reply(
				makeTextSegment("可用的模型有："),
				...Ai.models.map((model, index) =>
					makeTextSegment(
						`\n${index + 1}. ${model.name}（${model.aliases.join("、")}）`,
					),
				),
				makeTextSegment(`\n当前模型：${Ai.model?.name}`),
			);
		}

		return reply(`已切换到${nextModel.name}`);
	},
});

export default command;
