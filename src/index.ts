import { serve } from "@hono/node-server";
import { log } from "@nickyzj2023/utils";
import { Hono } from "hono";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import { safeParse } from "valibot";
import config from "./config.js";
import {
	GroupMessageEventSchema,
	isAtSelfSegment,
} from "./schemas/onebot/http-post.js";
import { afterLLM } from "./utils/after-llm/index.js";
import { beforeLLM } from "./utils/before-llm/index.js";
import { startBiliLiveTimer } from "./utils/bililive.js";
import { extractErrorMessage } from "./utils/common.js";
import {
	makeReplyBody,
	replyLikeHuman,
	sendGroupMessage,
} from "./utils/onebot/index.js";
import {
	generateContent,
	loadGroupMessages,
	onebotToOpenaiMessages,
	summarizeMessages,
} from "./utils/openai/index.js";

if (!config.bot.selfId) {
	throw new Error("请在 config.ts 文件中填写机器人 QQ 号（bot.selfId）");
}
if (!config.bot.onebotHttpPostPort) {
	throw new Error(
		"请在 config.ts 文件中填写机器人接收消息的端口号（bot.onebotHttpPostPort）",
	);
}

// 显式启用代理
const proxyAgent = new ProxyAgent("http://127.0.0.1:7890");
setGlobalDispatcher(proxyAgent);

const app = new Hono();

// 唯一路由
app.post("/", async (c) => {
	// 验证请求体格式
	// 保留了文字、图片、@、转发、回复、小程序消息段
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

	// 读取群聊消息
	const { group_id: groupId, user_id: userId } = e;
	const { messages, queue } = await loadGroupMessages(groupId);
	const isAtSelf = e.message.some(isAtSelfSegment);

	// 等待群聊其他消息释放队列
	const release = await queue.waitInQueue();
	let instantRelease = true;

	try {
		// 调试模式
		// if (groupId !== 669751957) {
		// 	throw new Error("🚧施工中");
		// }

		// 如果消息无需模型处理，则直接回复
		const directlySegments = await beforeLLM(e);
		if (directlySegments.length > 0) {
			if (isAtSelf) {
				return c.json(makeReplyBody(...directlySegments));
			} else {
				sendGroupMessage(groupId, directlySegments);
				return c.newResponse(null, 204);
			}
		}

		// 转换消息到 OpenAI API 兼容格式
		const currentMessages = await onebotToOpenaiMessages(e);
		messages.push(...currentMessages);

		// 拦截不是 @ 自己的消息，但有极小概率放行
		if (!isAtSelf && Math.random() > config.etc.replyProbabilityNotAt) {
			throw new Error();
		}

		const { content, ...info } = await generateContent(messages);
		if (!content) {
			throw new Error("模型生成了空消息，可能是故障或无语了");
		}

		instantRelease = false;
		Promise.all([
			// 分段回复消息
			replyLikeHuman(content, groupId, {
				at: isAtSelf ? userId : undefined,
			}),
			// 整理消息数组，包括优化、保存到本地
			afterLLM(e, messages, info),
		]).finally(() => {
			release();
		});
	} catch (error) {
		const errorMsg = extractErrorMessage(error);
		if (errorMsg) {
			log(`抛出了一个异常：${errorMsg}`);
			if (isAtSelf) {
				return c.json(makeReplyBody(` ${errorMsg}`));
			}
		}
	} finally {
		if (instantRelease) {
			// 消息超过一定数量时，调用模型总结一部分
			if (messages.length > config.etc.summarizeThreshold) {
				await summarizeMessages(messages);
			}
			release();
		}
	}

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

// 启动B站直播推送定时器
const stopBiliLiveTimer = startBiliLiveTimer();

const onShutdown = async (signal: string) => {
	log(`收到${signal}信号，正在关闭服务器...`);
	// 关闭 brec 定时器
	stopBiliLiveTimer();
	// 关闭 hono 服务器
	server.close(() => {
		process.exit(0);
	});
};

server.on("listening", () => {
	log(["服务器已启动", server.address()]);
});
process.on("SIGINT", onShutdown);
process.on("SIGTERM", onShutdown);
