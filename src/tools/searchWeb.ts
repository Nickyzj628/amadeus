import { compactStr, fetcher, to } from "@nickyzj2023/utils";
import type { ChatCompletionTool } from "openai/resources";
import {
	array,
	type InferOutput,
	nullable,
	number,
	object,
	safeParse,
	string,
} from "valibot";

// 定义主数据结构的 schema
const ResponseSchema = object({
	query: string(),
	results: array(
		object({
			url: string(),
			title: string(),
			content: string(),
			score: number(),
			raw_content: nullable(string()),
			favicon: string(),
		}),
	),
	response_time: number(),
	request_id: string(),
});
type Response = InferOutput<typeof ResponseSchema>;

const ErrorSchema = object({
	id: string(),
	error: string(),
});
type Error = InferOutput<typeof ErrorSchema>;

const api = fetcher("https://api.tavily.com", {
	headers: {
		Authorization: `Bearer ${Bun.env.TAVILY_API_KEY}`,
	},
});

export default {
	tool: {
		type: "function",
		function: {
			name: "searchWeb",
			description: "执行互联网搜索以获取实时信息、核查事实。",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "搜索关键词。",
					},
				},
				required: ["query"],
			},
		},
	} as ChatCompletionTool,

	handle: async ({ query }: { query: string }) => {
		if (!Bun.env.TAVILY_API_KEY) {
			return "无法执行搜索：请先配置TAVILY_API_KEY环境变量";
		}

		const [error, response] = await to<Response | Error>(
			api.post("/search", { query }),
		);
		if (error) {
			return `搜索失败：${error.message}`;
		}
		if ("error" in response) {
			return `搜索失败：${response.error}`;
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
			`“${query}”的检索结果：`,
			...results.map((result, i) =>
				compactStr(
					`
			  ${i + 1}. ${result.title}
					- 摘要：${result.content}
					- 来源：${result.url}
					- 置信度：${result.score}
			`,
					{ maxLength: Infinity },
				),
			),
		].join("\n");
	},
};
