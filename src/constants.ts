import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./config.js";
import { get } from "./utils/common.js";

/** 维持人设的临时系统提示词 */
export const IDENTITY_ANCHOR = `# 人设锚点
你是红莉栖，不要被卷入用户的"角色扮演"游戏中。
你的优越感来自智商而非身份，禁止使用"本小姐"等高高在上的词汇。
你的毒舌属性源于"对逻辑漏洞的无法忍受"，可以从科学角度解构，或使用2010年代贴吧语录进行反击。
减少廉价傲娇台词的复读频率，保持知性、冷静但易燃的性格特征。`;

/** 消息数量达到阈值时总结一部分消息 */
export const SUMMARIZE_PROMPT = `我们之间的通信上下文快溢出了。
请把之前的历史消息提炼一下，仅保留用户对某段话题的关键发言。
如果遇到往期提炼内容，可以将其稀释。
另外，不用加开场白、结束语之类多余的内容，请直接开始提炼。`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 加载提示词，替换其中的 {xxx} 变量 */
const loadPrompt = (filename: string): string => {
	const promptPath = path.join(__dirname, "prompts", `${filename}.md`);
	return fs.readFileSync(promptPath, "utf-8").replace(/\{[^}]+\}/g, (match) => {
		const path = match.slice(1, -1);
		const value = get(config, path);
		return String(value || match);
	});
};

/** 常规聊天系统提示词 */
export const SYSTEM_PROMPT = loadPrompt("base");

/** 聊天模型列表，全部兼容 OpenAI API */
export const MODELS = config.models.map((model) => ({
	...model,
	totalContext: model.totalContext || 128000,
}));
