import { compactStr, log } from "@nickyzj2023/utils";
import { generateText, stepCountIs } from "ai";
import { ANCHOR_THRESHOLD, IDENTITY_ANCHOR, SAFE_WORD } from "@/constants.js";
import { tools } from "@/tools/index.js";
import { createModel, modelRef } from "./provider.js";

/** 聊天补全函数，使用 Vercel AI SDK */
export const chatCompletions = async (
	messages: any[],
	options?: {
		/** 禁用消息优化（如添加人设锚点） */
		disableMessagesOptimization?: boolean;
	},
) => {
	const { disableMessagesOptimization = false } = options ?? {};

	if (!modelRef.config) {
		throw new Error("当前没有运行中的模型，可以对我说“切换到XX模型”启用一个");
	}

	const wipMessages = [...messages];

	// 找到最后一条用户消息
	const getLastUserMessage = () => {
		const index = wipMessages.findLastIndex((m) => m.role === "user");
		return [wipMessages[index], index] as const;
	};

	let [lastUserMessage, lastUserMessageIndex] = getLastUserMessage();

	/**
	 * 如果消息中包含安全词，则在用户提问前添加永久人设锚点
	 */
	if (
		lastUserMessage !== undefined &&
		typeof lastUserMessage.content === "string" &&
		lastUserMessage.content.includes(SAFE_WORD)
	) {
		wipMessages.splice(lastUserMessageIndex, 0, {
			role: "system",
			content: IDENTITY_ANCHOR,
		});
		lastUserMessage.content = lastUserMessage.content.replace(SAFE_WORD, "");
		lastUserMessageIndex++;
	}

	/**
	 * 如果消息超过 X 条，则在用户提问前添加临时人设锚点
	 */
	const needTempIdentityAnchor =
		!disableMessagesOptimization &&
		wipMessages.length > ANCHOR_THRESHOLD &&
		lastUserMessageIndex !== -1;

	if (needTempIdentityAnchor) {
		wipMessages.splice(lastUserMessageIndex, 0, {
			role: "system",
			content: IDENTITY_ANCHOR,
		});
	}

	/**
	 * 使用 Vercel AI SDK 生成回复
	 */
	try {
		const result = await generateText({
			model: createModel(),
			messages: wipMessages,
			tools,
			stopWhen: stepCountIs(5), // 最多 5 轮工具调用
		});

		// 如果启用了临时人设锚点，则在消费后移除
		if (needTempIdentityAnchor) {
			wipMessages.splice(lastUserMessageIndex, 1);
		}

		// 将生成的消息添加到历史
		if (result.response.messages && result.response.messages.length > 0) {
			wipMessages.push(...result.response.messages);
		}

		// 同步 wipMessages 回原数组
		messages.length = 0;
		messages.push(...wipMessages);

		return {
			role: "assistant" as const,
			content: result.text || "",
			tool_calls: result.toolCalls?.map((call) => ({
				id: call.toolCallId,
				type: "function" as const,
				function: {
					name: call.toolName,
					arguments: JSON.stringify((call as any).args || (call as any).input),
				},
			})),
		};
	} catch (error) {
		const errMessage = compactStr(JSON.stringify(error, null, 2), {
			disableNewLineReplace: true,
		});
		log(["请求失败", error]);
		throw new Error(errMessage);
	}
};
