import { timeLog } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { handleCommand } from "./handlers/commands";
import { handleMessages } from "./handlers/non-commands";
import { GroupMessageEventSchema } from "./schemas/onebot/http-post";
import {
	isAtSelfSegment,
	isImageSegment,
	isTextSegment,
	reply,
	textSegmentToCommand,
} from "./utils/onebot";
import { onebotToOpenai } from "./utils/openai";

const server = Bun.serve({
	port: 8210,
	routes: {
		"/": {
			POST: async (req) => {
				// 验证请求体格式，隐式拦截了非图文、@本机器人、转发以外的消息
				const body = await req.json();
				const validation = safeParse(GroupMessageEventSchema, body);
				if (!validation.success) {
					return reply();
				}
				const e = validation.output;

				// 拦截不是“@机器人 <图文>”的消息
				const [segment1, ...restSegments] = e.message;
				if (!isAtSelfSegment(segment1, e) || restSegments.length === 0) {
					return reply();
				}
				const hasUnsupportedSegment = restSegments.some(
					(segment) => !isTextSegment(segment) && !isImageSegment(segment),
				);
				if (hasUnsupportedSegment) {
					return reply("不支持的消息类型，目前只支持文字和图片");
				}

				// 优先处理指令
				if (isTextSegment(restSegments[0])) {
					const { fn, args } = textSegmentToCommand(restSegments[0]);
					if (fn !== undefined) {
						return handleCommand(fn, args, e);
					}
				}

				// 处理图文消息后，丢给聊天模型
				const messages = await onebotToOpenai(e);
				return handleMessages(messages, e);
			},
		},
	},
	fetch() {
		return reply();
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
