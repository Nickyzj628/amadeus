import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export class MCPRouter {
  clients: Client[];
  toolClientMap: Map<string, Client>;
  constructor() {
    this.clients = [];
    this.toolClientMap = new Map();
  }

  // 注册一个新的 MCP 客户端
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

  // 构建 OpenAI API 兼容的 tools 请求体
  async getOpenAITools() {
    const result = [];
    for (const client of this.clients) {
      const { tools } = await client.listTools();
      result.push(
        ...tools
          .filter((tool) => this.toolClientMap.has(tool.name))
          .map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema,
            },
          })),
      );
    }
    return result;
  }

  // 调用指定工具
  async callTool(toolName: string, args: Record<string, any>) {
    const client = this.toolClientMap.get(toolName);
    if (!client) {
      throw new Error(`找不到工具${toolName}对应的客户端`);
    }
    return client.callTool({
      name: toolName,
      arguments: args,
    });
  }
}
