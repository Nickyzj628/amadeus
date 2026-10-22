import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	array,
	type InferOutput,
	looseObject,
	minLength,
	number,
	optional,
	picklist,
	pipe,
	record,
	safeParse,
	strictObject,
	string,
	unknown,
} from "valibot";

/** 模型配置，字段和@nickyzj2023/ai的Model对齐 */
const ModelSchema = looseObject({
	baseUrl: string(),
	model: optional(string()),
	apiKey: optional(string()),
	modalities: optional(array(picklist(["text", "image", "audio", "video"]))),
	context: optional(number()),
});

/** 单个远程MCP服务配置 */
const McpServerSchema = looseObject({
	type: picklist(["streamable_http", "sse"]),
	url: string(),
	headers: optional(record(string(), unknown())),
	ignoredToolNames: optional(array(string())),
});

/** 配置文件的完整结构，字段说明和类型提示见config.schema.json */
const ConfigSchema = strictObject({
	$schema: optional(string()),
	bot: strictObject({
		selfId: string(),
		onebotHttpPort: number(),
		onebotHttpPostPort: number(),
	}),
	models: pipe(array(ModelSchema), minLength(1)),
	apiKeys: strictObject({
		deepseek: optional(string()),
		agnes: optional(string()),
	}),
	mcpServers: optional(record(string(), McpServerSchema)),
	brec: optional(
		strictObject({
			uids: array(number()),
			groupIds: array(number()),
		}),
	),
	etc: strictObject({
		replyProbabilityNotAt: number(),
		maxActiveGroupCount: number(),
		safeWord: string(),
		ratioToCompactToolResult: number(),
		ratioToCompactMedia: number(),
		ratioToClearSoftDeletedMessages: number(),
		ratioToSummarize: number(),
		limitOfSummary: number(),
		summarizeNDay: number(),
		perUserMemoryBudget: number(),
	}),
});

export type Config = InferOutput<typeof ConfigSchema>;

// 开发时在仓库根启动，dist单独部署时在dist里启动，反正cwd里都有config.json
const CONFIG_PATH = resolve("config.json");

const loadConfig = (): Config => {
	// 读不到文件基本就是忘了复制模板
	let raw: string;
	try {
		raw = readFileSync(CONFIG_PATH, "utf-8");
	} catch {
		throw new Error(
			`找不到${CONFIG_PATH}，请把config.example.json复制成config.json再填写`,
		);
	}

	// json本身写坏了单独提示，不然栈里看不出是哪个文件的问题
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch (error) {
		throw new Error(`config.json不是合法的JSON：${(error as Error).message}`);
	}

	const validation = safeParse(ConfigSchema, json);
	if (!validation.success) {
		throw new Error(`config.json配置有误：\n${validation.issues[0].message}`);
	}

	return validation.output;
};

const config = loadConfig();
export default config;
