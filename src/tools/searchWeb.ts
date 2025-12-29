import { fetcher, to } from "@nickyzj2023/utils";
import type { ChatCompletionTool } from "openai/resources";
import {
	array,
	boolean,
	type InferOutput,
	literal,
	number,
	object,
	optional,
	pipe,
	safeParse,
	string,
	union,
	url,
} from "valibot";

const ResponseSchema = object({
	credits: number(),
	searchParameters: object({
		q: string(),
		scope: string(),
		size: number(),
		searchFile: boolean(),
		includeSummary: boolean(),
		includeRawContent: boolean(),
		conciseSnippet: boolean(),
		format: literal("chat_completions"),
	}),
	webpages: array(
		object({
			title: string(),
			link: pipe(string(), url()),
			score: union([literal("high"), literal("medium"), literal("low")]),
			snippet: string(),
			position: number(),
			// authors 和 date 是可选的，因为部分结果中不存在
			authors: optional(array(string())),
			date: optional(string()),
		}),
	),
	total: number(),
});
type Response = InferOutput<typeof ResponseSchema>;

const ErrorSchema = object({
	errCode: number(),
	errMsg: string(),
});
type Error = InferOutput<typeof ErrorSchema>;

const api = fetcher("https://metaso.cn/api/v1");

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
		const apiKey = Bun.env.METASO_API_KEY;
		if (!apiKey) {
			return "无法进行搜索：请先配置METASO_API_KEY环境变量";
		}

		const [error, response] = await to<Response | Error>(
			api.post(
				"/search",
				{
					q: query,
					scope: "webpage",
					size: 10,
					conciseSnippet: true,
				},
				{
					headers: {
						Authorization: `Bearer ${apiKey}`,
					},
				},
			),
		);
		if (error) {
			return `搜索失败：${error.message}`;
		}
		if ("errCode" in response) {
			return `搜索失败：${response.errMsg}`;
		}

		const validation = safeParse(ResponseSchema, response);
		if (!validation.success) {
			return `搜索失败：${validation.issues[0].message}`;
		}
		const { webpages } = validation.output;
		if (!webpages || !webpages.length) {
			return "搜索失败：结果为空";
		}

		return [
			`“${query}”的检索结果：`,
			...webpages
				.filter((webpage) => webpage.score === "high")
				.map((webpage, i) =>
					`
			  ${i + 1}. ${webpage.title}
					- 摘要：${webpage.snippet}
					- 来源：${webpage.link}（${webpage.date || "未注明日期"}）
			`.trim(),
				),
		].join("\n");
	},
};
