import { reply, textToSegment } from "@/utils/onebot";
import ai from "../non-commands/ai";
import { defineCommand } from ".";

/** 切换聊天模型 */
export default defineCommand({
	description: "切换聊天模型",
	example: "/模型 <模型名称>",
	handle: async ([name]) => {
		const nextModel = ai.changeModel(name);
		if (!nextModel) {
			return reply(
				textToSegment("可用的模型有："),
				...ai.models.map((model, index) =>
					textToSegment(
						`\n${index + 1}. ${model.name}，（${model.aliases.join("、")}、${model.model}）`,
					),
				),
				textToSegment(`\n当前模型：${ai.activeModel?.name}`),
			);
		}

		return reply(`已切换到${nextModel.name}`);
	},
});
