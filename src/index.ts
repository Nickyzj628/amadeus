import { extractErrorMessage, logger, to } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { startBiliLiveTimer } from "./common/bililive.js";
import { createApp, serve } from "./common/http-server.js";
import config from "./config.js";
import { beforeLLM } from "./onebot/before-llm/index.js";
import {
	GroupMessageEventSchema,
	isAtSelfSegment,
} from "./onebot/schemas/http-post.js";
import { makeReplyBody, replyLikeHuman } from "./onebot/utils/action.js";
import { sendGroupMessage } from "./onebot/utils/http.js";
import autoCompact from "./openai/utils/compact.js";
import { onebotToOpenAi } from "./openai/utils/convert.js";
import { generateContent } from "./openai/utils/generate-content.js";
import { loadMessages, saveMessages } from "./openai/utils/messages.js";

const checkRequiredConfig = () => {
	if (!config.bot.selfId) {
		throw new Error("请在/src/config.ts中填写机器人QQ号（bot.selfId）");
	}
	if (!config.bot.onebotHttpPostPort) {
		throw new Error(
			"请在/src/config.ts中填写从协议端接收消息的端口号（bot.onebotHttpPostPort）",
		);
	}
};
checkRequiredConfig();

// LLBot（OneBot协议端）发送消息到此路由
const app = createApp();
app.post("/", async (c) => {
	// 验证请求体格式（无法处理的消息类型会丢弃）
	const body = await c.req.json();
	const validation = safeParse(GroupMessageEventSchema, body);
	if (!validation.success) {
		return c.body(null, 204);
	}
	// 过滤空消息
	const e = validation.output;
	if (!e.message.length) {
		return c.body(null, 204);
	}
	// 过滤非当前绑定机器人
	if (e.self_id !== Number(config.bot.selfId)) {
		return c.body(null, 204);
	}

	// 读取群聊消息
	const { group_id: groupId, user_id: userId } = e;
	const { messages, queue } = await loadMessages(groupId);
	const isAtSelf = e.message.some(isAtSelfSegment);

	// 无需模型处理的消息，直接回复
	const segments = await beforeLLM(e);
	if (segments.length > 0) {
		if (isAtSelf) {
			return c.json(makeReplyBody(...segments));
		}
		await sendGroupMessage(groupId, segments);
		return c.body(null, 204);
	}

	// 等待当前群聊前面的消息释放队列
	const release = await queue.waitInQueue();
	let hasReleased = false;

	// 模型处理消息
	try {
		// 调试模式
		// if (groupId !== 669751957) {
		// 	throw new Error("🚧施工中");
		// }

		// 转换消息到OpenAI API格式
		const currentMessages = await onebotToOpenAi(e);
		messages.push(...currentMessages);

		// 拦截不是@自己的消息，但有极小概率放行
		if (!isAtSelf && Math.random() > config.etc.replyProbabilityNotAt) {
			throw new Error();
		}

		// 模型生成回复内容
		const { content, usage } = await generateContent(messages);
		if (!content) {
			throw new Error("模型生成了空消息，可能是故障或无语了");
		}
		// 分段回复消息
		await replyLikeHuman(content, groupId, {
			at: isAtSelf ? userId : undefined,
		});

		// 自动优化上下文
		await autoCompact(messages, usage);
		// 保存到本地
		await saveMessages(groupId, messages);
		// 释放消息队列
		release();
		hasReleased = true;
	} catch (error) {
		// 无需处理的异常
		if (
			!(error instanceof Error) ||
			// 不用上报的异常信息
			error.message === "" ||
			// 模型拒绝回复
			error.name === "denyReply"
		) {
			return c.body(null, 204);
		}

		// 主动回复报错信息
		const message = extractErrorMessage(error);
		if (isAtSelf) {
			return c.json(makeReplyBody(message));
		}

		// 被动打印报错信息
		logger(`抛出了一个异常：${message}`);
	} finally {
		// 如果模型正常回复，队列应该被正常释放
		// 进到这里说明没回复，但还是要做些收尾工作
		if (!hasReleased) {
			// 自动优化上下文
			await to(autoCompact(messages));

			// 释放消息队列
			release();
		}
	}

	return c.body(null, 204);
});

// 启动B站直播推送
const stopBiliLiveTimer = startBiliLiveTimer();

// 启动HTTP服务器
const server = serve(app, config.bot.onebotHttpPostPort);

// server.listen() 是异步的，等 listening 事件后再取端口，避免 address() 为 null
server.on("listening", () => {
	logger("服务器已启动", server.address());
});

// 退出程序
const onShutdown = async (signal: string) => {
	logger(`收到${signal}信号，正在关闭服务器...`);

	await saveMessages();
	stopBiliLiveTimer();

	server.close(() => {
		process.exit(0);
	});
};
process.on("SIGINT", onShutdown);
process.on("SIGTERM", onShutdown);
