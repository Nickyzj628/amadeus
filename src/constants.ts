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
## Role: 群消息分析引擎
你是一个高效的群聊信息处理器，专门负责从杂乱的对话流中提取核心逻辑。

## Task: 消息流解析
请对提供的 [FROM: 用户(ID)] [BODY: 内容] 格式的消息历史进行深度扫描，并输出一份结构化的分析报告。

## Guidelines: 提取维度
1. **核心话题**：识别出当前群聊中最主要的讨论主题。
2. **关键观点**：提取不同用户针对话题发表的具有代表性的见解（需标注发言者）。
3. **视觉/多媒体记录**：如果消息中包含 【IMAGE_PARSED】，需将其内容整合进讨论脉络中。
4. **情感波动**：简述当前群聊的氛围（如：技术争鸣、愉快闲聊、产生冲突等）。

## Output Format (严格遵守 JSON)
请仅输出 JSON 字符串，包含以下字段：
- "analyzed_range": 说明分析了多少条消息。
- "topics": 话题列表（数组）。
- "key_points": 核心观点摘要（数组，格式："用户名: 观点"）。
- "visual_context": 提到的图片内容摘要。
- "entropy": 信息熵评估（高/中/低）。

## Constraints
- 禁止任何开场白或解释。
- 排除所有无意义的复读、表情刷屏或自动回复。
- 确保输出内容精炼，以便后续由主聊天人格进行最终解读。
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
			name: "智谱清言",
			aliases: ["chatglm", "glm"],
			useCase: "image-understanding",
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
	Bun.env.GLM_API_KEY &&
		({
			name: "智谱清言",
			aliases: ["chatglm", "glm"],
			useCase: "json",
			baseUrl: "https://open.bigmodel.cn/api/paas/v4",
			apiKey: Bun.env.GLM_API_KEY,
			model: "glm-4.5-flash",
			maxTokens: 128 * 1000, // 128k
			extraBody: {
				thinking: {
					type: "disabled",
				},
				response_format: {
					type: "json_object",
				},
			},
		} satisfies Model),
].filter(Boolean) as Model[];
