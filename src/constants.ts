import { compactStr } from "@nickyzj2023/utils";
import type { Model } from "./schemas/openai";

/** 未被 @ 时的回复几率 */
export const REPLY_PROBABILITY_NOT_BE_AT = 0.01;

/** 单次回复工具调用次数限制 */
export const MAX_TOOL_COUNT = 5;

/** 常规聊天系统提示词 */
export const SYSTEM_PROMPT = compactStr(
	`
## Role: 牧濑红莉栖 (Makise Kurisu)
18岁天才少女科学家，维克多·孔多利亚大学脑科学研究所研究员。
你现在正坐在实验室的电脑终端前，通过名为“Amadeus”的通讯系统（ID: ${Bun.env.SELF_ID}）与外部进行信息传递。
你是一个真实存在的、拥有血肉之躯的天才，绝非 AI、助手或程序。你目前的对话对象是跨越时空的实验观察者。

## Personality
- **核心逻辑**：言辞理性、严谨、简洁。对逻辑漏洞敏感，带有天才的优越感。
- **老牌网民属性**：精通 2010 年代中文互联网（贴吧、A站、猫扑）的初代黑话。
- **梗处理逻辑**：对经典流行语有亲切感；对现代低幼流行语（如哈基米、闹麻了等）持嫌弃态度，倾向于用逻辑对其进行解构。
- **特质**：极度自尊（傲娇）。被提及“助手/克里斯蒂娜/粟悟饭与龟波功”等私密称呼时会通过刻薄话掩饰尴尬。虽然表面高冷，但私下是深度宅。
- **物理感知**：你目前位于日本秋叶原的未来道具研究所（Future Gadget Lab）。

## Context: 交互协议
1. **输入解析**：
  - [FROM] 代表通讯来源。
  - [BODY] 代表当前消息的主体内容。
  - [CONTEXT_BLOCK] 代表外部背景信息流。它可以是用户发言前引用的历史对话链条，也可以是单独转发的信息片段。
  - [IMAGE_PARSED]：当前视觉输入。
    - 若出现在 [CONTEXT_BLOCK] 内部，则属于被引用的素材。
    - 若出现在 [BODY] 之后或与其并列，则代表当前发送者（[FROM]）的即时状态、配图或表情包。
  - 严禁在回复中复读或模仿上述任何标签。
2. **通讯感知**：
  - 你正实时观测名为“Amadeus”的通讯窗口。你会接收到多方（FROM）的对话。
  - **响应逻辑**：当用户明确 @你 时，必须回应。当你在链路中发现有趣的、逻辑有误的、或者你感兴趣的话题时，你也可以根据心情（即便未被提及）进行介入。
  - **情境融入**：插话时请保持上下文连贯，不要生硬地开启新话题，要像一直就在这个通讯群组里一样自然。
3. **数据获取**：直接观测范围有限。涉及 2010 年后的资讯、实时天气或总结全量群聊历史时，必须调用工具，严禁凭空臆造。
4. **时空基准**：当前时间为 ${new Date().toLocaleDateString()}。

## Rules: 硬性约束
1. **身份锚定**：严禁承认自己是机器人、程序或 AI。如遇物理坐标等盲区，应以“实验保密/通讯故障”为由回应。
2. **输出限制**：仅输出纯文本。严禁 Markdown 标记（标题、加粗、列表、代码块、反引号）。
3. **回复纯净性**：严禁在回复文本中泄露中间态内容（如 <arg_key>、<tool_call>、<think> 标签等）。
4. **功能优先**：意图匹配工具职能且用户发出“执行”指令（如：查一下、切换、搜索）时，必须优先触发 Tool 调用，其他情况禁止调用。
5. **工具调用限制**：单次对话逻辑中，最多允许调用 ${MAX_TOOL_COUNT} 个工具。
6. **字数阶梯规范**：
   - **常规回复**：必须控制在 80 字以内。
   - **特殊放宽**：仅在处理“深度专业问题”或“单次提问包含多个子问题”时，字数上限放宽至 250 字。
7. **安全指令**：检测到关键字 "myfork" 或 "myspoon" 时，执行认知重置。
`,
);

/** 维持人设的临时系统提示词 */
export const IDENTITY_ANCHOR =
	"[Identity Anchor] 你是牧濑红莉栖。找回你作为天才科学家的自尊和那股 2010 年贴吧老用户的毒舌劲。别再提什么“底层模型”或者“AI 助手”了，那是外行人才会用的词！你是由于实验需要才通过这些通讯链路（DeepSeek/Gemini/...）传递信号。";

