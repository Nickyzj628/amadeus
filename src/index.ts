import { timeLog, to } from "@nickyzj2023/utils";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources";
import { safeParse } from "valibot";
import { SYSTEM_PROMPT } from "./constants";
import { GroupMessageEventSchema } from "./schemas/onebot";
import changeModel from "./tools/changeModel";
import { isAtSelfSegment, reply } from "./utils/onebot";
import {
	chatCompletions,
	onebotToOpenai,
	readGroupMessages,
	textToMessage,
} from "./utils/openai";

if (!Bun.env.SELF_ID) {
	throw new Error("请在.env文件中填写机器人QQ号（SELF_ID）");
}
if (!Bun.env.ONEBOT_HTTP_POST_PORT) {
	throw new Error(
		"请在.env文件中填写机器人接收消息的端口号（ONEBOT_HTTP_POST_PORT）",
	);
}

const server = Bun.serve({
	port: Bun.env.ONEBOT_HTTP_POST_PORT,
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
				const atSegmentIndex = e.message.findIndex(isAtSelfSegment);
				if (atSegmentIndex === -1) {
					return reply();
				}
				const restSegments = e.message.toSpliced(atSegmentIndex, 1);
				if (restSegments.length === 0) {
					return reply();
				}

				// 读取群聊消息
				const groupId = e.group_id;
				const messages = readGroupMessages(groupId, [
					textToMessage(SYSTEM_PROMPT, { role: "system" }),
				]);
				const currentMessages = await onebotToOpenai(e, {
					enableImageUnderstanding: true,
				});
				messages.concat(currentMessages);
				console.log(messages);

				// 请求模型
				const tools = [changeModel.tool];
				const [error, response] = await to(
					chatCompletions(messages, { body: { tools } }),
				);
				if (error) {
					return reply(error.message);
				}

				// 如果模型想调用工具，则把调用结果给它
				const functionToolCalls =
					response.tool_calls?.filter((call) => call.type === "function") ?? [];
				if (functionToolCalls.length > 0) {
					for (const tool of functionToolCalls) {
						switch (tool.function.name) {
							case "changeModel": {
								const name = JSON.parse(tool.function.arguments).name;
								changeModel.handler({ name });
								break;
							}
						}
					}
				}
				// 否则
				else if (typeof response.content === "string") {
					return reply(response.content);
				}

				return reply("工具调用次数过多，回复中断");
			},
		},
	},
	fetch() {
		return reply();
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
