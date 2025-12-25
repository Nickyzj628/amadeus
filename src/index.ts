import { timeLog } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { GroupMessageEventSchema } from "./schemas/onebot/http-post";
// import { safeParse } from "valibot";
// import { MODELS, SYSTEM_PROMPT } from "./constants";
// import { GroupMessageEventSchema } from "./schemas/onebot/http-post";
import { reply } from "./utils/onebot";

// import { readGroupMessages, textToMessage } from "./utils/openai";

if (!Bun.env.SELF_ID) {
	throw new Error("请在.env文件中填写机器人QQ号（SELF_ID）");
}

// const model = MODELS[0];

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
				console.log(e);

				// // 拦截不是“(<回复/图文>) @机器人 <图文>”的消息
				// const atSegmentIndex = e.message.findIndex((segment) =>
				// 	isAtSelfSegment(segment),
				// );
				// if (atSegmentIndex === -1) {
				// 	return reply();
				// }
				// const restSegments = e.message.toSpliced(atSegmentIndex, 1);
				// if (restSegments.length === 0) {
				// 	return reply();
				// }

				// // 读取现有的群聊消息
				// const groupId = e.group_id;
				// // const messages = readGroupMessages(groupId, [
				// // 	textToMessage(SYSTEM_PROMPT, { role: "system" }),
				// // ]);
				// // 拼接当前消息
				// // messages.push(...(await onebotToOpenai(e)));
				// console.log(groupId);

				return reply();
			},
		},
	},
	fetch() {
		return reply();
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
