import { timeLog } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { handleCommand } from "./handlers/command";
import { Ai, handlePlainText } from "./handlers/plain-text";
import { GroupMessageEventSchema } from "./schemas/onebot";
import type { ChatCompletionMessage } from "./schemas/openai";
import { isAtSelfSegment, isCommandText, isTextSegment } from "./utils";

const server = Bun.serve({
	port: 8210,
	routes: {
		"/": {
			POST: async (req) => {
				// 验证请求体格式
				const body = await req.json();
				const validation = safeParse(GroupMessageEventSchema, body);
				if (!validation.success) {
					return new Response(null, { status: 204 });
				}

				// 拦截既不是@也不是文本的消息
				const e = validation.output;
				const textSegment = isTextSegment(e, 0);
				const atSegment = isAtSelfSegment(e, 0);
				if (textSegment === false && atSegment === false) {
					return new Response(null, { status: 204 });
				}

				// 记录群友聊天消息，用于“/总结一下”
				if (textSegment !== false) {
					let groupFullMessages = Ai.groupFullMessagesMap[
						e.group_id
					] as ChatCompletionMessage[];
					if (!Array.isArray(groupFullMessages)) {
						groupFullMessages = Ai.groupFullMessagesMap[e.group_id] = [];
					}
					groupFullMessages.push({
						role: "user",
						name: `${e.sender.nickname}（${e.sender.user_id}）`,
						content: textSegment.data.text,
					});
				}

				// 拦截不是“@机器人 <纯文本>”的消息
				const textSegment2 = isTextSegment(e, 1);
				if (atSegment === false || textSegment2 === false) {
					return new Response(null, { status: 204 });
				}

				// 处理指令
				const { fn, args } = isCommandText(textSegment2) || {};
				if (fn !== undefined) {
					return handleCommand(e, fn, args);
				}
				// 处理纯文本
				return handlePlainText(e, textSegment2.data.text);
			},
		},
	},
	fetch() {
		return new Response(null, { status: 204 });
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
