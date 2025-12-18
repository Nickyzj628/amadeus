import { timeLog } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { handleCommand } from "./handlers/commands";
import { handlePlainText } from "./handlers/plain-text";
import { GroupMessageEventSchema } from "./schemas/onebot/http-post";
import {
	isAtSelfSegment,
	isTextSegment,
	reply,
	textSegmentToCommand,
} from "./utils/onebot";

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
				// const openAiMeessage =
				// const message = (await saveGroupMessage(e)) as ChatCompletionMessage;

				// 拦截不是“@机器人 <纯文本>”的消息
				const [atSegment, textSegment] = e.message;
				if (!isAtSelfSegment(atSegment, e) || !isTextSegment(textSegment)) {
					return reply();
				}

				// 处理指令
				const { fn, args } = textSegmentToCommand(textSegment);
				if (fn !== undefined) {
					return handleCommand(fn, args, e);
				}
				// 处理纯文本
				return handlePlainText(textSegment.data.text, e);
			},
		},
	},
	fetch() {
		return reply();
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
