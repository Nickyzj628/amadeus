import { compactStr, fetcher, to } from "@nickyzj2023/utils";
import { jsonSchema } from "ai";
import { array, number, object, safeParse, string } from "valibot";

export interface SearchWebInput {
	query: string;
}

const SearchResponseSchema = object({
	results: array(
		object({
			url: string(),
			title: string(),
			content: string(),
			score: number(),
		}),
	),
});

const SearchErrorSchema = object({
	error: string(),
});

const searchApi = fetcher("https://api.tavily.com", {
	headers: {
		Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
	},
});

export const searchWebTool = {
	description: "使用 Tavily API 搜索网络内容，获取实时资讯和搜索结果",
	inputSchema: jsonSchema({
		type: "object",
		properties: {
			query: {
				type: "string",
				description: "搜索关键词",
			},
		},
		required: ["query"],
	}),
	execute: async ({ query }: SearchWebInput) => {
		if (!process.env.TAVILY_API_KEY) {
			return "错误：未配置 TAVILY_API_KEY 环境变量";
		}

		const [error, response] = await to<unknown>(
			searchApi.post("/search", { query }),
		);

		if (error) {
			return `搜索失败：${error.message}`;
		}

		const errorCheck = safeParse(SearchErrorSchema, response);
		if (errorCheck.success && "error" in (response as any)) {
			return `搜索失败：${errorCheck.output.error}`;
		}

		const validation = safeParse(SearchResponseSchema, response);
		if (!validation.success) {
			return `搜索失败：${validation.issues[0].message}`;
		}

		const { results } = validation.output;
		if (!results?.length) {
			return "搜索失败：结果为空";
		}

		const lines = results
			.filter((result) => result.score > 0.5)
			.map((result, i) => {
				const line = `${i + 1}. ${result.title}
- 摘要：${compactStr(result.content, { maxLength: 200 })}
- 来源：${result.url}
- 置信度：${result.score.toFixed(2)}`;
				return line;
			});

		return [`"${query}"的检索结果：`, ...lines].join("\n\n");
	},
};
