import { estimateTextTokens, loadMCPTools } from "@nickyzj2023/ai";
import { logger } from "@nickyzj2023/utils";
import config from "@/config.js";
import changeModel from "./changeModel.js";
import decodeAbbr from "./decodeAbbr.js";
import deleteMemory from "./deleteMemory.js";
import getWeather from "./getWeather.js";
import saveMemory from "./saveMemory.js";
import skipReply from "./skipReply.js";

const functionTools = [changeModel, getWeather, decodeAbbr, skipReply];
const mcpTools = await loadMCPTools(config.mcpServers ?? {});
if (config.apiKeys.mem0ApiKey) {
	functionTools.push(saveMemory, deleteMemory);
}

/**
 * 可直接传入 OpenAI API /chat-completions 的 tools 请求体
 */
export const openaiTools = [...functionTools, ...mcpTools];
openaiTools.forEach((tool) => {
	logger(
		`启用工具：${tool.function.name}（~${estimateTextTokens(JSON.stringify(tool.function))}tokens）`,
	);
});
