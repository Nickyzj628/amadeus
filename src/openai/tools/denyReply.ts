import { defineFunctionTool } from "@/openai/utils/function-tool.js";

export default defineFunctionTool({
	name: "denyReply",
	description:
		"当你判断消息没有必要回复时调用此工具，调用后不会向用户推送任何内容。",
	parameters: {
		type: "object",
		properties: {
			reason: {
				type: "string",
				description: "无需回复的理由，用于日志排查。",
			},
		},
		required: ["reason"],
	},
	_handler: async ({ reason }) => {
		const error = new Error(`模型拒绝回复消息，理由：${reason}`);
		error.name = "CustomError";
		throw error;
	},
});
