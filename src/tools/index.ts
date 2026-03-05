import { changeModelTool } from "./changeModel.js";

export { changeModelTool } from "./changeModel.js";

/**
 * 本地工具的集合（不含 MCP 工具）
 * MCP 工具通过 mcp-client.ts 动态获取
 * 供 Vercel AI SDK 使用
 */
export const tools = {
	changeModel: changeModelTool,
};
