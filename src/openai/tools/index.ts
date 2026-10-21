import { estimateTextTokens, getWeather } from "@nickyzj2023/ai";
import { loadMCPTools } from "@nickyzj2023/ai/mcp";
import { logger } from "@nickyzj2023/utils";
import config from "@/config.js";
import changeModel from "./change-model.js";
import decodeAbbr from "./decode-abbr.js";
import deleteMemory from "./delete-memory.js";
import loadMemory from "./load-memory.js";
import saveMemory from "./save-memory.js";
import skipReply from "./skip-reply.js";
import webFetch from "./web-fetch.js";
import webSearch from "./web-search.js";

const functionTools = [
	changeModel,
	getWeather,
	decodeAbbr,
	skipReply,
	loadMemory,
	saveMemory,
	deleteMemory,
	webSearch,
	webFetch,
];
const mcpTools = await loadMCPTools(config.mcpServers ?? {});

/**
 * 可直接传入 OpenAI API /chat-completions 的 tools 请求体
 */
export const openaiTools = [...functionTools, ...mcpTools];
openaiTools.forEach((tool) => {
	logger(
		`启用工具：${tool.function.name}（~${estimateTextTokens(JSON.stringify(tool.function))}tokens）`,
	);
});
