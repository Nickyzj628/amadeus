import { serve } from "@hono/node-server";
import { log, to } from "@nickyzj2023/utils";
import { Hono } from "hono";
import { safeParse } from "valibot";
import { REPLY_PROBABILITY_NOT_BE_AT, SYSTEM_PROMPT } from "@/constants.js";
import { GroupMessageEventSchema } from "@/schemas/onebot.js";
import {
	isAtSelfSegment,
	reply,
	sendGroupMessage,
	textToSegment,
} from "@/utils/onebot.js";
import {
	chatCompletions,
	contentToMessage,
	onebotToOpenaiMessages,
	pendingGroupIdsSet,
	readGroupMessages,
	saveGroupMessages,
	summarizeMessages,
} from "@/utils/openai/index.js";
import { pruneMessages } from "@/utils/openai/prune-messages.js";
import config from "./config.js";
import { resolveBiliLink } from "./utils/bili.js";
import { closeMcpClients } from "./utils/openai/mcp-client.js";

if (!config.bot.selfId) {
	throw new Error("请在 config.ts 文件中填写机器人 QQ 号（bot.selfId）");
}
if (!config.bot.onebotHttpPostPort) {
	throw new Error(
		"请在 config.ts 文件中填写机器人接收消息的端口号（bot.onebotHttpPostPort）",
	);
}

const app = new Hono();

// 唯一路由
app.post("/", async (c) => {
	// 验证请求体格式（在 schema 校验阶段保留了文字、图片、@、转发、回复、小程序消息段）
	const body = await c.req.json();
	const validation = safeParse(GroupMessageEventSchema, body);
	if (!validation.success) {
		return c.newResponse(null, 204);
	}

	// 过滤空消息
	const e = validation.output;
	if (!e.message.length) {
		return c.newResponse(null, 204);
	}

	const { group_id: groupId } = e;
	const isAtSelf = e.message.some(isAtSelfSegment);

	// 限制每个群只能同时处理一条消息
	// TODO: 改为消息队列依次处理消息，解除这里的并发限制
	if (pendingGroupIdsSet.has(groupId)) {
		if (!isAtSelf) {
			return c.newResponse(null, 204);
		}
		return c.json(reply("正在处理其他消息，请稍后再试..."));
	}
	pendingGroupIdsSet.add(groupId);

	// 读取群聊消息
	const initialMessage = contentToMessage(SYSTEM_PROMPT, {
		role: "system",
	});
	const [error, messages] = await to(
		readGroupMessages(groupId, [initialMessage]),
	);
	if (error) {
		pendingGroupIdsSet.delete(groupId);
		return c.json(reply(`读取群聊消息失败：${error.message}`));
	}

	// 如果从消息中提取到B站链接，则解析并直接回复消息，不经过模型处理
	const segmentDataStr = JSON.stringify(
		e.message.map((segment) => segment.data),
	);
	const [, resolvedBiliLink] = await to(
		resolveBiliLink(segmentDataStr, {
			shouldToSegments: true,
		}),
	);
	if (resolvedBiliLink) {
		sendGroupMessage(groupId, resolvedBiliLink.segments);
		pendingGroupIdsSet.delete(groupId);
		return c.newResponse(null, 204);
	}

	// 优化历史消息
	// 消息超过一定内存时，自动修剪
	await pruneMessages(messages);
	// 消息超过一定数量时，自动总结一部分
	await summarizeMessages(messages);

	// 处理当前消息
	const currentMessages = await onebotToOpenaiMessages(e);
	const currentIndex = messages.length;
	messages.push(...currentMessages);

	// 拦截不是 @ 当前机器人的消息，但有极小概率放行
	if (!isAtSelf && Math.random() > REPLY_PROBABILITY_NOT_BE_AT) {
		pendingGroupIdsSet.delete(groupId);
		return c.newResponse(null, 204);
	}

	// 使用 Vercel AI SDK 生成回复（自动处理工具调用）
	const [error2, response] = await to(
		chatCompletions(messages, {
			disableMessagesOptimization: messages.at(-1)?.role === "tool",
		}),
	);
	pendingGroupIdsSet.delete(groupId);

	// 如果报错，则撤回本轮消息
	if (error2) {
		messages.splice(currentIndex, messages.length);
	}
	// 如果是在 @ 机器人时报错，则需要汇报错误信息
	if (error2 && isAtSelf) {
		return c.json(reply(error2.message));
	}
	// 抑制空信息
	if (!response?.content) {
		return c.newResponse(null, 204);
	}

	// 保存消息到本地
	to(saveGroupMessages(groupId, messages, { disableGC: true }));

	// 回复被动消息
	if (isAtSelf) {
		return c.json(reply(response.content));
	}

	// 回复主动消息
	sendGroupMessage(groupId, [textToSegment(response.content)]);
	return c.newResponse(null, 204);
});

// 其他路由返回 204 空响应
app.all("*", (c) => {
	return c.newResponse(null, 204);
});

const server = serve({
	fetch: app.fetch,
	port: config.bot.onebotHttpPostPort,
});

server.on("listening", () => {
	log(["服务器已启动", server.address()]);
});

// 程序退出时关闭所有 MCP Client 连接
const shutdown = async (signal: string) => {
	log(`收到 ${signal} 信号，正在关闭服务器...`);
	await closeMcpClients();
	server.close(() => {
		log("服务器已关闭");
		process.exit(0);
	});
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
