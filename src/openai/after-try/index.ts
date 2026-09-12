import { compact, type Message, type Usage } from "@nickyzj2023/ai";
import { hasXmlTag, to } from "@nickyzj2023/utils";
import config from "@/config.js";
import type { GroupMessageEvent } from "@/onebot/schemas/http-post.js";
import { SUMMARIZE_PROMPT } from "../utils/constants.js";
import { collectMemories, deleteInjectedMemories } from "../utils/memory.js";
import { modelRef } from "../utils/model.js";
import { summarizeNDay } from "./compact.js";

/** 从后往前删除system-reminder（保留最新的2条） */
export const deleteOldReminders = (messages: Message[]) => {
	let reserveCount = 2;
	messages.forEach((message, i) => {
		if (
			message.role === "user" &&
			typeof message.content === "string" &&
			hasXmlTag(message.content, "system-reminder")
		) {
			if (reserveCount-- < 0) {
				messages.splice(i, 1);
			}
		}
	});
};

/**
 * 调用大模型之后（无论成败）的生命周期
 * @remarks 保证不抛异常
 */
export const afterTry = async (
	_e: GroupMessageEvent,
	messages: Message[],
	options?: {
		shouldRemoveInjectedMemory?: boolean;
		usage?: Usage;
	},
) => {
	const { shouldRemoveInjectedMemory, usage } = options ?? {};

	// 无论成败，都清理注入的记忆
	if (shouldRemoveInjectedMemory) {
		deleteInjectedMemories(messages);
	}
	// 成功后，清理过时的系统提醒
	if (usage) {
		deleteOldReminders(messages);
	}

	// collectMemories: 总结前，采集待总结消息中的记忆点

	// 无论成败，都压缩N天前的消息
	await to(summarizeNDay(messages, { beforeSummarize: collectMemories }));

	// 无论成败，都调用@nickyzj2023/ai的通用压缩方案
	await to(
		compact(messages, modelRef.current, {
			usage,
			...config.etc,
			summarizeOptions: {
				systemPrompt: SUMMARIZE_PROMPT,
				beforeSummarize: collectMemories,
			},
		}),
	);
};
