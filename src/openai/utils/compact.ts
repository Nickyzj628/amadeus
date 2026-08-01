import type { AI, ChatCompletions } from "@nickyzj2023/utils";
import { compactMessages, extractXmlTags } from "@nickyzj2023/utils";
import config from "@/config.js";
import { SUMMARIZE_PROMPT } from "./constants.js";
import { modelRef } from "./model.js";

/**
 * 解析日期行（格式：2026年7月18日），返回毫秒时间戳。
 * 解析失败（格式异常）时返回 null，调用方应跳过该段，
 * 避免误删无法确认时间先后的摘要。
 */
const parseSummaryDate = (text: string): number | null => {
	// split 结果必非空，这里防御性兜底为空字符串即可（match 会失败并返回 null）
	const firstLine = text.trim().split("\n")[0] ?? "";
	const matched = firstLine.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
	if (!matched) return null;
	const [, year, month, day] = matched;
	// 用年月日显式构造 Date，避免字符串解析在不同运行时下的歧义
	return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
};

/**
 * 匹配顶格的日期行（如 "2026年7月18日"），作为各日期段的分隔标记。
 * 生产环境的总结消息是一个<summary>块内合并多天内容，各天用日期行分隔，
 * 详见 removeOldSummaries 中的格式说明。
 */
const DATE_LINE_REGEX = /^(\d{4}年\d{1,2}月\d{1,2}日)$/gm;

/**
 * 如果总结消息的字数>limitOfSummary，则移除日期较早的日期段，直到字数达标。
 * 总结消息只要存在，其 content 格式见 src\openai\prompts\summarize.md
 *
 * 一条总结消息可能合并多天的内容（生产环境即是如此），
 * 各天之间用顶格的日期行（如 "2026年7月19日"）分隔，
 * 日期行本身也是"日期段"的起始标记，见 DATE_LINE_REGEX
 * @param messages 完整消息数组，会原地修改其中超长的总结消息
 */
const removeOldSummaries = (messages: AI.Message[]) => {
	const summaryMessage = messages.find(
		(message) =>
			typeof message.content === "string" &&
			extractXmlTags(message.content, ["summary"]).length > 0,
	);
	// 超长时逐个删除日期最早的日期段，直到字数达标或只剩一个日期段（防止死循环）
	while (
		summaryMessage &&
		typeof summaryMessage.content === "string" &&
		summaryMessage.content.length > config.etc.limitOfSummary
	) {
		// 收集所有日期行的位置（能解析出日期的行才可作为日期段边界）
		const dateLineStarts: number[] = [];
		for (const match of summaryMessage.content.matchAll(DATE_LINE_REGEX)) {
			// 正则匹配成功时捕获组必然存在；日期格式异常的不作为段边界
			if (parseSummaryDate(match[0]!) !== null) {
				dateLineStarts.push(match.index);
			}
		}
		// 只剩一个日期段时无法继续精简，退出循环
		if (dateLineStarts.length <= 1) break;

		// 删除日期最早的日期段：该段从它的日期行开始，到下一个日期行之前结束
		// 总结消息中的日期行按时间从旧到新排列（由总结生成逻辑保证），
		// matchAll 按字符串位置返回，因此第一个位置就是最早的一段，无需排序
		const earliest = dateLineStarts[0];
		const next = dateLineStarts[1];
		if (earliest === undefined || next === undefined) break;
		summaryMessage.content =
			summaryMessage.content.slice(0, earliest) +
			summaryMessage.content.slice(next);
	}
};

/**
 * 自动优化上下文，类似AI Coding Agent的/compact命令
 */
const autoCompact = async (
	messages: AI.Message[],
	/** 提供token消耗情况时，能更准确地判断上下文是否达到阈值 */
	usage?: ChatCompletions.Usage,
) => {
	await compactMessages(messages, modelRef.current, {
		usage,
		...config.etc,
		summarizeOptions: {
			systemPrompt: SUMMARIZE_PROMPT,
		},
	});

	// 总结出的消息可能超长，去掉日期较早的摘要
	removeOldSummaries(messages);
};

export default autoCompact;
