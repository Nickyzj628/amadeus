import fs from "node:fs";
import path from "node:path";
import { logger } from "@nickyzj2023/utils";
import { get } from "@/common/util.js";
import config from "@/config.js";

const PROMPTS_DIR = path.resolve("src/openai/prompts");

/** 加载提示词，替换其中的 {xxx} 变量 */
const loadPrompt = (filename: string): string => {
	const prompt = fs
		.readFileSync(path.join(PROMPTS_DIR, `${filename}.md`), "utf-8")
		.replace(/\{[^}]+\}/g, (match) => {
			const path = match.slice(1, -1);
			const value = get(config, path);
			return String(value || match);
		});
	logger(`载入提示词：${filename}`);
	return prompt;
};

/** 维持人设的临时系统提示词 */
export const IDENTITY_ANCHOR = loadPrompt("identity-anchor");

/** 消息数量达到阈值时总结一部分消息 */
export const SUMMARIZE_PROMPT = loadPrompt("summarize");

/** 常规聊天系统提示词 */
export const SYSTEM_PROMPT = loadPrompt("base");

/** 图片翻译提示词 */
export const VISION_UNDERSTANDING_PROMPT = loadPrompt("vision-understanding");
