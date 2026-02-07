import {
	camelToSnake,
	compactStr,
	fetcher,
	imageUrlToBase64,
	isNil,
	mapKeys,
	mapValues,
	mergeObjects,
	timeLog,
	to,
} from "@nickyzj2023/utils";
import type {
	ChatCompletion,
	ChatCompletionMessageParam,
} from "openai/resources";
import {
	ANCHOR_THRESHOLD,
	IDENTITY_ANCHOR,
	MAX_ACTIVE_GROUPS,
	SAFE_WORD,
	SUMMARIZE_PROMPT,
	SUMMARIZE_THRESHOLD,
} from "@/constants";
import type { MinimalMessageEvent } from "@/schemas/onebot";
import type { Model } from "@/schemas/openai";
import { modelRef } from "@/tools/changeModel";
import { loadJSON, saveJSON } from "./common";
import {
	flattenForwardSegment,
	getMessage,
	isAtSegment,
	isForwardSegment,
	isImageSegment,
	isReplySegment,
	isTextSegment,
} from "./onebot";

const groupMessagesMap = new Map<number, ChatCompletionMessageParam[]>();
export const pendingGroupIdsSet = new Set<number>();

/**
 * 根据群号读取消息数组
 * @param groupId 群号
 * @param initialMessages 如果群里没有存放消息，则用它来作为初始消息
 */
export const readGroupMessages = async (
	groupId: number,
	initialMessages: ChatCompletionMessageParam[] = [],
) => {
	// 如果内存中有该群的消息，则直接返回
	if (groupMessagesMap.has(groupId)) {
		return groupMessagesMap.get(groupId)!;
	}

	// 否则从文件读取群消息，并加入活跃群聊 Map
	const messages = await loadJSON(`/data/${groupId}.json`, {
		createWithDataIfNotExist: initialMessages,
	});
	groupMessagesMap.set(groupId, messages);

	// 优化：释放不活跃的群聊消息内存
	if (groupMessagesMap.size > MAX_ACTIVE_GROUPS) {
		for (const [groupId, messages] of groupMessagesMap) {
			if (!pendingGroupIdsSet.has(groupId)) {
				// 先存入本地 JSON 文件
				saveJSON(`/data/${groupId}.json`, messages)
					.then(() => {
						// 再释放内存，不阻塞当前函数
						groupMessagesMap.delete(groupId);
						timeLog(`释放了${groupId}的消息内存`);
					})
					.catch((e) => {
						timeLog(`释放${groupId}的消息内存失败：${e.message}`);
					});
				break;
			}
		}
	}

	return messages;
};

/** 根据群号保存消息数组 */
export const saveGroupMessages = async (
	groupId: number,
	messages: ChatCompletionMessageParam[],
	options?: {
		/** 是否在保存消息后释放内存 */
		disableGC?: boolean;
	},
) => {
	await saveJSON(`/data/${groupId}.json`, messages);
	if (!options?.disableGC) {
		groupMessagesMap.delete(groupId);
		timeLog(`释放了${groupId}的消息内存`);
	}
};

/**
 * 构造 OpenAI API 消息对象
 * @remarks 通过泛型 K 捕获 role 的具体类型，从而精准推导剩余字段
 */
export const contentToMessage = <K extends ChatCompletionMessageParam["role"]>(
	content: ChatCompletionMessageParam["content"],
	options?: {
		/** 修改消息对应的角色，默认 user */
		role?: K;
	} & Partial<
		Omit<Extract<ChatCompletionMessageParam, { role: K }>, "content" | "role">
	>,
): ChatCompletionMessageParam => {
	const { role = "user" as K, ...restOptions } = options ?? {};

	return {
		role,
		content,
		...restOptions,
	} as ChatCompletionMessageParam;
};

/**
 * 把消息格式从 OneBot 转成 OpenAI API
 * @remarks 保证安全返回消息对象
 */
