import { join } from "node:path";
import { cwd } from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { log } from "@nickyzj2023/utils";
import { jsonSchema } from "ai";
import appConfig from "../../config.js";
import type { McpServerConfig } from "../../schemas/config.js";

const clients = new Map<string, Client>();
const connecting = new Map<string, Promise<Client>>();

// 缓存所有 MCP 工具
let cachedMcpTools: McpTool[] | null = null;
let initializingPromise: Promise<void> | null = null;

/** MCP 工具定义 */
export interface McpTool {
	name: string;
	server: string;
	description: string;
	inputSchema: ReturnType<typeof jsonSchema>;
	execute: (args: Record<string, unknown>) => Promise<string>;
}

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

	const config = (appConfig.mcpServers as Record<string, McpServerConfig>)[
		serverName
	];
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
export const getMcpTool = async (
	serverName: string,
	toolName: string,
): Promise<McpTool> => {
	const client = await initMcpClient(serverName);
	const toolsResult = await client.listTools();
	const tool = toolsResult.tools.find((t) => t.name === toolName);

	if (!tool) {
		throw new Error(`MCP Server "${serverName}" 中未找到工具 "${toolName}"`);
	}

	return {
		name: toolName,
		server: serverName,
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

/** 获取所有 MCP 工具（首次调用时会自动初始化） */
export const getAllMcpTools = async (): Promise<McpTool[]> => {
	// 如果已有缓存，直接返回
	if (cachedMcpTools !== null) {
		return cachedMcpTools;
	}

	// 如果正在初始化中，等待完成
	if (initializingPromise !== null) {
		await initializingPromise;
		return cachedMcpTools!;
	}

	// 首次调用，执行初始化
	initializingPromise = initMcpToolsInternal();
	await initializingPromise;
	initializingPromise = null;
	return cachedMcpTools!;
};

/** 内部初始化函数 */
const initMcpToolsInternal = async (): Promise<void> => {
	if (cachedMcpTools !== null) {
		return;
	}

	const tools: McpTool[] = [];
	const serverToolsMap = new Map<string, string[]>();

	for (const serverName of Object.keys(appConfig.mcpServers)) {
		try {
			const client = await initMcpClient(serverName);
			const toolsResult = await client.listTools();

			const toolNames: string[] = [];
			for (const tool of toolsResult.tools) {
				tools.push({
					name: tool.name,
					server: serverName,
					description: tool.description || "",
					inputSchema: jsonSchema(tool.inputSchema),
					execute: async (args: Record<string, unknown>) => {
						const result = await client.callTool({
							name: tool.name,
							arguments: args,
						});
						const content = result.content as Array<{
							type: string;
							text?: string;
						}>;
						const text = content
							.filter((c) => c.type === "text")
							.map((c) => c.text || "")
							.join("\n");

						log([tool.name, args, text]);
						return text;
					},
				});
				toolNames.push(tool.name);
			}

			if (toolNames.length > 0) {
				serverToolsMap.set(serverName, toolNames);
			}
		} catch (error) {
			log(`获取 MCP 服务器 ${serverName} 的工具列表失败: ${error}`);
		}
	}

	cachedMcpTools = tools;

	// 打印详细的加载信息
	const serverCount = serverToolsMap.size;
	log(`MCP 工具初始化完成: 共 ${serverCount} 个服务器, ${tools.length} 个工具`);

	for (const [serverName, toolNames] of serverToolsMap) {
		log(`  - ${serverName}: ${toolNames.join(", ")}`);
	}
};

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
