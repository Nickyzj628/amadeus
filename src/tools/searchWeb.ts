import { compactStr, fetcher, to } from "@nickyzj2023/utils";
import { jsonSchema } from "ai";
import { array, number, object, safeParse, string } from "valibot";

const ResponseSchema = object({
	query: string(),
	results: array(
		object({
			url: string(),
			title: string(),
			content: string(),
			score: number(),
		}),
	),
	response_time: number(),
	request_id: string(),
});

const ErrorSchema = object({
	id: string(),
	error: string(),
});

const api = fetcher("https://api.tavily.com", {
	headers: {
		Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
	},
});

export const searchWebTool: any = {
	description: "获取实时资讯",
	inputSchema: jsonSchema({
		type: "object",
		properties: {
			query: {
				type: "string",
				description: "关键词",
			},
		},
		required: ["query"],
	}),
	execute: async ({ query }: { query: string }) => {
		if (!process.env.TAVILY_API_KEY) {
			return "无法执行搜索：请先配置TAVILY_API_KEY环境变量";
		}

		const [error, response] = await to<unknown>(api.post("/search", { query }));
		if (error) {
			return `搜索失败：${error.message}`;
		}

		// 检查是否是错误响应
		const errorCheck = safeParse(ErrorSchema, response);
		if (errorCheck.success && "error" in (response as any)) {
			return `搜索失败：${errorCheck.output.error}`;
		}

		const validation = safeParse(ResponseSchema, response);
		if (!validation.success) {
			return `搜索失败：${validation.issues[0].message}`;
		}

		const { results } = validation.output;
		if (!results || !results.length) {
			return "搜索失败：结果为空";
		}

		return [
			`"${query}"的检索结果：`,
			...results
				.filter((result) => result.score > 0.5)
				.map(
					(result, i) => `${i + 1}. ${result.title}
			- 摘要：${result.content}
			- 来源：${result.url}
			- 置信度：${result.score}`,
				),
		].join("\n");
	},
};