export const onebotToOpenaiMessages = async (
	e: MinimalMessageEvent,
	options?: {
		/** 是否忽略回复的消息 */
		ignoreReply?: boolean;
		/** 是否忽略合并转发消息 */
		ignoreForward?: boolean;
		/** 每条转发消息允许递归获取的消息数 */
		forwardCount?: number;
		/** 是否为被引用的上下文消息 */
		isQuoted?: boolean;
	},
): Promise<ChatCompletionMessageParam[]> => {
	const { ignoreReply, ignoreForward, forwardCount, isQuoted } = options ?? {};

	const bodyItems: string[] = [];
	const mediaItems: string[] = [];
	const mentionedUserIds: string[] = [];
	const quotedMessages: ChatCompletionMessageParam[] = [];

	// 解析消息段数组
	for (const segment of e.message) {
		// 文字
		if (isTextSegment(segment)) {
			bodyItems.push(segment.data.text);
		}
		// 图片
		else if (isImageSegment(segment)) {
			timeLog("识别到一条图片消息", segment);
			const [error, base64] = await to(imageUrlToBase64(segment.data.url));
			if (!error) {
				mediaItems.push(base64);
			}
		}
		// @ 某人
		else if (isAtSegment(segment)) {
			mentionedUserIds.push(segment.data.qq);
		}
		// 合并转发
		else if (isForwardSegment(segment) && !ignoreForward) {
			const forwardedMessages = (
				await flattenForwardSegment(segment.data.id, {
					count: forwardCount,
					processMessageEvent: (e) =>
						onebotToOpenaiMessages(e, {
							...options,
							isQuoted: true,
						}),
				})
			).flat();

			quotedMessages.push(...forwardedMessages);
		}
		// 回复
		else if (isReplySegment(segment) && !ignoreReply) {
			const e = await getMessage(segment.data.id);
			if (e) {
				const repliedMessages = await onebotToOpenaiMessages(e, {
					...options,
					isQuoted: true,
				});
				quotedMessages.push(...repliedMessages);
			}
		}
	}

	// 把散落的消息合并为一个复合数组返回
	return [
		// 上下文消息
		...quotedMessages,
		// 当前消息
		contentToMessage([
			{
				type: "text",
				text: JSON.stringify(
					mapValues(
						mapKeys(
							{
								isQuoted,
								userId: String(e.sender.user_id),
								userName: e.sender.nickname,
								body: bodyItems.join("\n"),
								mentionedUserIds,
								time: new Date().toLocaleString(),
							},
							camelToSnake,
						),
						(value) => value,
						{
							filter: (value) => {
								if (Array.isArray(value)) {
									return value.length > 0;
								}
								return !isNil(value);
							},
						},
					),
				),
			},
		]),
		// 当前图片消息
		...mediaItems.map((item) =>
			contentToMessage([
				{
					type: "image_url",
					image_url: {
						url: item,
					},
				},
			]),
		),
	];
};

