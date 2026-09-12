import { defineTool } from "@nickyzj2023/ai";
import { deleteMemory } from "../utils/memory.js";

export default defineTool(
	"deleteMemory",
	"删除一条记忆。\n何时调用：用户明确删除/弃用/否认某条记忆\n何时不能调用：`memory`标签里不存在相关记忆",
	{
		memoryId: {
			type: "string",
			description:
				"要删除的已有记忆ID。`<memory>`标签里包含部分已有记忆，若其中某条需要删除，取它的ID填入此处",
			required: true,
		},
	},
	async ({ memoryId }) => {
		await deleteMemory(memoryId);
		return `已删除记忆 ${memoryId}`;
	},
);
