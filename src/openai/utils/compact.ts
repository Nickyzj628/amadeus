import type { AI, ChatCompletions } from "@nickyzj2023/utils";
import { compactMessages as compact } from "@nickyzj2023/utils";
import config from "@/config.js";
import { SUMMARIZE_PROMPT } from "./constants.js";
import { modelRef } from "./model.js";

/**
 * 自动优化上下文，类似AI Coding Agent的/compact命令
 */
const autoCompact = async (
	messages: AI.Message[],
	/** 提供token消耗情况时，能更准确地判断上下文是否达到阈值 */
	usage?: ChatCompletions.Usage,
) => {
	return compact(messages, modelRef.current, {
		usage,
		...config.etc,
		summarizeOptions: {
			systemPrompt: SUMMARIZE_PROMPT,
		},
	});
};

export default autoCompact;
