import type { ChatCompletionFunctionTool } from "openai/resources";

export const defineTool = (
	tool: ChatCompletionFunctionTool,
	handle: (params: Record<string, any>) => string | Promise<string>,
) => ({
	tool,
	handle,
});

export const validateArgs = <T extends ReturnType<typeof defineTool>>(
	args: Record<string, any>,
	item: T,
): args is Parameters<T["handle"]>[0] => {
	const propKeys = Object.keys(item.tool.function.parameters?.properties ?? {});
	for (const key of propKeys) {
		if (!(key in args)) {
			throw new Error(`缺少参数${key}`);
		}
	}
	return true;
};
