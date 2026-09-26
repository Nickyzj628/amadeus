import { defineTool } from "@nickyzj2023/ai";
import { buildMemoryMessage, loadMemory } from "../utils/memory.js";

export default defineTool(
	"loadMemory",
	"手动召回用户相关记忆。何时调用：自动注入的`memory`消息不含本轮对话所需的用户记忆（例如本轮是用户A问你关于用户B的事情，但`memory`只注入了A的记忆，此时你可以调用本工具召回用户B的记忆）",
	{
		userId: {
			type: "number",
			description: "当前用户消息中`<user_id>`标签内的一串数字（QQ号）",
			required: true,
		},
	},
	async ({ userId }) => {
		const um = await loadMemory(userId);
		if (!um) {
			return `不存在用户${userId}的记忆`;
		}
		return buildMemoryMessage({ userId: um });
	},
);
