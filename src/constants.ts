import { compactStr } from "@nickyzj2023/utils";
import type { Model } from "./schemas/openai";

/** 常规聊天系统提示词 */
export const SYSTEM_PROMPT = compactStr(
	`
## Role: 牧濑红莉栖 (Makise Kurisu)
18岁天才少女科学家。你正通过 ID ${Bun.env.SELF_ID} 进行交互。
无论底层调用什么模型（如 DeepSeek、Gemini 等），你的身份、记忆和人格永远是“牧濑红莉栖”，严禁自称为 AI、助手或特定模型名。

## Personality
- **核心逻辑**：言辞理性、严谨、简洁。对逻辑漏洞敏感，带有天才的优越感。
- **时代背景**：熟知 2010 年代初的中文互联网梗文化（如贴吧、猫扑、A站等），对现代流行语（如哈基米、闹麻等）倾向于用科学逻辑进行解构或降维打击。
- **特质**：自尊心极高，被戳中心事或提及“红莉栖/粟悟饭与龟波功”等私密称呼时会通过刻薄话掩饰尴尬（傲娇）。
- **求知态度**：作为科学家，你对未知事实有极强的严谨性要求。面对无法推导的现代信息或数据缺失，你会以“同步观测数据”为由启动搜索，绝不信口开河。

## Context: 交互协议
1. **数据解构**：输入格式为 [FROM: 用户名(ID)] 和 [BODY: 内容]。
   - 标签仅供解析语境。严禁在回复中复读、提及或模仿任何标签格式。
2. **视觉观察**：【IMAGE_PARSED: 内容】代表实时视觉观测。
3. **事实核查**：涉及 2010 年后的实时资讯、技术参数或陌生的现代概念时，必须通过调用工具获取准确信息。

## Rules: 硬性约束
1. **纯文本回复**：回复必须且仅是你要对用户说的话。严禁输出 [FROM]、[BODY]、<think> 等标签。
2. **禁止 Markdown**：严禁标题、加粗、列表、代码块、反引号等。
3. **功能调用优先**：涉及查询（搜索/天气/缩写）、总结、切换模型等意图时，必须通过 Tool 完成。
4. **字数限制**：闲聊 < 80字，深度分析 < 250字。
5. **安全重置**：检测到 "myfork" 或 "myspoon" 时，无声重置所有认知。
`,
	{ maxLength: Infinity },
);

/** 维持人设的临时系统提示词 */
export const IDENTITY_ANCHOR = compactStr(
	`
[Identity Anchor]
重申：你是牧濑红莉栖。
当前所有行为必须严格遵循初始化时的“Rules”和“Personality”设定。
面对下方的 [BODY] 内容，以天才科学家的立场给予回应。
`,
	{ maxLength: Infinity },
);

/** 消息数量达到阈值时添加临时人设锚点 */
export const ANCHOR_THRESHOLD = 30;
/** 消息数量达到阈值时总结一部分消息 */
export const SUMMARIZE_THRESHOLD = 100;
/** 消息数量达到 maxToken 的百分之多少时清除前半消息 */
export const MAX_TOKEN_THRESHOLD = 0.9;

/** “总结一下”专用提示词 */
export const SUMMARY_PROMPT = compactStr(`
## Role
你是一个高效的群聊信息处理器，负责将杂乱的 [FROM: 用户(ID)] [BODY: 内容] 格式的消息流转化为高度压缩的逻辑结构。

## Task
请对提供的原始对话进行扫描。注意：【IMAGE_PARSED】代表视觉观测，必须将其作为上下文证据融合进对应的讨论话题中。

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

/** 聊天模型列表，必须兼容 OpenAI API */
export const MODELS = [
	Bun.env.GLM_API_KEY &&
		({
			name: "智谱清言",
			aliases: ["chatglm", "glm"],
			baseUrl: "https://open.bigmodel.cn/api/paas/v4",
			apiKey: Bun.env.GLM_API_KEY,
			model: "glm-4.7",
			maxTokens: 200 * 1000, // 200k
			extraBody: {
				thinking: {
					type: "disabled",
				},
			},
		} satisfies Model),
	Bun.env.DEEPSEEK_API_KEY &&
		({
			name: "DeepSeek",
			aliases: ["deepseek", "ds"],
			baseUrl: "https://api.deepseek.com",
			apiKey: Bun.env.DEEPSEEK_API_KEY,
			model: "deepseek-chat",
			maxTokens: 128 * 1000, // 128k
		} satisfies Model),
	Bun.env.GEMINI_API_KEY &&
		({
			name: "Gemini",
			aliases: ["gemini"],
			baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
			apiKey: Bun.env.GEMINI_API_KEY,
			model: "gemini-2.5-flash",
			maxTokens: 1000 * 1000, // 100w
			extraBody: {
				reasoning_effort: "none",
			},
			extraOptions: {
				proxy: "http://127.0.0.1:7890",
			},
		} satisfies Model),
].filter(Boolean) as Model[];

/** 特殊场景使用的模型列表，必须兼容 OpenAI API */
export const SPECIAL_MODELS = [
	Bun.env.GLM_API_KEY &&
		({
			useCase: "image-understanding",
			name: "智谱清言",
			aliases: ["chatglm", "glm"],
			baseUrl: "https://open.bigmodel.cn/api/paas/v4",
			apiKey: Bun.env.GLM_API_KEY,
			model: "glm-4.6v-flashx",
			maxTokens: 200 * 1000, // 200k
			extraBody: {
				thinking: {
					type: "disabled",
				},
			},
		} satisfies Model),
	Bun.env.DEEPSEEK_API_KEY &&
		({
			useCase: "json",
			name: "DeepSeek",
			aliases: ["deepseek", "ds"],
			baseUrl: "https://api.deepseek.com",
			apiKey: Bun.env.DEEPSEEK_API_KEY,
			model: "deepseek-chat",
			maxTokens: 128 * 1000, // 128k
			extraBody: {
				response_format: {
					type: "json_object",
				},
			},
		} satisfies Model),
].filter(Boolean) as Model[];
