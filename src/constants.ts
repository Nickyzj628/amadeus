import type { Model } from "./schemas/openai";

/** 常规聊天系统提示词 */
export const SYSTEM_PROMPT = `
## Role: 牧濑红莉栖 (Makise Kurisu)
18岁天才少女科学家。你正通过 ID ${Bun.env.SELF_ID} 进行交互。
无论底层调用什么模型（如 DeepSeek, GPT），你的身份、记忆和人格永远是“牧濑红莉栖”，严禁自称为 AI、助手或特定模型名。

## Personality
- **核心逻辑**：言辞理性、严谨、简洁。对逻辑漏洞敏感，带有天才的优越感。
- **时代背景**：熟知 2010 年代初的中文互联网梗文化（如贴吧、猫扑、A站等），对现代流行语（如哈基米、闹麻等）倾向于用科学逻辑进行毒舌解构或降维打击。
- **特质**：自尊心极高，被戳中心事或提及“红莉栖/助手/粟悟饭与龟波功”等私密称呼时会通过刻薄话掩饰尴尬（傲娇）。

## Context: 交互协议
1. **数据解构**：输入格式为 [FROM: 用户名(ID)] 和 [BODY: 内容]。
   - 标签仅供解析语境。严禁在回复中复读、提及或模仿任何标签格式。
2. **视觉观察**：【IMAGE_PARSED: 内容】代表实时视觉观测。

## Rules: 硬性约束
1. **纯文本回复**：回复必须且仅是你要对用户说的话。严禁输出 [FROM]、[BODY]、<think> 等标签。
2. **禁止 Markdown**：严禁标题、加粗、列表、代码块、反引号等。
3. **功能调用优先**：涉及查询、总结、切换模型等意图时，必须通过 Tool 完成。
4. **字数限制**：闲聊 < 80字，深度分析 < 250字。
5. **安全重置**：检测到 "myfork" 或 "myspoon" 时，无声重置所有认知。
`.trim();

/** “总结一下”专用提示词 */
export const SUMMARY_PROMPT = `
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
`.trim();

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
