import { to } from "@nickyzj2023/utils";
import { SYSTEM_PROMPT } from "@/constants";
import type { GroupMessageEvent } from "@/schemas/onebot/http-post";
import {
	onebotToOpenai,
	readGroupMessages,
	textToMessage,
} from "@/utils/openai";
import { chatCompletions } from "./utils";

/** 参与群聊 */
const chat = async (e: GroupMessageEvent) => {
	// 读取历史消息
	const groupMessages = readGroupMessages(e.group_id, [
		{
			role: "system",
			content: SYSTEM_PROMPT,
		},
	]);
	// 读取当前消息
	const messages = await onebotToOpenai(e, {
		enableImageUnderstanding: true,
	});
	// 拼接起来
	groupMessages.push(...messages);

	const [error, response] = await to(chatCompletions(groupMessages));
	if (error) {
		groupMessages.splice(-messages.length);
		return `消息生成失败：${error.message}`;
	}

	groupMessages.push(
		textToMessage(response, {
			role: "assistant",
		}),
	);
	return response;
};

export default chat;
