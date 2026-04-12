import { log, omitBy } from "@nickyzj2023/utils";
import config from "@/config.js";
import { MCPRouter } from "@/utils/mcp.js";
import changeModel from "./changeModel.js";
import decodeAbbr from "./decodeAbbr.js";
import getWeather from "./getWeather.js";

console.time("加载 Function Calling 工具");
const functionTools = [changeModel, getWeather, decodeAbbr];
log(["已启用的 Function Calling 工具", functionTools.map((tool) => tool)]);
console.timeEnd("加载 Function Calling 工具");
console.log();

console.time("加载 MCP Clients");
const mcpRouter = new MCPRouter();
await Promise.all(
	Object.entries(config.mcpServers).map(async ([name, server]) => {
		await mcpRouter.addClient(name, server.url, {
			ignoredToolNames: server.ignoredToolNames,
		});
	}),
);
const mcpOpenAITools = await mcpRouter.getOpenAITools();
log(["已启用的 MCP 工具", ...mcpOpenAITools]);
console.timeEnd("加载 MCP Clients");
console.log();

/** 可直接传入 OpenAI API /chat-completions 的 tools 请求体 */
export const openaiTools = [
	...functionTools.map((tool) => ({
		type: "function",
		function: omitBy(tool, (key, value) => key.startsWith("_")),
	})),
	...mcpOpenAITools,
];

/** 执行 function/mcp 工具 */
export const executeTool = async (name: string, args: Record<string, any>) => {
	const functionTool = functionTools.find((tool) => tool.name === name);
	if (functionTool) {
		return await functionTool._execute?.(args);
	}

	const mcpResult = await mcpRouter.callTool(name, args);
	return mcpResult.content as string;
};