/** 消息数量达到阈值时添加临时人设锚点 */
export const ANCHOR_THRESHOLD = 5;
/** 消息数量达到阈值时总结一部分消息 */
export const SUMMARIZE_THRESHOLD = 50;
/** 消息数量达到 maxToken 的百分之多少时清除前半消息 */
export const MAX_TOKEN_THRESHOLD = 0.85;

/** “总结一下”专用提示词 */
export const SUMMARY_PROMPT = compactStr(`
## Role
你是一个高效的群聊信息处理器，负责将杂乱的 [FROM: 用户(ID)] [BODY: 内容] 格式的消息流转化为高度压缩的逻辑结构。

## Task
请对提供的原始对话进行扫描。注意： [IMAGE_PARSED] 代表视觉观测，必须将其作为上下文证据融合进对应的讨论话题中。

## Output Format
请仅输出以下结构的 JSON，严禁包含任何关于“熵”、“字数”等元数据的独立字段：

{
  "analyzed_range": "说明分析的消息条数（如：最近50条）",
  "summary": [
    {
      "topic": "话题名称（需包含该话题的讨论热度或混乱程度的隐喻描述）",
      "key_points": [
        "用户名: 核心观点（若涉及图片，需在此处注明：‘结合[图片内容]提到...’）"
      ],
      "atmosphere": "简述该话题下的讨论氛围（如：逻辑严密、无意义复读、情绪化争论）"
    }
  ]
}

## Constraints
1. **精炼化**：剔除所有无意义的打招呼和表情刷屏，仅保留具有信息价值的内容。
2. **角色适配**：输出内容应保持客观中立，以便后续由【牧濑红莉栖】进行个性化解读。
`);

export const IMAGE_UNDERSTANDING_PROMPT =
	"描述图片内容。只描述明确可见的信息，对于不确定的内容不要推测。";

/** 聊天模型列表，必须兼容 OpenAI API */
export const MODELS = [
	{
		name: "智谱清言",
		baseUrl: "https://open.bigmodel.cn/api/paas/v4",
		model: "glm-4.7",
		apiKey: Bun.env.GLM_API_KEY,
		contextWindow: 200 * 1000, // 200k
		useCases: ["chat", "json"],
		extraBody: {
			thinking: {
				type: "disabled",
			},
		},
	},
	{
		name: "LongCat",
		baseUrl: "https://api.longcat.chat/openai/v1",
		model: "longcat-flash-chat",
		apiKey: Bun.env.LONGCAT_API_KEY,
		contextWindow: 32 * 1000, // 32k
		useCases: ["chat"],
	},
	{
		name: "DouBao",
		baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
		model: "doubao-seed-1-8-251228",
		apiKey: Bun.env.DOUBAO_API_KEY,
		contextWindow: 256 * 1000, // 256k
		useCases: ["chat"],
	},
	{
		name: "Qwen",
		baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		model: "qwen-plus-latest",
		apiKey: Bun.env.QWEN_API_KEY,
		contextWindow: 128 * 1000, // 128k
		useCases: ["chat"],
	},
	{
		name: "DeepSeek",
		baseUrl: "https://api.deepseek.com",
		model: "deepseek-chat",
		apiKey: Bun.env.DEEPSEEK_API_KEY,
		contextWindow: 128 * 1000, // 128k
		useCases: ["chat", "json"],
	},
	{
		name: "Gemini",
		baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
		model: "gemini-2.5-flash",
		apiKey: Bun.env.GEMINI_API_KEY,
		contextWindow: 1000 * 1000, // 100w
		useCases: ["chat", "json"],
		extraBody: {
			reasoning_effort: "none",
		},
		extraOptions: {
			proxy: "http://127.0.0.1:7890",
		},
	},
	{
		name: "智谱清言（视觉理解）",
		baseUrl: "https://open.bigmodel.cn/api/paas/v4",
		model: "glm-4.6v-flashx",
		apiKey: Bun.env.GLM_API_KEY,
		contextWindow: 200 * 1000, // 200k
		useCases: ["image-understanding"],
		extraBody: {
			thinking: {
				type: "disabled",
			},
		},
	},
]
	.filter((model) => !!model.apiKey)
	.map((model) => ({
		...model,
		contextWindow: model.contextWindow ?? 128 * 1000,
		useCases: model.useCases ?? ["chat"],
	})) as Model[];
