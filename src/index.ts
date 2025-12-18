import { timeLog } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { handleCommand } from "./handlers/command";
import { handlePlainText } from "./handlers/plain-text";
import { GroupMessageEventSchema } from "./schemas/onebot/http-post";
import type { ChatCompletionMessage } from "./schemas/openai";
import { reply } from "./utils/action";
import { saveGroupMessage } from "./utils/data";
import { isAtSelfSegment, isCommandText, isTextSegment } from "./utils/segment";

const server = Bun.serve({
	port: 8210,
	routes: {
		"/": {
			POST: async (req) => {
				// 验证请求体格式，隐式拦截了非文本、@本机器人、转发以外的消息
				const body = await req.json();
				const validation = safeParse(GroupMessageEventSchema, body);
				if (!validation.success) {
					return reply();
				}
				const e = validation.output;

				// 记录群友聊天消息，用于“/总结一下”
				const openAiMeessage =
				const message = (await saveGroupMessage(e)) as ChatCompletionMessage;

				// 拦截不是“@机器人 <纯文本>”的消息
				const atSegment = isAtSelfSegment(e, 0);
				const textSegment2 = isTextSegment(e, 1);
				if (!atSegment || !textSegment2) {
					return reply();
				}

				// 处理指令
				const { fn, args } = isCommandText(textSegment2) || {};
				if (fn !== undefined) {
					return handleCommand(e, fn, args);
				}
				// 处理纯文本
				return handlePlainText(e, message);
			},
		},
	},
	fetch() {
		return reply();
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
