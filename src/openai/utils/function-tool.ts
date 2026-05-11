import type { FunctionTool } from "@/openai/schemas/tool.js";

export const defineFunctionTool = (config: FunctionTool) => ({
	type: "function" as const,
	function: config,
});
