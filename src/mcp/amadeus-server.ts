#!/usr/bin/env node
/**
 * Amadeus MCP Server
 * 整合多个工具到单一服务器，包括：
 * - web_search: 网络搜索（Tavily）
 * - decode_abbr: 拼音缩写解密
 * - get_weather: 天气查询

 * 使用方式:
 * - npx tsx src/mcp/amadeus-server.ts
 * - 或在 Claude Desktop/其他 MCP Client 中配置
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { compactStr, fetcher, log, to } from "@nickyzj2023/utils";
import { array, number, object, optional, safeParse, string } from "valibot";
import { z } from "zod";

// ============================================================
// Web Search 工具
// ============================================================

const SearchResponseSchema = object({
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

const SearchErrorSchema = object({
	id: string(),
	error: string(),
});

const searchApi = fetcher("https://api.tavily.com", {
	headers: {
		Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
	},
});

// ============================================================
// Decode Abbr 工具
// ============================================================

const DecodeResponseSchema = array(
	object({
		name: string(),
		trans: optional(array(string())),
	}),
);

const decodeApi = fetcher("https://lab.magiconch.com/api/nbnhhsh");

// ============================================================
// Weather 工具
// ============================================================

const WeatherResponseSchema = object({
	results: array(
		object({
			location: object({
				id: string(),
				name: string(),
				country: string(),
				path: string(),
				timezone: string(),
				timezone_offset: string(),
			}),
			daily: array(
				object({
					date: string(),
					text_day: string(),
					code_day: string(),
					text_night: string(),
					code_night: string(),
					high: string(),
					low: string(),
					rainfall: string(),
					precip: string(),
					wind_direction: string(),
					wind_direction_degree: string(),
					wind_speed: string(),
					wind_scale: string(),
					humidity: string(),
				}),
			),
			last_update: string(),
		}),
	),
});

const weatherApi = fetcher("https://api.seniverse.com/v3", {
	params: {
		key: process.env.SENIVERSE_PRIVATE_KEY || "",
	},
});

const getRelativeDate = (date: string) => {
	const dates = ["今天", "明天", "后天"];
	return dates[new Date(date).getDate() - new Date().getDate()] ?? date;
};

// ============================================================
// 创建服务器
// ============================================================

const server = new McpServer({
	name: "amadeus-mcp",
	version: "1.0.0",
});

// 注册 Web Search 工具
server.registerTool(
	"web_search",
	{
		title: "搜索网络内容",
		description: "使用 Tavily API 搜索网络内容，获取实时资讯和搜索结果",
		inputSchema: {
			query: z.string().describe("搜索关键词"),
		},
	},
	async ({ query }) => {
		if (!process.env.TAVILY_API_KEY) {
			return {
				content: [
					{
						type: "text",
						text: "错误：未配置 TAVILY_API_KEY 环境变量",
					},
				],
			};
		}

		const [error, response] = await to<unknown>(
			searchApi.post("/search", { query }),
		);

		if (error) {
			return {
				content: [
					{
						type: "text",
						text: `搜索失败：${error.message}`,
					},
				],
			};
		}

		const errorCheck = safeParse(SearchErrorSchema, response);
		if (errorCheck.success && "error" in (response as any)) {
			return {
				content: [
					{
						type: "text",
						text: `搜索失败：${errorCheck.output.error}`,
					},
				],
			};
		}

		const validation = safeParse(SearchResponseSchema, response);
		if (!validation.success) {
			return {
				content: [
					{
						type: "text",
						text: `搜索失败：${validation.issues[0].message}`,
					},
				],
			};
		}

		const { results } = validation.output;
		if (!results || !results.length) {
			return {
				content: [
					{
						type: "text",
						text: "搜索失败：结果为空",
					},
				],
			};
		}

		const text = [
			`"${query}"的检索结果：`,
			...results
				.filter((result) => result.score > 0.5)
				.map(
					(result, i) => `${i + 1}. ${result.title}
- 摘要：${compactStr(result.content, { maxLength: 200 })}
- 来源：${result.url}
- 置信度：${result.score.toFixed(2)}`,
				),
		].join("\n\n");

		return {
			content: [
				{
					type: "text",
					text,
				},
			],
		};
	},
);

// 注册 Decode Abbr 工具
server.registerTool(
	"decode_abbr",
	{
		title: "解密拼音缩写",
		description: "把用户输入的未知拼音缩写转换成可能的释义",
		inputSchema: {
			abbr: z.string().describe("待转换的拼音缩写"),
		},
	},
	async ({ abbr }) => {
		const [error, response] = await to<unknown>(
			decodeApi.post("/guess", { text: abbr }),
		);

		if (error) {
			return {
				content: [
					{
						type: "text",
						text: `缩写解密失败：${error.message}`,
					},
				],
			};
		}

		const validation = safeParse(DecodeResponseSchema, response);
		if (!validation.success) {
			return {
				content: [
					{
						type: "text",
						text: `缩写解密失败：${validation.issues[0].message}`,
					},
				],
			};
		}

		const item = validation.output[0];
		if (!item) {
			return {
				content: [
					{
						type: "text",
						text: "缩写解密失败：响应体为空",
					},
				],
			};
		}

		const items = item.trans || [];
		if (items.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: "未找到任何缩写释义",
					},
				],
			};
		}

		return {
			content: [
				{
					type: "text",
					text: `用户想说的可能是：${items.join("、")}`,
				},
			],
		};
	},
);

// 注册 Weather 工具
server.registerTool(
	"get_weather",
	{
		title: "查询天气",
		description: "获取指定城市三日内的天气情况",
		inputSchema: {
			city: z.string().describe("城市名称，如上海、哈尔滨"),
		},
	},
	async ({ city }) => {
		const key = process.env.SENIVERSE_PRIVATE_KEY;
		if (!key) {
			return {
				content: [
					{
						type: "text",
						text: "天气预报查询失败：未配置 SENIVERSE_PRIVATE_KEY 环境变量",
					},
				],
			};
		}

		const [error, response] = await to<unknown>(
			weatherApi.get("/weather/daily.json", {
				params: { location: city },
			}),
		);

		if (error) {
			return {
				content: [
					{
						type: "text",
						text: `天气查询失败：${(error as any).status || error.message}`,
					},
				],
			};
		}

		const dataValidation = safeParse(WeatherResponseSchema, response);
		if (!dataValidation.success) {
			return {
				content: [
					{
						type: "text",
						text: `天气查询失败：${dataValidation.issues[0].message}`,
					},
				],
			};
		}

		const result = dataValidation.output.results[0];
		if (!result) {
			return {
				content: [
					{
						type: "text",
						text: "没有查询到天气信息",
					},
				],
			};
		}

		const text = [
			`${result.location.name}天气：`,
			...result.daily.map((day) => {
				const climate =
					day.text_day === day.text_night
						? day.text_day
						: `${day.text_day}转${day.text_night}`;
				return `${getRelativeDate(day.date)}：${climate}，${day.low}°C ~ ${day.high}°C`;
			}),
			`数据更新时间：${new Date(result.last_update).toLocaleString()}`,
		].join("\n");

		return {
			content: [
				{
					type: "text",
					text,
				},
			],
		};
	},
);

// ============================================================
// 启动服务器
// ============================================================

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	log(
		"Amadeus MCP 服务器已启动，包含工具：web_search, decode_abbr, get_weather",
	);
}

main().catch((error) => {
	log("Amadeus MCP 服务器运行出错:", error);
	process.exit(1);
});
