import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { type AI, defineTool, isObject } from "@nickyzj2023/utils";

export type McpServer = {
	type: "streamable_http" | "sse";
	url: string;
	headers?: Record<string, any>;
	ignoredToolNames?: string[];
};

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
		options?: Omit<McpServer, "type" | "url">,
	) {
		const transport = new StreamableHTTPClientTransport(new URL(url), {
			requestInit: { headers: options?.headers },
		});
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
					.map((tool) => {
						const _properties = (tool.inputSchema.properties ??
							{}) as AI.ToolDefinition["function"]["parameters"]["properties"];
						tool.inputSchema.required?.forEach((key) => {
							if (isObject(_properties[key])) {
								_properties[key].required = true;
							}
						});

						return defineTool(
							tool.name,
							tool.description ?? "",
							_properties,
							(args) =>
								client.callTool({
									name: tool.name,
									arguments: args,
								}),
						);
					}),
			);
		}
		return result;
	}
}
