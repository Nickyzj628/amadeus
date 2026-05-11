// ================================
// HTTP POST 相关类型，用于接收消息
// @see https://github.com/botuniverse/onebot-11/blob/master/event/message.md
// ================================

import { isNil } from "@nickyzj2023/utils";
import {
	array,
	type InferOutput,
	literal,
	number,
	object,
	optional,
	pipe,
	string,
	transform,
	union,
	unknown,
} from "valibot";
import { normalizeText } from "@/common/util.js";
import config from "@/config.js";

// ================================
// 纯文本消息段
// ================================

export const TextSegmentSchema = object({
	type: literal("text"),
	data: object({
		text: string(),
	}),
});

export type TextSegment = InferOutput<typeof TextSegmentSchema>;

export const isTextSegment = (
	segment?: CommonSegment,
): segment is TextSegment => {
	return !isNil(segment) && segment.type === "text";
};

// ================================
// @某人消息段
// ================================

export const AtSegmentSchema = object({
	type: literal("at"),
	data: object({
		/** @的 QQ 号，all 表示全体成员 */
		qq: string(),
	}),
});

export type AtSegment = InferOutput<typeof AtSegmentSchema>;

export const isAtSegment = (segment?: CommonSegment): segment is AtSegment => {
	return !isNil(segment) && segment.type === "at";
};

export const isAtSelfSegment = (
	segment?: CommonSegment,
): segment is AtSegment => {
	const selfId = Number(config.bot.selfId);
	return isAtSegment(segment) && Number(segment.data.qq) === selfId;
};

// ================================
// 合并转发消息段
// ================================

export const ForwardSegmentSchema = object({
	type: literal("forward"),
	data: object({
		/** 合并转发 ID，需通过 get_forward_msg API 获取具体内容 */
		id: string(),
	}),
});

export type ForwardSegment = InferOutput<typeof ForwardSegmentSchema>;

export const isForwardSegment = (
	segment?: CommonSegment,
): segment is ForwardSegment => {
	return !isNil(segment) && segment.type === "forward";
};

// ================================
// 图片消息段
// ================================

export const ImageSegmentSchema = object({
	type: literal("image"),
	data: object({
		file: optional(string()),
		subType: optional(number()),
		url: string(),
		file_size: optional(string()),
	}),
});

export type ImageSegment = InferOutput<typeof ImageSegmentSchema>;

export const isImageSegment = (
	segment?: CommonSegment,
): segment is ImageSegment => {
	return !isNil(segment) && segment.type === "image";
};

// ================================
// 回复消息段
// ================================

export const ReplySegmentSchema = object({
	type: literal("reply"),
	data: object({
		/** 要回复的消息 ID，需通过 /get_msg API 获取具体内容 */
		id: string(),
	}),
});

export type ReplySegment = InferOutput<typeof ReplySegmentSchema>;

export const isReplySegment = (
	segment?: CommonSegment,
): segment is ReplySegment => {
	return !isNil(segment) && segment.type === "reply";
};

// ================================
// 小程序消息段
// ================================

export const MiniProgramSegmentSchema = object({
	type: literal("json"),
	data: object({
		data: string(),
	}),
});

export type MiniProgramSegment = InferOutput<typeof MiniProgramSegmentSchema>;

export const isMiniProgramSegment = (
	segment?: CommonSegment,
): segment is MiniProgramSegment => {
	return !isNil(segment) && segment.type === "json";
};

// ================================
// 文件（视频）消息段
// ================================

export const FileSegmentSchema = object({
	type: literal("file"),
	data: object({
		file: string(),
		file_id: string(),
		file_size: string(),
	}),
});

export type FileSegment = InferOutput<typeof FileSegmentSchema>;

export type VideoSegment = InferOutput<typeof FileSegmentSchema>;

export const isFileSegment = (
	segment?: CommonSegment,
): segment is FileSegment => {
	return !isNil(segment) && segment.type === "file";
};

export const isVideoSegment = (
	segment?: CommonSegment,
): segment is VideoSegment => {
	if (!isFileSegment(segment)) {
		return false;
	}
	return segment.data.file.endsWith(".mp4");
};

// ================================
// 通用消息段
// ================================

export const CommonSegmentSchema = object({
	type: string(),
	data: unknown(),
});

export type CommonSegment = InferOutput<typeof CommonSegmentSchema>;

export const SegmentSchema = union([
	TextSegmentSchema,
	AtSegmentSchema,
	ForwardSegmentSchema,
	ImageSegmentSchema,
	ReplySegmentSchema,
	FileSegmentSchema,
]);

export type Segment = InferOutput<typeof SegmentSchema>;

/** 发送人信息 */
export const SenderSchema = object({
	/** 发送者 QQ 号 */
	user_id: number(),
	/** 昵称 */
	nickname: string(),
});

export type Sender = InferOutput<typeof SenderSchema>;

/** 群消息事件 */
export const GroupMessageEventSchema = object({
	/** 收到事件的机器人 QQ 号 */
	self_id: number(),
	/** 发送者 QQ 号 */
	user_id: number(),
	/** 群号 */
	group_id: number(),
	/** 消息类型，如果是群聊则是group，如果是私聊则是private。私聊逻辑稍后实现 */
	message_type: literal("group"),
	/** 消息 ID */
	message_id: number(),
	/** 消息段数组 */
	message: pipe(
		array(CommonSegmentSchema),
		// 过滤不支持的消息段类型和空文本消息
		transform((segments) =>
			segments.filter((segment) => {
				if (isTextSegment(segment)) {
					segment.data.text = normalizeText(segment.data.text);
					return segment.data.text !== "";
				}
				if (isMiniProgramSegment(segment)) {
					segment.data.data = JSON.parse(segment.data.data);
					return true;
				}
				return (
					isAtSegment(segment) ||
					isForwardSegment(segment) ||
					isImageSegment(segment) ||
					isReplySegment(segment) ||
					isVideoSegment(segment)
				);
			}),
		),
	),
	/** 发送人信息 */
	sender: SenderSchema,
});

export type GroupMessageEvent = InferOutput<typeof GroupMessageEventSchema>;

export type MinimalMessageEvent = Pick<
	GroupMessageEvent,
	"message" | "sender" | "group_id"
>;
