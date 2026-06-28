import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { extractErrorMessage, logger, to } from "@nickyzj2023/utils";
import { createServerAdapter } from "@whatwg-node/server";
import { AutoRouter, json, status, withContent } from "itty-router";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import { safeParse } from "valibot";
import { startBiliLiveTimer } from "./common/bililive.js";
import config from "./config.js";
import { beforeLLM } from "./onebot/before-llm/index.js";
import {
	GroupMessageEventSchema,
	isAtSelfSegment,
} from "./onebot/schemas/http-post.js";
import { makeReplyBody, replyLikeHuman } from "./onebot/utils/action.js";
import { sendGroupMessage } from "./onebot/utils/http.js";
import compactMessages from "./openai/utils/compact-messages.js";
import { generateContent } from "./openai/utils/generate-content.js";
import {
	loadGroupMessages,
	saveGroupMessages,
} from "./openai/utils/group-messages.js";
import { onebotToOpenaiMessages } from "./openai/utils/message.js";

if (!config.bot.selfId) {
	throw new Error("请在 config.ts 文件中填写机器人 QQ 号（bot.selfId）");
}
if (!config.bot.onebotHttpPostPort) {
	throw new Error(
		"请在 config.ts 文件中填写机器人接收消息的端口号（bot.onebotHttpPostPort）",
	);
}

// 启用代理
const proxy = execSync("npm config get proxy").toString().trim();
if (proxy && proxy !== "null") {
	const proxyAgent = new ProxyAgent(proxy);
	setGlobalDispatcher(proxyAgent);
}

// 创建唯一路由
const router = AutoRouter();
router.post("/", withContent, async (req) => {
	// 验证请求体格式
	// 保留了文字、图片、视频、@、转发、回复、小程序消息段
	const validation = safeParse(GroupMessageEventSchema, req.content);
	if (!validation.success) {
		return status(204);
	}

	// 过滤空消息
	const e = validation.output;
	if (!e.message.length) {
		return status(204);
	}

	// 读取群聊消息
	const { group_id: groupId, user_id: userId } = e;
	const { messages, queue } = await loadGroupMessages(groupId);
	const isAtSelf = e.message.some(isAtSelfSegment);

	// 等待群聊其他消息释放队列
	const release = await queue.waitInQueue();
	let hasReleased = false;

	try {
		// 调试模式
		// if (groupId !== 669751957) {
		// 	throw new Error("🚧施工中");
		// }

		// 如果消息无需模型处理，则直接回复
		const directlySegments = await beforeLLM(e);
		if (directlySegments.length > 0) {
			if (isAtSelf) {
				return json(makeReplyBody(...directlySegments));
			}
			sendGroupMessage(groupId, directlySegments);
			return status(204);
		}

		// 转换消息到 OpenAI API 兼容格式
		const currentMessages = await onebotToOpenaiMessages(e);
		messages.push(...currentMessages);

		// 拦截不是 @ 自己的消息，但有极小概率放行
		if (!isAtSelf && Math.random() > config.etc.replyProbabilityNotAt) {
			throw new Error();
		}

		const { content, isTokenNearLimit } = await generateContent(messages);
		if (!content) {
			throw new Error("模型生成了空消息，可能是故障或无语了");
		}

		// 分段回复消息
		await replyLikeHuman(content, groupId, {
			at: isAtSelf ? userId : undefined,
		});

		// 优化上下文
		await compactMessages(messages, {
			isTokenNearLimit,
			shouldSave: true,
			groupId,
		});

		// 释放消息队列
		release();
		hasReleased = true;
	} catch (error) {
		// 不处理不予放行、denyReply工具抛出的异常
		const isIgnorable =
			error instanceof Error &&
			(error.message === "" || error.name === "denyReply");
		if (isIgnorable) {
			return status(204);
		}
		// 主动回复/被动打印报错信息
		const message = extractErrorMessage(error);
		if (isAtSelf) {
			return json(makeReplyBody(message));
		}
		logger(`抛出了一个异常：${message}`);
	} finally {
		if (!hasReleased) {
			await to(compactMessages(messages));
			release();
		}
	}

	return status(204);
});

// 启动 HTTP 服务器
const ittyServer = createServerAdapter(router.fetch);
const server = createServer(ittyServer);
server.listen(config.bot.onebotHttpPostPort);
server.on("listening", () => {
	logger("服务器已启动", server.address());
});

// 启动B站直播推送定时器
const stopBiliLiveTimer = startBiliLiveTimer();

// 退出程序
const onShutdown = async (signal: string) => {
	logger(`收到${signal}信号，正在关闭服务器...`);
	// 保存所有消息到本地
	await saveGroupMessages();
	// 关闭 brec 定时器
	stopBiliLiveTimer();
	// 关闭 http 服务器
	server.close(() => {
		process.exit(0);
	});
};
process.on("SIGINT", onShutdown);
process.on("SIGTERM", onShutdown);
