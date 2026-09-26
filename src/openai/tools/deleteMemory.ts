import { defineTool } from "@nickyzj2023/ai";
import { deleteMemory } from "../utils/memory.js";

export default defineTool(
	"deleteMemory",
	"删除一条用户的记忆。\n何时调用：\n- 用户明确删除/弃用/否认某条记忆\n- 你在执行记忆采集/整理任务时\n何时不能调用：\n- `memory`标签里不存在相关记忆",
	{
		userId: {
			type: "number",
			description: "当前用户消息中`<user_id>`标签内的一串数字（QQ号）",
			required: true,
		},
		memoryId: {
			type: "string",
			description:
				"要删除的已有记忆ID。`<memory>`标签里包含部分已有记忆，若其中某条需要删除，取它的ID填入此处",
			required: true,
		},
	},
	async ({ userId, memoryId }) => {
		await deleteMemory(userId, memoryId);
		return `已删除记忆 ${memoryId}`;
	},
);
