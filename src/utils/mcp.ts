import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { defineFunctionTool } from "./openai/function-tool.js";

export class MCPRouter {
	clients: Client[];
	toolClientMap: Map<string, Client>;
	constructor() {
		this.clients = [];
		this.toolClientMap = new Map();
	}

	/** 注册一个新的 MCP 客户端 */
	async addClient(
		name: string,
		url: string,
		options?: { ignoredToolNames?: string[] },
	) {
		const transport = new StreamableHTTPClientTransport(new URL(url));
		const client = new Client({ name, version: "1.0.0" });
		await client.connect(transport);

		this.clients.push(client);

		// 建立工具-客户端映射
		const { tools } = await client.listTools();
		tools
			.filter((tool) => !options?.ignoredToolNames?.includes(tool.name))
			.forEach((tool) => {
				this.toolClientMap.set(tool.name, client);
			});

		return client;
	}

	/** 返回 OpenAI API 兼容的 tools 请求体 */
	async getOpenAITools() {
		const result = [];
		for (const client of this.clients) {
			const { tools } = await client.listTools();
			result.push(
				...tools
					.filter((tool) => this.toolClientMap.has(tool.name))
					.map((tool) =>
						defineFunctionTool({
							name: tool.name,
							description: tool.description ?? "",
							parameters: tool.inputSchema,
							_handler: (args) =>
								client.callTool({
									name: tool.name,
									arguments: args,
								}),
						}),
					),
			);
		}
		return result;
	}
}