/** openai.chat.completions() 的替代实现，返回response.choices[0].message */
export const chatCompletions = async (
	messages: ChatCompletionMessageParam[],
	options?: {
		/** 使用指定模型发出请求，默认全局正在使用的模型 */
		model?: Model;
		body?: Record<string, any>;
		/**
		 * 是否自动优化上下文，默认开启。处理逻辑如下：
		 * 1. 超过 X 条消息时添加临时人设锚点
		 */
		disableMessagesOptimization?: boolean;
	},
) => {
	const {
		model = modelRef.value,
		body: bodyFromParams = {},
		disableMessagesOptimization = false,
	} = options ?? {};

	if (!model) {
		throw new Error("当前没有运行中的模型，@我并输入“切换到XX模型”启用一个");
	}

	const wipMessages = [...messages];
	const getLastUserMessage = () => {
		const index = wipMessages.findLastIndex(
			(message) => message.role === "user",
		);
		const message = wipMessages[index];
		return [message, index] as const;
	};

	/**
	 * 如果消息中包含安全词，则在用户提问前添加永久人设锚点
	 */

	let [lastUserMessage, lastUserMessageIndex] = getLastUserMessage();

	if (
		lastUserMessage !== undefined &&
		typeof lastUserMessage.content === "string" &&
		lastUserMessage.content.includes(SAFE_WORD)
	) {
		const identityAnchorMessage = contentToMessage(IDENTITY_ANCHOR, {
			role: "system",
		});
		wipMessages.splice(lastUserMessageIndex, 0, identityAnchorMessage);
		lastUserMessage.content = lastUserMessage.content.replace(SAFE_WORD, "");
		lastUserMessageIndex++;
	}

	/**
	 * 如果消息超过 X 条，则在用户提问前添加临时人设锚点
	 */

	const needTempIdentityAnchor =
		disableMessagesOptimization !== false &&
		wipMessages.length > ANCHOR_THRESHOLD &&
		lastUserMessageIndex !== -1;

	if (needTempIdentityAnchor) {
		const anchorMessage = contentToMessage(IDENTITY_ANCHOR, {
			role: "system",
		});
		wipMessages.splice(lastUserMessageIndex, 0, anchorMessage);
	}

	/**
	 * 正式发出请求
	 */

	const body = {
		model: model.model,
		messages: wipMessages,
		...model.extraBody,
		...bodyFromParams,
	};

	const requestInit = mergeObjects(
		{
			headers: {
				Authorization: `Bearer ${model.apiKey}`,
			},
		},
		model.extraOptions ?? {},
	);

	const [error, response] = await to<ChatCompletion>(
		fetcher(model.baseUrl).post("/chat/completions", body, requestInit),
	);

	if (error) {
		const errMessage = compactStr(JSON.stringify(error, null, 2), {
			disableNewLineReplace: true,
		});
		timeLog(`请求失败：${errMessage}`);
		throw new Error(errMessage);
	}

	const result = response.choices[0]?.message;
	if (!result) {
		timeLog(`模型回复了空消息：${JSON.stringify(response, null, 2)}`);
		throw new Error("模型回复了空消息，快找群主排查！");
	}

	// 如果启用了临时人设锚点，则在消费后移除
	if (needTempIdentityAnchor) {
		wipMessages.splice(lastUserMessageIndex, 1);
	}

	// 阅后即焚图片，防止图片过期导致模型请求报错
	// wipMessages = wipMessages.filter((message) => {
	// 	if (!Array.isArray(message.content)) {
	// 		return true;
	// 	}
	// 	return message.content.every((part) => part.type !== "image_url");
	// });

	/**
	 * 如果即将到达上下文窗口，则清理前半（保留系统消息）（理论上永不触发）
	 */

	// const totalTokens = response.usage?.total_tokens ?? 0;

	// if (totalTokens > model.contextWindow * 0.8) {
	// 	const deleteCount = Math.floor(wipMessages.length / 2);
	// 	const systemPrompts = wipMessages.filter(
	// 		(message, i) => i < deleteCount && message.role === "system",
	// 	);
	// 	wipMessages.splice(0, deleteCount, ...systemPrompts);
	// 	timeLog("(上下文过长，已清理前半段非必要消息)");
	// }

	// 同步 wipMessages 回原数组
	messages.length = 0;
	messages.push(...wipMessages);

	return result;
};

/**
 * 总结溢出的消息，但保留系统消息
 * @returns 如果返回 false 或报错，则表示未能总结消息
 */
export const summarizeMessages = async (
	messages: ChatCompletionMessageParam[],
) => {
	if (messages.length < SUMMARIZE_THRESHOLD) {
		return false;
	}

	// 从第一条用户消息开始总结
	const firstUserMessageIndex = messages.findIndex(
		(message) => message.role === "user",
	);

	// 粗略计算需要总结的消息条数
	const count = Math.floor(messages.length * 0.5);
	const summarizingMessages = messages.splice(
		firstUserMessageIndex,
		firstUserMessageIndex + count,
	);

	// 切片总结，防止一次性喂给模型的消息超过上下文窗口
	const countPerChunk = Math.min(count, SUMMARIZE_THRESHOLD);
	const summarizingMessagesChunks = Array.from(
		{
			length: Math.ceil(summarizingMessages.length / countPerChunk),
		},
		(_, i) => {
			return summarizingMessages.slice(
				i * countPerChunk,
				i * countPerChunk + countPerChunk,
			);
		},
	);
	timeLog(
		`即将总结前${count}条消息，分${summarizingMessagesChunks.length}次进行`,
	);

	// 开始总结
	const summarizedMessages: ChatCompletionMessageParam[] = [];
	for (const chunk of summarizingMessagesChunks) {
		chunk.push(contentToMessage(SUMMARIZE_PROMPT));
		const summarizedCompletion = await chatCompletions(chunk, {
			disableMessagesOptimization: true,
		});
		summarizedMessages.push(
			contentToMessage(
				`清理了${chunk.length - 1}条消息并总结为：${summarizedCompletion.content}`,
			),
		);
	}

	// 插入原始消息
	messages.splice(firstUserMessageIndex, 0, ...summarizedMessages);
	return messages;
};
