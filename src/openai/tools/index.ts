import { estimateTextTokens } from "@nickyzj2023/ai";
import { loadMCPTools } from "@nickyzj2023/ai/mcp";
import { getWeather } from "@nickyzj2023/ai/tools";
import { logger } from "@nickyzj2023/utils";
import config from "@/config.js";
import changeModel from "./change-model.js";
import decodeAbbr from "./decode-abbr.js";
import deleteMemory from "./delete-memory.js";
import generateImage from "./generate-image.js";
import loadMemory from "./load-memory.js";
import saveMemory from "./save-memory.js";
import skipReply from "./skip-reply.js";
import webFetch from "./web-fetch.js";
import webSearch from "./web-search.js";

/**
 * 可直接传入/chat/completions的tools参数
 */
export const openaiTools = [
	changeModel,
	getWeather,
	decodeAbbr,
	skipReply,
	loadMemory,
	saveMemory,
	deleteMemory,
];

// 提供了特定平台的apikey时，启用特定工具
if (config.apiKeys.deepseek) {
	openaiTools.push(webSearch, webFetch);
}
if (config.apiKeys.agnes) {
	openaiTools.push(generateImage);
}

// 提供了MCP Servers时，启用MCP工具
if (config.mcpServers) {
	openaiTools.push(...(await loadMCPTools(config.mcpServers)));
}

openaiTools.forEach((tool) => {
	logger(
		`启用工具：${tool.function.name}（~${estimateTextTokens(JSON.stringify(tool.function))}tokens）`,
	);
});
