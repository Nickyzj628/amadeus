import { defineFunctionTool } from "@/openai/utils/tool.js";
import { contentToMessage } from "../utils/convert.js";

export default defineFunctionTool({
	name: "denyReply",
	description:
		"不回复消息，调用后不会向用户输出任何内容。你应该在什么时候调用：\n- 用户主动要求终止对话时",
	parameters: {
		type: "object",
		properties: {
			reason: {
				type: "string",
				description: "拒绝回复的理由。",
			},
		},
		required: ["reason"],
	},
	_handler: async function ({ reason }, extraArgs) {
		// 手动推入一条工具调用结果
		if (extraArgs?.messages) {
			const toolCallId = extraArgs.messages.at(-1)?.tool_calls?.[0]?.id;
			extraArgs.messages.push(
				contentToMessage(
					"已拒绝回复用户，下一条消息将会是用户发起的另一轮对话",
					{
						role: "tool",
						tool_call_id: toolCallId,
					},
				),
			);
		}

		// 向上抛出 chatCompletions 异常，预期被 src\index.ts 接收
		const error = new Error(`模型拒绝回复消息，理由：${reason}`);
		error.name = this.name;
		throw error;
	},
});
