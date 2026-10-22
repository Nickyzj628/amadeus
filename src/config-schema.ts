import {
	array,
	description,
	type InferOutput,
	integer,
	looseObject,
	maxValue,
	minLength,
	minValue,
	number,
	optional,
	picklist,
	pipe,
	record,
	strictObject,
	string,
	unknown,
} from "valibot";

/** 模型配置，字段和@nickyzj2023/ai的Model对齐 */
// 放开未知键，自定义请求体（比如chat_template_kwargs）要原样带出去
const ModelSchema = looseObject({
	baseUrl: pipe(
		string(),
		description("OpenAI兼容接口地址，比如https://api.deepseek.com"),
	),
	model: optional(
		pipe(
			string(),
			description("模型名，不填会尝试用GET {baseUrl}/models返回的第一个模型"),
		),
	),
	apiKey: optional(
		pipe(string(), description("接口密钥，本地llama.cpp这类服务可以不填")),
	),
	modalities: optional(
		pipe(
			array(picklist(["text", "image", "audio", "video"])),
			description("模型支持的消息输入类型，默认只有text"),
		),
	),
	context: optional(
		pipe(
			number(),
			integer(),
			minValue(1),
			description("模型最大上下文，默认131072"),
		),
	),
});

/** 单个远程MCP服务配置 */
const McpServerSchema = looseObject({
	type: pipe(picklist(["streamable_http", "sse"]), description("连接方式")),
	url: pipe(string(), description("MCP服务地址")),
	headers: optional(
		pipe(
			record(string(), unknown()),
			description('请求头，比如{"x-api-key":"xxxxx"}'),
		),
	),
	ignoredToolNames: optional(
		pipe(array(string()), description("不加载的工具名")),
	),
});

/** 配置文件的完整结构 */
// 顶层和固定字段用strictObject，拼错或多写能直接在启动时报出来
export const ConfigSchema = strictObject({
	$schema: optional(
		pipe(string(), description("编辑器类型提示用的JSON Schema地址，不用改")),
	),
	bot: pipe(
		strictObject({
			selfId: pipe(string(), description('机器人QQ号，写字符串，比如"12345678"')),
			onebotHttpPort: pipe(
				number(),
				integer(),
				minValue(1),
				maxValue(65535),
				description("OneBot HTTP服务端口号，用于机器人主动发送请求"),
			),
			onebotHttpPostPort: pipe(
				number(),
				integer(),
				minValue(1),
				maxValue(65535),
				description("OneBot HTTP POST服务端口号，用于机器人接收消息"),
			),
		}),
		description("机器人核心配置"),
	),
	models: pipe(
		array(ModelSchema),
		minLength(1),
		description(
			"模型列表，需满足：兼容OpenAI API请求格式；至少有一个能理解图片；最好支持工具调用",
		),
	),
	apiKeys: pipe(
		strictObject({
			deepseek: optional(pipe(string(), description("DeepSeek的联网搜索工具"))),
			agnes: optional(pipe(string(), description("Agnes的文生图服务"))),
		}),
		description("一些工具要求提供的apikey（可选）"),
	),
	mcpServers: optional(
		pipe(
			record(string(), McpServerSchema),
			description("远程MCP工具（可选），键名随便取，值是单个MCP服务配置"),
		),
	),
	brec: optional(
		pipe(
			strictObject({
				uids: pipe(
					array(number()),
					description("要订阅哪些UP主的直播，填用户主页上的UID"),
				),
				groupIds: pipe(array(number()), description("要推送到哪些QQ群")),
			}),
			description("B站直播通知推送（可选）"),
		),
	),
	etc: pipe(
		strictObject({
			replyProbabilityNotAt: pipe(
				number(),
				minValue(0),
				maxValue(1),
				description("未被@时的回复概率"),
			),
			maxActiveGroupCount: pipe(
				number(),
				integer(),
				minValue(1),
				description("同时活跃的群聊数，超过时会释放不活跃群聊的消息内存"),
			),
			safeWord: pipe(
				string(),
				description("安全词，消息里检测到时添加人设锚点，修正人设"),
			),
			ratioToCompactToolResult: pipe(
				number(),
				minValue(0),
				maxValue(1),
				description("上下文超过总上下文这个比例时，压缩工具调用结果"),
			),
			ratioToCompactMedia: pipe(
				number(),
				minValue(0),
				maxValue(1),
				description("上下文超过总上下文这个比例时，压缩图片/音频/视频消息"),
			),
			ratioToClearSoftDeletedMessages: pipe(
				number(),
				minValue(0),
				maxValue(1),
				description("上下文超过总上下文这个比例时，清理软删除残留的占位消息"),
			),
			ratioToSummarize: pipe(
				number(),
				minValue(0),
				maxValue(1),
				description("上下文超过总上下文这个比例时，总结消息"),
			),
			limitOfSummary: pipe(
				number(),
				integer(),
				minValue(1),
				description("总结消息最长字数，超过时删掉日期最早的一段"),
			),
			summarizeNDay: pipe(
				number(),
				integer(),
				minValue(1),
				description("自动压缩N天前的消息"),
			),
			perUserMemoryBudget: pipe(
				number(),
				integer(),
				minValue(1),
				description("每个用户的记忆字数上限"),
			),
		}),
		description("一些优化体验的杂项（建议默认）"),
	),
});

export type Config = InferOutput<typeof ConfigSchema>;
