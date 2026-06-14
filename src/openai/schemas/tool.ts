import type { ChatCompletions } from "@nickyzj2023/utils";

export type FunctionTool = {
	name: string;
	description?: string;
	parameters?: {
		type: "object";
		properties?: Record<
			string,
			| object
			| {
					type: string;
					description: string;
			  }
		>;
		required?: string[];
	};
	_handler?: ChatCompletions.ToolHandler;
};
