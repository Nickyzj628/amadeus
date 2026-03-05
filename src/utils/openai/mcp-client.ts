import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { cwd } from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { log } from "@nickyzj2023/utils";
import { jsonSchema } from "ai";

// MCP 配置类型
interface McpStdioConfig {
	type?: "stdio";
	command: string;
	args: string[];
	env?: Record<string, string>;
}

interface McpHttpConfig {
	type: "streamable_http";
	url: string;
	headers?: Record<string, string>;
}

type McpServerConfig = McpStdioConfig | McpHttpConfig;

// MCP 配置文件路径（项目根目录）
const MCP_CONFIG_PATH = resolve(cwd(), "mcp.config.json");

// 加载配置
const mcpServers: Record<string, McpServerConfig> = JSON.parse(
	readFileSync(MCP_CONFIG_PATH, "utf-8"),
);

const clients = new Map<string, Client>();
const connecting = new Map<string, Promise<Client>>();

// 创建传输层
const createTransport = (config: McpServerConfig): Transport => {
	if (config.type === "streamable_http") {
		return new StreamableHTTPClientTransport(new URL(config.url), {
			requestInit: config.headers ? { headers: config.headers } : undefined,
		});
	}

	// Stdio 传输（默认）
	const args = config.args.map((arg) =>
		arg.startsWith("src/") ? join(cwd(), arg) : arg,
	);

	return new StdioClientTransport({
		command: config.command,
		args,
		env: config.env || {},
	});
};

// 初始化 MCP Client（带连接复用）
const initMcpClient = async (serverName: string) => {
	if (clients.has(serverName)) {
		return clients.get(serverName)!;
	}

	if (connecting.has(serverName)) {
		return connecting.get(serverName)!;
	}

	const config = mcpServers[serverName];
	if (!config) {
		throw new Error(`MCP Server "${serverName}" 配置不存在`);
	}

	const promise = (async () => {
		const client = new Client(
			{ name: `amadeus-client-${serverName}`, version: "1.0.0" },
			{ capabilities: {} },
		);

		await client.connect(createTransport(config));
		clients.set(serverName, client);

		log(`${serverName} MCP 客户端已连接`);
		return client;
	})();

	connecting.set(serverName, promise);

	try {
		return await promise;
	} finally {
		connecting.delete(serverName);
	}
};

/** 获取指定 MCP 工具 */
export const getMcpTool = async (serverName: string, toolName: string) => {
	const client = await initMcpClient(serverName);
	const toolsResult = await client.listTools();
	const tool = toolsResult.tools.find((t) => t.name === toolName);

	if (!tool) {
		throw new Error(`MCP Server "${serverName}" 中未找到工具 "${toolName}"`);
	}

	return {
		description: tool.description || "",
		inputSchema: jsonSchema(tool.inputSchema),
		execute: async (args: Record<string, unknown>) => {
			const result = await client.callTool({ name: toolName, arguments: args });
			const content = result.content as Array<{ type: string; text?: string }>;
			const text = content
				.filter((c) => c.type === "text")
				.map((c) => c.text || "")
				.join("\n");

			log([toolName, args, text]);
			return text;
		},
	};
};

/** 获取天气工具 */
export const getWeatherTool = () => getMcpTool("amadeus", "get_weather");

/** 获取 decode_abbr 工具 */
export const getDecodeAbbrTool = () => getMcpTool("amadeus", "decode_abbr");

/** 获取 web_search 工具 */
export const getWebSearchTool = () => getMcpTool("amadeus", "web_search");

/** 获取 fetch 工具 */
export const getFetchTool = () => getMcpTool("fetch", "fetch");

/** 关闭所有 MCP Client */
export const closeMcpClients = async () => {
	for (const [name, client] of clients) {
		await client.close();
		log(`关闭 MCP 客户端：${name}`);
	}
	clients.clear();
};

/** 关闭指定 MCP Client */
export const closeMcpClient = async (serverName: string) => {
	const client = clients.get(serverName);
	if (client) {
		await client.close();
		clients.delete(serverName);
		log(`关闭 MCP 客户端：${serverName}`);
	}
};
