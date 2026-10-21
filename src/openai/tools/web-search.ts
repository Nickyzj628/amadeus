import { defineTool } from "@nickyzj2023/ai";
import { fetcher, to } from "@nickyzj2023/utils";
import {
	array,
	nullable,
	number,
	object,
	optional,
	safeParse,
	string,
} from "valibot";
import config from "@/config.js";

const ResponseSchema = object({
	results: array(
		object({
			/** 排序分数，0～3分，综合考虑相关性、权威性、时效性等维度。大于等于1.5分为优质结果。 */
			rerank_score: optional(nullable(number())),
			/** 网页权威性，0～4（-1表示未知）；大于等于3为极权威结果。 */
			authority: optional(nullable(number())),
			/** 网页标题 */
			title: string(),
			/** 网页链接 */
			url: string(),
			/** 网页内容摘要 */
			summary: optional(nullable(string())),
			/** 站点名称 */
			site_name: optional(nullable(string())),
			/** 发布时间，ISO 8601 字符串 */
			date: optional(nullable(string())),
		}),
	),
});

// 相关性权重给高一点，搜出来跑不跑题才是第一位
const RELEVANCE_WEIGHT = 0.65;
const AUTHORITY_WEIGHT = 0.35;

/** 两个原始分对模型太抽象，揉成一个档位，扫一眼就知道这条值不值得看 */
const toQuality = (rerankScore?: number | null, authority?: number | null) => {
	// 两边各自归一化到0~1，缺的或者-1（未知）就别参与，省得把均值拽偏
	const parts: { score: number; weight: number }[] = [];
	if (typeof rerankScore === "number" && rerankScore >= 0) {
		parts.push({ score: Math.min(rerankScore / 3, 1), weight: RELEVANCE_WEIGHT });
	}
	if (typeof authority === "number" && authority >= 0) {
		parts.push({ score: Math.min(authority / 4, 1), weight: AUTHORITY_WEIGHT });
	}
	if (!parts.length) {
		return "unknown";
	}

	const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
	const score =
		parts.reduce((sum, part) => sum + part.score * part.weight, 0) / totalWeight;

	// 阈值拍脑袋定的，0.7往上算优质，0.4以下基本可以不点开了
	if (score >= 0.7) {
		return "high";
	}
	if (score >= 0.4) {
		return "medium";
	}
	return "low";
};

export default defineTool(
	"web_search",
	"按query搜索网页，返回结构化的结果列表",
	{
		query: {
			type: "string",
			description:
				"搜索词。支持site:、-site:、引号等搜索语法。必须为1-128个Unicode字符，且不能全为空白",
			required: true,
		},
	},
	async ({ query }) => {
		const { deepseek: token } = config.apiKeys;
		if (!token) {
			return "搜索失败：请先配置config.apiKeys.deepseek，才能获得DeepSeek联网搜索工具的使用能力";
		}

		const api = fetcher("https://api.deepseek.com/v1", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});
		const [error, response] = await to(api.post("/tools/search", { query }));
		if (error) {
			return `搜索失败：${error.message}`;
		}

		const validation = safeParse(ResponseSchema, response);
		if (!validation.success) {
			return `搜索成功，但数据结构校验失败：${validation.issues[0].message}`;
		}

		const { results } = validation.output;
		if (!results.length) {
			return "搜索成功，但结果是空的";
		}

		// 原始分不往外带了，换成档位，模型判断起来省事
		return results.map(({ rerank_score, authority, ...result }) => ({
			...result,
			quality: toQuality(rerank_score, authority),
		}));
	},
);
