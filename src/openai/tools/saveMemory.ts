import { defineTool } from "@nickyzj2023/ai";
import { compactStr } from "@nickyzj2023/utils";
import { saveMemory } from "../utils/memory.js";

export default defineTool(
	"saveMemory",
	"长期记住一件用户的信息，即使之后新开对话也能想起来。\n何时调用：\n- 用户对你发出“记住/别忘了”等操纵记忆的指令\n- 你在执行记忆采集/整理任务时",
	{
		text: {
			type: "string",
			description:
				"要记住的内容，用自然语言简要描述，保留关键细节。如：小明将于2026.8.3去上海青浦区出差，暂定9.1坐飞机回成都",
			required: true,
		},
		userId: {
			type: "number",
			description: "当前用户消息中`<user_id>`标签内的一串数字（QQ号）",
			required: true,
		},
		memoryId: {
			type: "string",
			description:
				"要更新的已有记忆ID。`<memory>`标签里包含部分已有记忆，若其中某条需要修改，取它的ID填入此处。不传则视为新增记忆",
			required: false,
		},
	},
	async ({ text, memoryId, userId }) => {
		await saveMemory(text, userId, memoryId);
		return memoryId
			? `已更新记忆${memoryId}`
			: `已记住“${compactStr(text, { maxLength: 15, truncateMiddle: true })}”，之后会在需要时自动召回`;
	},
);
