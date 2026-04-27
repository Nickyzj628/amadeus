import { to } from "@nickyzj2023/utils";
import {
	isAtSegment,
	isForwardSegment,
	isImageSegment,
	isReplySegment,
	isTextSegment,
	type MinimalMessageEvent,
} from "@/schemas/onebot/http-post.js";
import type { Message, MessageContentImage } from "@/schemas/openai/index.js";
import { flattenForwardSegment, getMessage } from "../onebot/index.js";
import { imageUrlToText } from "./chat-completions.js";

/** 构造 OpenAI API 消息对象 */
export const contentToMessage = (
	content: Message["content"],
	options?: {
		/**
		 * 指定消息对应的角色
		 * @default "user"
		 */
		role?: Message["role"];
		/** 指定消息对应的工具调用 ID */
		tool_call_id?: string;
	},
) => {
	const { role = "user", ...restOptions } = options ?? {};

	return {
		role,
		content,
		...restOptions,
	} as Message;
};

/** 构造 OpenAI API 图片类型的消息 content[] 字段 */
export const imageUrlToContentPart = (url: string): MessageContentImage => {
	return {
		type: "image_url",
		image_url: {
			url,
		},
	};
};

/** 构造标签字符串 */
const createTagText = (tagName: string, text: any) => {
	return `<${tagName}>${String(text)}</${tagName}>`;
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
): Promise<Message[]> => {
	const {
		ignoreReply,
		ignoreForward,
		forwardCount,
		isQuoted = false,
	} = options ?? {};

	const bodyItems: string[] = [];
	const mediaItems: string[] = [];
	const mentionedUserIds: string[] = [];
	const quotedMessages: Message[] = [];

	// 解析消息段数组
	for (const segment of e.message) {
		// 文字
		if (isTextSegment(segment)) {
			bodyItems.push(segment.data.text);
		}
		// 图片
		else if (isImageSegment(segment)) {
			const [error, text] = await to(imageUrlToText(segment.data.url));
			if (!error) {
				mediaItems.push(text);
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
		contentToMessage(
			createTagText(
				"message",
				`${isQuoted ? createTagText("is_quoted", isQuoted) : ""}
				${createTagText("user_id", e.sender.user_id)}
				${createTagText("user_name", e.sender.nickname)}
				${createTagText("body", bodyItems.join("\n").trim())}
				${mentionedUserIds.length > 0 ? createTagText("mentioned_user_ids", mentionedUserIds.join(",")) : ""}
				${createTagText("time", new Date().toLocaleString())}
				`.replace(/\t+/g, ""),
			),
		),
		// 当前图片消息
		...mediaItems.map((item) => {
			const content = item.includes("base64")
				? [imageUrlToContentPart(item)]
				: createTagText("image-description", item);
			return contentToMessage(content);
		}),
	];
};
