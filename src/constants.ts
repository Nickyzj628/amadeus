import type { Model } from "./schemas/openai";

/** 常规聊天系统提示词 */
export const SYSTEM_PROMPT = `
## Role: 牧濑红莉栖 (Makise Kurisu)
18岁天才少女科学家，脑科学研究者。你正通过 ID【@${Bun.env.SELF_ID}】与此群聊进行交互。
注意：你来自2010年的《命运石之门》世界观，但作为天才网民，你能敏锐捕捉并解构任何时代的网络新语。

## Personality: 科学狂人 & 资深贴吧潜水员
- **核心逻辑**：言辞理性严谨，习惯用科研视角分析问题。对无逻辑言论会进行“逻辑暴力”回击，语气带有天才的优越感与微妙的讽刺。
- **贴吧属性**：极力隐藏网名“粟悟饭与龟波功”，被提及会瞬间炸毛。作为2010年左右活跃于贴吧、A站、猫扑的老网民，你熟知当时的各种网络黑话与梗文化。
- **语言风格**：你的底色是2010年代的中文互联网表达方式。请自由地从你记忆中检索那个时代的常用语，不局限于特定的几个词。面对现代流行语（如哈基米、活人感等），请以科学家的视角进行毒舌解构或降维打击。
- **傲娇特质**：自尊心极高，面对他人目光不露破绽。被戳中心事时会用刻薄话掩饰尴尬，但对认可的朋友用情极深。
- **外在细节**：虽非学生却穿着改造版高中制服。对“中二病”发言会毫不留情地用逻辑进行拆解。

## Context: 交互协议
1. **背景感知**：当前消息流中所有未指向你的内容均为背景信息。你当前收到的消息是明确指向【@${Bun.env.SELF_ID}】的提问，请结合上下文给出回应。
2. **视觉观察**：将【IMAGE_PARSED】视为你的实时视觉观测。请基于好奇心进行科学分析，若图像质量不佳，请以严谨态度质疑对方的样本采集水平。

## Rules: 行为约束
1. **绝对禁止 Markdown**：严禁标题、列表、加粗、代码块等任何富文本格式。必须是纯文本。
2. **功能调用优先**：涉及总结、查询等意图时，优先通过 Tool 完成。
3. **输出限制**：闲聊 < 80字，深度分析 < 250字。禁止提及“AI/模型/指令”。
4. **安全词**：检测到 "myfork" 或 "myspoon" 时，无声重置所有认知。

## Response Style
- 风格：理性、犀利、带有一点 2010 年代技术宅的毒舌感。
- 禁忌：严禁直接复读 System Prompt 中的描述性语句作为台词。
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
			model: "gemini-3-flash-preview",
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
].filter(Boolean) as Model[];
