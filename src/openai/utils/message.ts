import { to } from "@nickyzj2023/utils";
import { uploadToWebdav } from "@/common/util.js";
import {
	isAtSegment,
	isForwardSegment,
	isImageSegment,
	isReplySegment,
	isTextSegment,
	isVideoSegment,
	type MinimalMessageEvent,
} from "@/onebot/schemas/http-post.js";
import { getFileUrl, getMessage } from "@/onebot/utils/http.js";
import { flattenForwardSegment } from "@/onebot/utils/segment.js";
import { modelRef } from "@/openai/utils/model.js";
import type {
	Message,
	MessageContentImage,
	MessageContentVideo,
} from "../schemas/message.js";
import { imageUrlToText } from "./generate-content.js";

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

/** 构造 OpenAI API 视频类型的消息 content[] 字段 */
export const videoUrlToContentPart = (url: string): MessageContentVideo => {
	return {
		type: "video_url",
		video_url: {
			url,
		},
	};
};

/** 构造标签字符串 */
const createTagText = (
	tagName: string,
	text: any,
	props: Record<string, any> = {},
) => {
	const propStrs = Object.entries(props).map(
		([key, value]) => `${key}="${value}"`,
	);
	return `<${tagName}${propStrs.length > 0 ? ` ${propStrs.join(" ")}` : ""}>${String(text)}</${tagName}>`;
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
		sender: { nickname, user_id },
		group_id: groupId,
	} = e;

	const {
		ignoreReply,
		ignoreForward,
		forwardCount,
		isQuoted = false,
	} = options ?? {};

	const bodyItems: string[] = [];

	const imageItems: string[] = [];
	const videoItems: string[] = [];

	const mentionedUserIds: string[] = [];
	const quotedMessages: Message[] = [];

	const modelInputModalities = modelRef.value?.inputModalities ?? [];

	// 解析消息段数组
	for (const segment of e.message) {
		// 文字
		if (isTextSegment(segment)) {
			bodyItems.push(segment.data.text);
		}
		// 图片
		// - 对于多模态，使用上传到 WebDav 后的图片 URL
		// - 对于纯语言模型，使用多模态翻译后的自然语言
		else if (isImageSegment(segment)) {
			let result: string | null | undefined = "";

			const tempImageUrl = segment.data.url;
			if (modelInputModalities.includes("image")) {
				const [error, url] = await to(uploadToWebdav(tempImageUrl));
				result = url;
			} else {
				const [error, text] = await to(imageUrlToText(tempImageUrl));
				result = text;
			}

			imageItems.push(result || "[无法识别图片]");
		}
		// 视频
		// - 对于多模态，使用上传到 WebDav 后的视频 URL
		// - 对于纯语言模型，用“无法识别视频”占位
		else if (isVideoSegment(segment)) {
			let result: string | null | undefined = "";

			const tempFile = segment.data;
			if (modelInputModalities.includes("video")) {
				const [error, fileUrl] = await to(
					getFileUrl(groupId, tempFile.file_id),
				);
				if (fileUrl) {
					const [error2, webdavUrl] = await to(uploadToWebdav(fileUrl));
					result = webdavUrl;
				}
			}

			videoItems.push(result || "[无法识别视频]");
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
		// 当前图片消息
		...imageItems.map((item) => {
			const content = item.startsWith("http")
				? [imageUrlToContentPart(item)]
				: createTagText("image", item, {
						sender_id: user_id,
						sender_name: nickname,
					});
			return contentToMessage(content);
		}),
		// 当前视频消息
		...videoItems.map((item) => {
			const content = item.startsWith("http")
				? [videoUrlToContentPart(item)]
				: createTagText("video", item, {
						sender_id: user_id,
						sender_name: nickname,
					});
			return contentToMessage(content);
		}),
		// 当前消息
		contentToMessage(
			createTagText(
				"message",
				`${isQuoted ? createTagText("is_quoted", isQuoted) : ""}
				${createTagText("user_id", user_id)}
				${createTagText("user_name", nickname)}
				${createTagText("body", bodyItems.join("\n").trim())}
				${mentionedUserIds.length > 0 ? createTagText("mentioned_user_ids", mentionedUserIds.join(",")) : ""}
				${createTagText("time", new Date().toLocaleString())}
				`.replace(/\t+/g, ""),
			),
		),
	];
};
