import { log } from "@nickyzj2023/utils";
import config from "@/config.js";
import { MCPRouter } from "@/openai/utils/mcp.js";
import changeModel from "./changeModel.js";
import decodeAbbr from "./decodeAbbr.js";
import getWeather from "./getWeather.js";

const functionTools = [changeModel, getWeather, decodeAbbr];
log(["已启用 Function Calling Tools", functionTools.map((tool) => tool)]);
console.log();

const mcpRouter = new MCPRouter();
await Promise.all(
	Object.entries(config.mcpServers).map(async ([name, server]) => {
		await mcpRouter.addClient(name, server.url, {
			ignoredToolNames: server.ignoredToolNames,
		});
	}),
);
const mcpOpenAITools = await mcpRouter.getOpenAITools();
log(["已启用 MCP Tools", ...mcpOpenAITools]);
console.log();

/**
 * 可直接传入 OpenAI API /chat-completions 的 tools 请求体
 */
export const openaiTools = [...functionTools, ...mcpOpenAITools];

/**
 * 可直接传入 @nickyzj2023/utils ai.chatCompletions extraBody 的 tools 处理函数表
 */
export const toolHandlers = Object.fromEntries(
	[...functionTools, ...mcpOpenAITools]
		.filter((tool) => "_handler" in tool.function)
		.map((tool) => {
			const name = tool.function.name;
			return [
				name,
				async (args: any) => {
					log(`调用工具${name}(${JSON.stringify(args)})`);

					const result = await tool.function._handler!(args);
					log(result);

					return result;
				},
			];
		}),
);
