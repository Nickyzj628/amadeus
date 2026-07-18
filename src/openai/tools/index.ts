import { logger, omit } from "@nickyzj2023/utils";
import config from "@/config.js";
import { MCPRouter } from "@/openai/utils/mcp.js";
import changeModel from "./changeModel.js";
import decodeAbbr from "./decodeAbbr.js";
import denyReply from "./denyReply.js";
import getWeather from "./getWeather.js";

const functionTools = [changeModel, getWeather, decodeAbbr, denyReply];

const mcpRouter = new MCPRouter();
for (const [name, server] of Object.entries(config.mcpServers)) {
	await mcpRouter.addClient(name, server.url, omit(server, ["type", "url"]));
}
const mcpOpenAITools = await mcpRouter.getOpenAITools();

/**
 * 可直接传入 OpenAI API /chat-completions 的 tools 请求体
 */
export const openaiTools = [...functionTools, ...mcpOpenAITools];
openaiTools.forEach((tool) => {
	logger(`启用工具：${tool.function.name}`);
});
