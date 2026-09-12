import { defineTool } from "@nickyzj2023/ai";
import { saveMemory } from "../utils/memory.js";

export default defineTool(
	"saveMemory",
	"把值得长期记住的信息保存到向量库，即使上下文被压缩，之后的对话也能自动召回。\n何时调用：用户对你发出“记住/别忘了”等操纵记忆的指令",
	{
		text: {
			type: "string",
			description:
				"要记住的内容，用自然语言简要描述，仅提炼关键细节。如：用户将于2026.8.3去上海青浦区出差，暂定9.1坐飞机回成都",
			required: true,
		},
		userId: {
			type: "number",
			description: "当前用户消息中`<user_id>`标签内的一串数字，即QQ号",
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
		if (!userId) {
			return "记忆保存失败：未提供记忆归属的QQ号";
		}
		await saveMemory(text, userId, memoryId);
		return memoryId ? `已更新记忆${memoryId}` : "已记住这些信息，之后遇到相关问题会被自动召回";
	},
);
