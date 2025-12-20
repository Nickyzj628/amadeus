import ai from "../plain-texts/ai";
import { defineCommand } from ".";

/** 总结一下（调用本地 Ollama Qwen3:0.6b 小模型） */
const command = defineCommand({
	description: "归纳总结最近的群聊内容",
	example: "/总结一下",
	handle: async (args, e) => {
		return await ai.summarize(e.group_id);
	},
});

export default command;
