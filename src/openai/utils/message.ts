import { type ChatCompletions, log, to } from "@nickyzj2023/utils";
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
import { imageUrlToText } from "./generate-content.js";

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

/** 构造 OpenAI API 图片类型的消息 content[] 字段 */
export const imageUrlToContentPart = (
	url: string,
): ChatCompletions.ContentPart => {
	return {
		type: "image_url",
		image_url: {
			url,
		},
	};
};

/** 构造 OpenAI API 视频类型的消息 content[] 字段 */
export const videoUrlToContentPart = (
	url: string,
): ChatCompletions.ContentPart => {
	return {
		type: "video_url",
		video_url: {
			url,
		},
	};
};

/** 构造 OpenAI API 视频类型的消息 content[] 字段 */
export const audioUrlToContentPart = (
	url: string,
	format = "wav", // 不要用 mp3，POST get_record 时会报错
): ChatCompletions.ContentPart => {
	return {
		type: "input_audio",
		input_audio: {
			url,
			format,
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
			const { file = "", url: tempUrl } = segment.data;
			const [filename, ext] = file.split(".");
			const fallbackItem = "[无法识别图片]";

			// 1. 检查 WebDav 是否存在相同图片
			let webdavUrl = filename
				? await checkSameFileName(`${filename}.webp`)
				: "";
			if (!webdavUrl) {
				// 2. 压缩到 720P、10MB 以内
				const [error, optimizedImage] = await to(compressImage(tempUrl));
				if (error) {
					log(`图片压缩失败：${error.message}`);
					imageItems.push(fallbackItem);
					continue;
				}

				// 3. 上传到 WebDav
				const optimizedImageExt = optimizedImage.split(".").pop() ?? "webp";
				const [error2, tempUrl2] = await to(
					uploadToWebdav(optimizedImage, {
						filename: `${filename}.${optimizedImageExt}`,
					}),
				);
				if (error2) {
					log(`图片上传失败：${error2.message}`);
					imageItems.push(fallbackItem);
					continue;
				}
				webdavUrl = tempUrl2;
			}

			// 4. 对于多模态，使用 WebDav URL
			if (modelInputModalities.includes("image")) {
				imageItems.push(webdavUrl);
			}
			// 对于纯语言模型，使用多模态处理后的自然语言
			else {
				const [error3, text] = await to(imageUrlToText(webdavUrl));
				if (error3) {
					log(`图片翻译失败：${error3.message}`);
					imageItems.push(fallbackItem);
					continue;
				}
				imageItems.push(text);
			}
		}
		// 视频
		// - 对于多模态，使用上传到 WebDav 后的视频 URL
		// - 对于纯语言模型，用“无法识别视频”占位
		else if (isVideoSegment(segment)) {
			const { file: filename, file_id: fileId } = segment.data;
			const fallbackItem = "[不具备视频理解能力，无法识别]";

			if (!modelInputModalities.includes("video") || !groupId) {
				videoItems.push(fallbackItem);
				continue;
			}

			// 1. 检查 WebDav 是否存在相同视频
			let webdavUrl = filename ? await checkSameFileName(filename) : "";
			if (!webdavUrl) {
				// 2. 读取视频
				const [error, fileUrl] = await to(getFileUrl(groupId, fileId));
				if (error) {
					log(`获取视频失败：${error.message}`);
					videoItems.push(fallbackItem);
					continue;
				}

				// 3. 上传到 WebDav
				const [error2, url] = await to(uploadToWebdav(fileUrl, { filename }));
				if (error2) {
					log(`上传视频失败：${error2.message}`);
					videoItems.push(fallbackItem);
					continue;
				}
				webdavUrl = url;
			}
			// 4. 使用 WebDav URL
			videoItems.push(webdavUrl);
		}
		// 音频
		// - 对于多模态，使用上传到 WebDav 后的视频 URL
		// - 对于纯语言模型，用“无法识别视频”占位
		else if (isAudioSegment(segment)) {
			const { file: filename, path } = segment.data;
			const fallbackItem = "[不具备音频理解能力，无法识别]";

			if (!modelInputModalities.includes("audio")) {
				audioItems.push(fallbackItem);
				continue;
			}

			// 1. 检查 WebDav 是否存在相同音频
			let webdavUrl = filename
				? await checkSameFileName(`${filename}.wav`)
				: "";
			if (!webdavUrl) {
				// 2. 读取音频
				const [error, record] = await to(getRecord(filename));
				if (error) {
					log(`读取音频失败：${error.message}`);
					audioItems.push(fallbackItem);
					continue;
				}
				// 3. 上传到 WebDav
				const [error2, url] = await to(
					uploadToWebdav(record.file, { filename: record.file_name }),
				);
				if (error2) {
					log(`上传音频失败：${error2.message}`);
					audioItems.push(fallbackItem);
					continue;
				}
				webdavUrl = url;
			}
			// 4. 使用 WebDav URL
			audioItems.push(webdavUrl);
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
		// 当前音频消息
		...audioItems.map((item) => {
			const content = item.startsWith("http")
				? [audioUrlToContentPart(item)]
				: createTagText("video", item, {
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
