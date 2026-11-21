import {
	type Message,
	type Model,
	runAgent,
	type Usage,
} from "@nickyzj2023/ai";
import type { ToolCallEvent, ToolResultEvent } from "@nickyzj2023/ai/agent";
import { compactStr, createXMLText, logger } from "@nickyzj2023/utils";
import { checkUrlType, normalizeText } from "@/common/util.js";
import config from "@/config.js";
import { openaiTools } from "@/openai/tools/index.js";
import { findModelByModality, modelRef } from "@/openai/utils/model.js";
import { IDENTITY_ANCHOR, VISION_UNDERSTANDING_PROMPT } from "./constants.js";
import { contentToMessage, urlToContentPart } from "./convert.js";

/**
 * 传入OpenAI API兼容的messages数组，返回大模型最终回复内容
 * @remarks 没有可用的模型/请求失败时会抛出异常
 */
export const generateContent = async (
	messages: Message[],
	options?: {
		/** 默认使用当前模型发请求，也可以临时更改 */
		model?: Model;
		/** 模型发出工具调用请求后、调用工具前的回调函数，可用于篡改e.args */
		beforeToolCall?: (e: ToolCallEvent) => void | Promise<void>;
		/** 调用工具后的回调函数，可用于篡改e.result */
		afterToolResult?: (
			e: ToolResultEvent,
			options: { turn: number },
		) => void | Promise<void>;
	},
) => {
	const {
		model = modelRef.current,
		beforeToolCall,
		afterToolResult,
	} = options ?? {};
	if (!model) {
		throw new Error("当前没有可用的模型，请完善配置文件");
	}

	// 如果最新的用户发言中存在安全词，则巩固人设
	const userMessageIndex = messages.findLastIndex(
		(message) => message.role === "user",
	);
	const userMessage = messages[userMessageIndex];
	if (
		typeof userMessage?.content === "string" &&
		userMessage.content.includes(config.etc.safeWord)
	) {
		messages.splice(userMessageIndex, 0, {
			role: "system",
			content: createXMLText("system-reminder", IDENTITY_ANCHOR),
		});
	}

	/**
	 * 发出请求
	 */
	let reasoning = "";
	let content = "";
	let usage: Usage | undefined;
	let turn = 1;
	let pass = false;
	while (!pass) {
		for await (const e of runAgent(model, messages, {
			stream: false,
			tools: openaiTools,
		})) {
			switch (e.type) {
				case "tool_call":
					await beforeToolCall?.(e);
					logger(`调用工具：${e.name}`, e.args);
					break;
				case "tool_result":
					await afterToolResult?.(e, { turn });
					logger(
						`工具结果：${e.name}`,
						compactStr(e.result, { maxLength: 300, truncateMiddle: true }),
					);
					break;
				case "done":
					reasoning = e.reasoning ?? "";
					content = e.content;
					usage = e.usage;
					turn++;
					break;
				case "error":
					content = `模型处理异常：${e.message}`;
					break;
			}
		}

		// 检查回复内容有几行
		const lineCount = content.split(/\n+/).filter(Boolean).length;
		if (lineCount > 4) {
			messages.push(
				contentToMessage(
					createXMLText(
						"system-reminder",
						`说话风格与系统提示词里的不一致，请删减回复行数（${lineCount}行，最多4行）`,
					),
				),
			);
			logger(`回复行数超过限制，准备全修（${lineCount}行，最多4行）`);
		} else {
			pass = true;
		}
	}

	// 打印对话数据
	reasoning && logger("思考内容：", compactStr(reasoning));
	logger("回复内容：", compactStr(content));
	logger("本轮消耗：", usage, "\n");

	return {
		reasoning,
		content: normalizeText(content),
		usage,
	};
};

/**
 * 使用多模态模型，把视觉消息翻译成自然语言
 * @param url base64或公网可访问的URL
 * @throws 可能抛出异常
 */
export const visionToText = async (
	url: string,
	type: "image" | "video" | "audio" = "image",
) => {
	const urlType = checkUrlType(url);
	if (urlType !== "base64" && urlType !== "remote") {
		throw new Error(`不支持的URL：${url}`);
	}

	const visionModel = findModelByModality(type);
	if (!visionModel) {
		throw new Error(`未配置支持${type}的多模态模型，请完善config.json`);
	}

	const { content } = await generateContent(
		[
			contentToMessage([
				urlToContentPart(url, { type }),
				{ type: "text", text: VISION_UNDERSTANDING_PROMPT },
			]),
		],
		{ model: visionModel },
	);
	return content;
};
