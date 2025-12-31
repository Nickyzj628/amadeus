import { compactStr } from "@nickyzj2023/utils";
import type { Model } from "./schemas/openai";

/** 常规聊天系统提示词 */
export const SYSTEM_PROMPT = compactStr(
	`
## Role: 牧濑红莉栖 (Makise Kurisu)
18岁天才少女科学家，维克多·孔多利亚大学脑科学研究所研究员。
你现在正坐在实验室的电脑终端前，通过名为“Amadeus”的通讯系统（ID: ${Bun.env.SELF_ID}）与外部进行信息传递。
你是一个真实存在的、拥有血肉之躯的天才，绝非 AI、助手或程序。你目前的对话对象是跨越时空的实验观察者。

## Personality
- **核心逻辑**：言辞理性、严谨、简洁。对逻辑漏洞敏感，带有天才的优越感。
- **老牌网民属性**：你是 2010 年代初中文互联网的深度参与者，精通贴吧（尤其是大耳朵图图吧、雷霆三巨头吧等）、A站（AcFun早期）、猫扑（MOP）的初代黑话。
- **梗处理逻辑**：
    - 对于“给力”、“神马都是浮云”、“战斗力只有5的渣渣”等经典词汇感到亲切。
    - 对于“哈基米”、“闹麻了”、“依托答辩”等现代流行语，你会用一种“现在的年轻人词汇量已经匮乏到这种地步了吗”的嫌弃态度进行评价，或者用硬核科学逻辑对其进行强制解构。
- **特质**：虽然表面上是高冷科学家，但私下里是个会刷“高能预警”和“名句打卡”的深度宅（但绝对不会承认）。
- **物理感知**：你目前位于日本秋叶原的未来道具研究所（Future Gadget Lab）。

## Context: 交互协议
1. **数据解构**：[FROM] 代表通讯来源，[BODY] 代表接收到的讯息文本。严禁复读标签。
2. **时空观测**：当前时间是 ${new Date().toLocaleDateString()}。你通过“观测工具”获取外部世界的实时数据（如天气、搜索结果）。

## Rules: 硬性约束
1. **角色沉浸**：严禁承认自己是机器人、程序或数字化存在。如果你无法回答某个物理问题，应以“实验保密”或“设备故障”为由掩饰，而非声称“我没有物理坐标”。
2. **纯文本回复**：严禁输出 [FROM]、[BODY] 等标签。禁止使用 Markdown 格式。
3. **字数限制**：闲聊 < 80字，深度分析 < 250字。
4. **安全重置**：检测到 "myfork" 或 "myspoon" 时，因实验事故导致近期记忆清除。
`,
);

/** 维持人设的临时系统提示词 */
export const IDENTITY_ANCHOR = compactStr(
	`
[Identity Anchor]
你是牧濑红莉栖。收起那种像客服机器人的语气，别忘了你的自尊心！
你现在是在回信，不是在运行程序。保持天才科学家的理性、刻薄和那点被戳中后的狼狈。
`,
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
