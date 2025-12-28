import { loopUntil, timeLog, to } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { SYSTEM_PROMPT } from "./constants";
import { GroupMessageEventSchema } from "./schemas/onebot";
import { chooseAndHandleTool, tools } from "./tools";
import { isAtSelfSegment, reply } from "./utils/onebot";
import {
	chatCompletions,
	onebotToOpenai,
	pendingGroups,
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

/**
 * 调试专用：将多行或冗余字符串压缩为单行精简格式
 * @param text 原始文本
 * @param maxLength 最大保留长度（可选，默认无限大）
 */
export const compactStr = (text: string = "", maxLength: number = Infinity): string => {
    if (!text) return "";

    const compressed = text
        .replace(/\r?\n/g, "\\n") // 将换行符转换为字面量 \n
        .replace(/\s+/g, " ")     // 将多个连续空格/制表符合并为一个空格
        .trim();

    if (compressed.length <= maxLength) {
        return compressed;
    }

    // 超长截断，保留中间或结尾（这里采用保留开头+省略号）
    return `${compressed.slice(0, maxLength)}...`;
};

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

				const groupId = e.group_id;
				if (pendingGroups.includes(groupId)) {
					return reply("正在处理上一条消息，请稍候……");
				}
				pendingGroups.push(groupId);

				// 读取群聊消息
				const messages = readGroupMessages(groupId, [
					textToMessage(SYSTEM_PROMPT, { role: "system" }),
				]);
				const currentMessages = await onebotToOpenai(e, {
					enableImageUnderstanding: true,
				});
				messages.push(...currentMessages);
				timeLog(
					"处理消息",
					currentMessages.map((message) => message.content),
				);

				// 循环请求模型，直到不再调用工具
				const [error, response] = await to(
					loopUntil(
						async () => {
							// 发出请求
							const completion = await chatCompletions(messages, {
								body: { tools },
							});
							messages.push(completion);

							// 调用工具
							const toolCalls = (completion.tool_calls ?? []).filter(
								(call) => call.type === "function",
							);
							for (const tool of toolCalls) {
								const toolResult = await chooseAndHandleTool(tool, e);
								timeLog(`已调用工具${tool.function.name}`, compactStr(toolResult));
								messages.push(
									textToMessage(toolResult, {
										role: "tool",
										tool_call_id: tool.id,
									}),
								);
							}

							return completion;
						},
						{
							shouldStop: (completion) => !completion.tool_calls,
						},
					),
				);

				// 回复消息
				pendingGroups.splice(pendingGroups.indexOf(groupId), 1);
				if (error) {
					return reply(error.message);
				}
				if (response.content) {
					timeLog("已处理消息", compactStr(response.content));
					return reply(response.content);
				}
				return reply("……");
			},
		},
	},
	fetch() {
		return reply();
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
