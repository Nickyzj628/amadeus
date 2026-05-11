import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "./common/util.js";
import config from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 加载提示词，替换其中的 {xxx} 变量 */
const loadPrompt = (filename: string): string => {
	const promptPath = path.join(
		__dirname,
		"openai",
		"prompts",
		`${filename}.md`,
	);
	return fs.readFileSync(promptPath, "utf-8").replace(/\{[^}]+\}/g, (match) => {
		const path = match.slice(1, -1);
		const value = get(config, path);
		return String(value || match);
	});
};

/** 维持人设的临时系统提示词 */
export const IDENTITY_ANCHOR = loadPrompt("identity-anchor");

/** 消息数量达到阈值时总结一部分消息 */
export const SUMMARIZE_PROMPT = loadPrompt("summarize");

/** 常规聊天系统提示词 */
export const SYSTEM_PROMPT = loadPrompt("base");

/** 图片翻译提示词 */
export const IMAGE_UNDERSTANDING_PROMPT = loadPrompt("image-understanding");

/** 大模型列表，应该兼容 OpenAI API，支持工具调用，多模态 */
export const MODELS = config.models.map((model) => ({
	...model,
	totalContext: model.totalContext || 128000,
}));
