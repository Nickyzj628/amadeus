import { defineTool } from "@nickyzj2023/ai";
// utils 里的底层函数仍叫 deleteMemory，工具名 forgetMemory 是模型视角的语义
import { deleteMemory } from "../utils/memory.js";

export default defineTool(
	"forgetMemory",
	"删除一段记忆（<memory>里能看到记忆，可属于对话中的任意用户）。\n何时删除（由你自主判断）：\n- 用户明确要求忘记/删除某条记忆\n- 某条记忆已过时、不再成立，且已被新信息取代（如用户换了工作，旧记忆“在A公司上班”应删除）\n- 记忆内容被用户否认或证明是错的\n示例：用户说“我之前说的生日是错的”，应删除原生日记忆；用户说“我改主意不去上海了”，可删除出差计划记忆。",
	{
		memoryId: {
			type: "string",
			description:
				"要删除的记忆UUID。上下文末尾的<memory>标签里是当前消息相关的已有记忆，每条格式为“UUID: 内容”，取要删除那条的UUID填入；<memory>里没有对应条目或不确定UUID时不要调用",
			required: true,
		},
	},
	async ({ memoryId }) => {
		// utils 里的 deleteMemory 不抛异常（内部 to + logger），直接返回乐观结果
		await deleteMemory(memoryId);
		return `已删除记忆 ${memoryId}`;
	},
);
