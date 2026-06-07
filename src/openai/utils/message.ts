import { readFile } from "node:fs/promises";
import { type ChatCompletions, logger, to } from "@nickyzj2023/utils";
import { compressImage } from "@/common/util.js";
import { checkSameFileName, uploadToWebdav } from "@/common/webdav.js";
import {
	isAtSegment,
	isAudioSegment,
	isForwardSegment,
	isImageSegment,
	isReplySegment,
	isTextSegment,
	isVideoSegment,
	type MinimalMessageEvent,
} from "@/onebot/schemas/http-post.js";
import { getFileUrl, getMessage, getRecord } from "@/onebot/utils/http.js";
import { flattenForwardSegment } from "@/onebot/utils/segment.js";
import { modelRef } from "@/openai/utils/model.js";
import { visionUrlToText } from "./generate-content.js";

/** 构造 OpenAI API 消息对象 */
export const contentToMessage = (
	content: ChatCompletions.Message["content"],
	options?: {
		/**
		 * 指定消息对应的角色
		 * @default "user"
		 */
		role?: ChatCompletions.Message["role"];
		/** 指定消息对应的工具调用 ID */
		tool_call_id?: string;
	},
): ChatCompletions.Message => {
	const { role = "user", ...restOptions } = options ?? {};

	return {
		role,
		content,
		...restOptions,
	};
};

/**
 * 构造 OpenAI API 视觉类型的消息 content[] 字段
 * @param type 图片、音频、视频
 * @param url base64 或公网可访问的 URL
 * @param format 填写音频的格式，如 "wav"
 */
export const visionUrlToContentPart = (
	type: "image" | "video" | "audio",
	url: string,
	format?: string,
) => {
	const inputType =
		type === "image"
			? "image_url"
			: type === "video"
				? "video_url"
				: "input_audio";

	const contentPart: any = {
		type: inputType,
		[inputType]: {
			url,
		},
	};
	if (type === "audio") {
		contentPart[inputType]!.format = format || "wav";
		// base64 应该放在 data 字段，而不是 url
		if (!url.startsWith("http")) {
			delete contentPart[inputType].url;
			contentPart[inputType].data = url;
		}
	}

	return contentPart as ChatCompletions.ContentPart;
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
) => {
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
	const audioItems: string[] = [];

	const mentionedUserIds: string[] = [];
	const quotedMessages: ChatCompletions.Message[] = [];

	const modelInputModalities = modelRef.value?.inputModalities ?? [];

	/**
	 * 解析消息段数组
	 */
	for (const segment of e.message) {
		// 文字
		if (isTextSegment(segment)) {
			bodyItems.push(segment.data.text);
		}
		// 图片
		else if (isImageSegment(segment)) {
			const { url: tempUrl } = segment.data;
			const fallbackItem = "（无法识别图片）";

			// 1. 压缩并输出 base64
			const [error, base64] = await to(compressImage(tempUrl));
			if (error) {
				logger(`图片压缩失败：${error.message}`);
				imageItems.push(fallbackItem);
				continue;
			}

			// 2. 对于多模态，使用压缩后的 base64
			if (modelInputModalities.includes("image")) {
				imageItems.push(base64);
			}
			// 对于纯语言模型，使用多模态翻译后的自然语言
			else {
				const [error3, text] = await to(visionUrlToText(base64));
				if (error3) {
					logger(`图片翻译失败：${error3.message}`);
					imageItems.push(fallbackItem);
					continue;
				}
				imageItems.push(text);
			}
		}
		// 视频
		else if (isVideoSegment(segment)) {
			const { file: filename, file_id: fileId } = segment.data;
			const fallbackItem = "（无法识别视频）";

			// getFileUrl 需要 groupId
			if (!groupId) {
				videoItems.push(fallbackItem);
				continue;
			}

			// 1. 检查 WebDav 是否存在相同视频
			let webdavUrl = filename ? await checkSameFileName(filename) : "";
			if (!webdavUrl) {
				// 2. 读取视频
				const [error, fileUrl] = await to(getFileUrl(groupId, fileId));
				if (error) {
					logger(`获取视频失败：${error.message}`);
					videoItems.push(fallbackItem);
					continue;
				}

				// 3. 上传到 WebDav
				const [error2, url] = await to(uploadToWebdav(fileUrl, { filename }));
				if (error2) {
					logger(`上传视频失败：${error2.message}`);
					videoItems.push(fallbackItem);
					continue;
				}
				webdavUrl = url;
			}

			// 4. 对于多模态，WebDav URL
			if (modelInputModalities.includes("video")) {
				videoItems.push(webdavUrl);
			}
			// 对于纯语言模型，使用多模态翻译后的自然语言
			else {
				const [error3, text] = await to(visionUrlToText(webdavUrl));
				if (error3) {
					logger(`视频翻译失败：${error3.message}`);
					videoItems.push(fallbackItem);
					continue;
				}
				videoItems.push(text);
			}
		}
		// 音频
		// - 对于多模态，使用 base64
		// - 对于纯语言模型，使用多模态翻译后的自然语言
		else if (isAudioSegment(segment)) {
			const { file: filename } = segment.data;
			const fallbackItem = "[不具备音频理解能力，无法识别]";

			// 1. 读取音频
			const [error, record] = await to(getRecord(filename));
			if (error) {
				logger(`读取音频失败：${error.message}`);
				audioItems.push(fallbackItem);
				continue;
			}

			// 2. 将本地音频文件转为 base64
			const [error2, base64] = await to(
				readFile(record.file).then((buf) => buf.toString("base64")),
			);
			if (error2) {
				logger(`读取音频文件失败：${error2.message}`);
				audioItems.push(fallbackItem);
				continue;
			}

			// 3. 对于多模态，使用 base64
			if (modelInputModalities.includes("audio")) {
				audioItems.push(base64);
			}
			// 对于纯语言模型，使用多模态翻译后的自然语言
			else {
				const [error3, text] = await to(visionUrlToText(base64, "audio"));
				if (error3) {
					logger(`音频翻译失败：${error3.message}`);
					audioItems.push(fallbackItem);
					continue;
				}
				audioItems.push(text);
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

	/**
	 * 把散落的消息合并为一个复合数组返回
	 */
	return [
		// 上下文消息
		...quotedMessages,
		// 当前图片消息
		...imageItems.map((item) => {
			const content = item.startsWith("http")
				? [visionUrlToContentPart("image", item)]
				: createTagText("image", item, {
						sender_id: user_id,
						sender_name: nickname,
					});
			return contentToMessage(content);
		}),
		// 当前视频消息
		...videoItems.map((item) => {
			const content = item.startsWith("http")
				? [visionUrlToContentPart("video", item)]
				: createTagText("video", item, {
						sender_id: user_id,
						sender_name: nickname,
					});
			return contentToMessage(content);
		}),
		// 当前音频消息
		...audioItems.map((item) => {
			const content = item.startsWith("data:audio")
				? [visionUrlToContentPart("audio", item, "wav")]
				: createTagText("audio", item, {
						sender_id: user_id,
						sender_name: nickname,
					});
			return contentToMessage(content);
		}),
		// 当前消息
		bodyItems.length > 0 &&
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
	].filter(Boolean) as ChatCompletions.Message[];
};
