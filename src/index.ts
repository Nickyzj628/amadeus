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
import { onebotToOpenAI } from "./openai/utils/convert.js";
import { generateContent } from "./openai/utils/generate-content.js";
import { injectMemory, removeInjectedMemory } from "./openai/utils/memory.js";
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
	const messages = await loadMessages(groupId);
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

	// 请求该群的专属锁：助手处理消息时依序响应
	// 锁名按group-{groupId}区分，不同群互不影响；回调结束自动释放锁，异常也不会卡死队列
	// 模型处理失败时通过回调返回值带出错误（而不是抛出），所以下方只需 if 分类，无需再包一层 try
	const modelError = await navigator.locks.request(
		`group-${groupId}`,
		async () => {
			// 模型处理消息
			try {
				// 调试模式
				// if (groupId !== 669751957) {
				// 	throw new Error("🚧施工中");
				// }

				// 转换消息到OpenAI API格式
				const currentMessages = await onebotToOpenAI(e);
				messages.push(...currentMessages);

				// 拦截不是@自己的消息，但有极小概率放行
				if (!isAtSelf && Math.random() > config.etc.replyProbabilityNotAt) {
					throw new Error();
				}

				// 注入临时记忆
				// 只用消息正文来搜索记忆，onebotToOpenAI返回的消息正文始终在最后（-1）
				const bodyMessage = currentMessages?.at(-1);
				if (typeof bodyMessage?.content === "string") {
					await injectMemory(messages, bodyMessage.content, userId);
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
			} catch (error) {
				// 模型处理失败：先尝试压缩上下文，再把错误作为返回值带出，让锁正常释放
				await to(autoCompact(messages));
				return error;
			} finally {
				// 无论成败都收回本轮临时注入的<memory>消息：
				// 它是每轮临时注入的参考，不应随历史持久化；
				removeInjectedMemory(messages);
			}
			// 保存历史（成功路径才会走到这里，catch 里已 return）
			await to(saveMessages(groupId, messages));
		},
	);

	// 模型处理失败时统一分类（此时锁已释放，安全）
	if (modelError) {
		// 无需处理的异常
		if (
			!(modelError instanceof Error) ||
			// 不用上报的异常信息
			modelError.message === "" ||
			// 模型拒绝回复
			modelError.name === "denyReply"
		) {
			return c.body(null, 204);
		}

		// 主动回复报错信息
		const message = extractErrorMessage(modelError);
		if (isAtSelf) {
			return c.json(makeReplyBody(message));
		}

		// 被动打印报错信息
		logger(`抛出了一个异常：${message}`);
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
