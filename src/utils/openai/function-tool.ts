import type { FunctionTool } from "@/schemas/openai/tool.js";

export const defineFunctionTool = (config: FunctionTool) => ({
	type: "function" as const,
	function: config,
});
