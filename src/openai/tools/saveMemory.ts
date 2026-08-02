import { defineTool } from "@nickyzj2023/utils";
import { saveMemory } from "../utils/memory.js";

export default defineTool(
	"saveMemory",
	"把对话中值得长期记住的信息保存到记忆库，之后对话能回忆起来。\n何时调用（由你自主判断）：\n- 用户明确说“记住/别忘了”等\n- 对话中出现值得长期记住的个人信息（生日、偏好、称呼、地址、计划、重大事件等）\n- 已有记忆发生变化需要更新时（见memoryId说明）\n- 观察到他人对某位用户的新称呼或新信息时，可更新该用户的记忆（不一定是你正在回复的用户）\n不要保存一次性、临时话题的内容。",
	{
		text: {
			type: "string",
			description: "要记住的信息内容，用自然语言描述，并保留细节。如：用户将于2026.8.3去上海青浦区出差，暂定9.1坐飞机回成都",
			required: true,
		},
		userId: {
			type: "number",
			description:
				"记忆归属用户的QQ号，不一定等于当前发言者。默认取当前发言者；若对话信息明确指向其他用户（如大家称呼某人“C哥”、谈论某人的信息），可从<user_id>、<mentioned_user_ids>或<memory>里已出现的用户ID中推断归属到该用户。无法确定时用当前发言者",
			required: true,
		},
		memoryId: {
			type: "string",
			description:
				"要更新的已有记忆UUID。<memory>标签里是当前消息相关的已有记忆（含多个用户的记忆，已按用户ID分块），每条格式为“UUID: 内容”，若其中某条已过时或需要修改，取它的UUID填入此处更新，而不是新建重复记忆；<memory>里没有对应条目或不确定UUID时不要传，走新建",
			required: false,
		},
	},
	async ({ text, memoryId, userId }) => {
		// 用户QQ号由模型从上下文推断（可能是当前发言者，也可能是对话中的其他用户），直接用于记忆归属
		if (!userId) {
			return "记忆保存失败：无法确定记忆归属用户的QQ号";
		}
		await saveMemory(text, userId, memoryId);
		return memoryId
			? `已更新记忆 ${memoryId}`
			: "已记住这些信息，之后我会想起来";
	},
);
