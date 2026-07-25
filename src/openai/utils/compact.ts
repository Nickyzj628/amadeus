import type { AI, ChatCompletions } from "@nickyzj2023/utils";
import { compactMessages as compact } from "@nickyzj2023/utils";
import config from "@/config.js";
import { SUMMARIZE_PROMPT } from "./constants.js";
import { modelRef } from "./model.js";

/**
 * 自动优化上下文，类似AI Coding Agent的/compact命令
 */
const compactMessages = async (
	messages: AI.Message[],
	options?: {
		/** 提供token消耗情况时，能更准确地判断上下文是否达到阈值 */
		usage?: ChatCompletions.Usage;
	},
) => {
	return compact(messages, modelRef.current, {
		...options,
		...config.etc,
		summarizeOptions: {
			keepPercent: 0.2,
			model: modelRef.current,
			systemPrompt: SUMMARIZE_PROMPT,
		},
	});
};

export default compactMessages;
