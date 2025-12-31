import { isObject } from "@nickyzj2023/utils";
import type { ChatCompletionFunctionTool } from "openai/resources";

export const defineTool = (
	tool: ChatCompletionFunctionTool,
	handle: (params: Record<string, any>) => string | Promise<string>,
) => ({
	tool,
	handle,
});

/** 校验大模型调用工具时是否传递必要参数 */
export const validateArgs = <T extends ReturnType<typeof defineTool>>(
	args: Record<string, any>,
	item: T,
): args is Parameters<T["handle"]>[0] => {
	const { parameters } = item.tool.function;
	if (!parameters) {
		return true;
	}

	const { properties, required } = parameters;
	if (!Array.isArray(required) || !isObject(properties)) {
		return true;
	}

	for (const key in properties) {
		if (!required.includes(key)) {
			continue;
		}
		if (!(key in args)) {
			throw new Error(`缺少参数${key}`);
		}
	}

	return true;
};
