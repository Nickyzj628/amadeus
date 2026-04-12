export type FunctionTool = {
	name: string;
	description: string;
	parameters: {
		type: "object";
		properties: Record<
			string,
			{
				type: string;
				description: string;
			}
		>;
		required?: string[];
	};
	_execute: (args: Record<string, any>) => Promise<any>;
};
