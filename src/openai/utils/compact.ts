import { compact, type Message, type Usage } from "@nickyzj2023/ai";
import { extractXmlTagContent, logger } from "@nickyzj2023/utils";
import config from "@/config.js";
import { SUMMARIZE_PROMPT } from "./constants.js";
import { modelRef } from "./model.js";

/**
 * 压缩{config.etc.summarizeNDay}天前的消息
 * @param messages 完整消息数组，会原地修改它
 */
const summarizeNDay = async (messages: Message[]) => {
	// 1. 计算最大日期
	const maxDate = new Date();
	maxDate.setDate(maxDate.getDate() - config.etc.summarizeNDay);
	maxDate.setHours(23);
	maxDate.setMinutes(59);
	maxDate.setSeconds(59);

	const isLTEMaxDate = (message: Message) => {
		if (typeof message.content !== "string") {
			return false;
		}
		const date = new Date(extractXmlTagContent(message.content, "time") || "");
		if (Number.isNaN(date.getTime())) {
			return false;
		}
		if (date <= maxDate) {
			return true;
		}
		return false;
	};

	// 1.1 快速判断第一条含有time的消息，是否已经超过maxDate
	const firstTimeMessage = messages.find(
		(message) =>
			typeof message.content === "string" &&
			extractXmlTagContent(message.content, "time"),
	);
	if (!firstTimeMessage || !isLTEMaxDate(firstTimeMessage)) {
		return;
	}

	// 2. 找到最后一条早于maxDate的消息
	const lastCompressibleIndex = messages.findLastIndex(isLTEMaxDate);
	if (lastCompressibleIndex === -1) {
		return;
	}

	const compressible = messages.slice(0, lastCompressibleIndex + 1);
	const reserved = messages.slice(lastCompressibleIndex + 1);

	// 3. 压缩
	await compact.summarizeMessages(compressible, {
		model: modelRef.current,
		systemPrompt: SUMMARIZE_PROMPT,
	});

	// 4. 整理上下文
	messages.splice(0, messages.length, ...compressible, ...reserved);
	logger(`自动压缩了${maxDate.toLocaleString()}及之前的消息`);
};

/**
 * 自动优化上下文，类似AI Coding Agent的/compact命令
 */
export const autoCompact = async (
	messages: Message[],
	/** 提供token消耗情况时，能更准确地判断上下文是否达到阈值 */
	usage?: Usage,
) => {
	// 先压缩N天前的消息
	await summarizeNDay(messages);

	// 再使用@nickyzj2023/ai的通用压缩方案
	await compact(messages, modelRef.current, {
		usage,
		...config.etc,
		summarizeOptions: {
			systemPrompt: SUMMARIZE_PROMPT,
		},
	});
};
