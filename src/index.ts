import { timeLog } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { MODELS } from "./constants";
import { handleCommand } from "./handlers/commands";
import { handleText } from "./handlers/non-commands";
import { GroupMessageEventSchema } from "./schemas/onebot/http-post";
import {
	isAtSelfSegment,
	isTextSegment,
	reply,
	textSegmentToCommand,
} from "./utils/onebot";

if (!Bun.env.SELF_ID) {
	throw new Error("请在.env文件中填写机器人QQ号（SELF_ID）");
}

const model = MODELS[0];

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

				// 拦截不是“(<回复/图文>) @机器人 <图文>”的消息
				const atSegmentIndex = e.message.findIndex((segment) =>
					isAtSelfSegment(segment),
				);
				if (atSegmentIndex === -1) {
					return reply();
				}
				const restSegments = e.message.toSpliced(atSegmentIndex, 1);
				if (restSegments.length === 0) {
					return reply();
				}

				// 优先处理指令
				if (isTextSegment(restSegments[0])) {
					const { fn, args } = textSegmentToCommand(restSegments[0]);
					if (fn !== undefined) {
						return handleCommand(fn, args, e);
					}
				}

				// 处理文本
				return handleText(e);
			},
		},
	},
	fetch() {
		return reply();
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
