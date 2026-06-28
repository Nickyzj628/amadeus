// ================================
// HTTP POST 相关类型，用于接收消息
// @see https://github.com/botuniverse/onebot-11/blob/master/event/message.md
// ================================

import {
	any,
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
} from "valibot";
import { normalizeText } from "@/common/util.js";
import config from "@/config.js";

/**
 * 纯文本消息段
 */
export const TextSegmentSchema = object({
	type: literal("text"),
	data: object({
		text: string(),
	}),
});
export type TextSegment = InferOutput<typeof TextSegmentSchema>;
export const isTextSegment = (segment?: Segment): segment is TextSegment => {
	return segment?.type === "text";
};

/**
 * 图片消息段
 */
export const ImageSegmentSchema = object({
	type: literal("image"),
	data: object({
		file: optional(string()),
		subType: optional(number()),
		url: string(),
		/** 单位字节 */
		file_size: optional(string()),
	}),
});
export type ImageSegment = InferOutput<typeof ImageSegmentSchema>;
export const isImageSegment = (segment?: Segment): segment is ImageSegment => {
	return segment?.type === "image";
};

/**
 * 文件消息段
 */
export const FileSegmentSchema = object({
	type: literal("file"),
	data: object({
		file: string(),
		file_id: string(),
		/** 单位字节 */
		file_size: string(),
	}),
});
export type FileSegment = InferOutput<typeof FileSegmentSchema>;
export const isFileSegment = (segment?: Segment): segment is FileSegment => {
	return segment?.type === "file";
};

/**
 * 视频消息段
 */
export const VideoSegmentSchema = object({
	type: literal("video"),
	data: object({
		file: string(),
		/** 单位字节 */
		file_size: string(),
		/** 临时地址，会过期 */
		url: string(),
	}),
});
export type VideoSegment = InferOutput<typeof VideoSegmentSchema>;
export const isVideoSegment = (segment?: Segment): segment is VideoSegment => {
	return segment?.type === "video";
};

/**
 * 音频消息段
 */
export const AudioSegmentSchema = object({
	type: literal("record"),
	data: object({
		file: string(),
		/** 临时地址，会过期 */
		url: string(),
		/**
		 * 本地文件路径
		 * @example "C:\\Users\\Administrator\\Documents\\Tencent Files\\3696448148\\nt_qq\\nt_data\\Ptt\\2026-05\\Ori\\eb103aa19edc119800182322413b3c7c.amr"
		 */
		path: string(),
		/** 单位字节 */
		file_size: string(),
	}),
});
export type AudioSegment = InferOutput<typeof AudioSegmentSchema>;
export const isAudioSegment = (segment?: Segment): segment is AudioSegment => {
	return segment?.type === "record";
};

/** @某人消息段 */
export const AtSegmentSchema = object({
	type: literal("at"),
	data: object({
		/** @的 QQ 号，all 表示全体成员 */
		qq: string(),
	}),
});
export type AtSegment = InferOutput<typeof AtSegmentSchema>;
export const isAtSegment = (segment?: Segment): segment is AtSegment => {
	return segment?.type === "at";
};
export const isAtSelfSegment = (segment?: Segment): segment is AtSegment => {
	const selfId = Number(config.bot.selfId);
	return isAtSegment(segment) && Number(segment.data.qq) === selfId;
};

/**
 * 合并转发消息段
 */
export const ForwardSegmentSchema = object({
	type: literal("forward"),
	data: object({
		/** 合并转发 ID，可通过 get_forward_msg API 获取具体转发内容 */
		id: string(),
		/** 嵌套的合并转发消息，已被NapCatQQ递归提取出实际内容，不用再获取 */
		content: optional(any()),
	}),
});
export type ForwardSegment = InferOutput<typeof ForwardSegmentSchema>;
export const isForwardSegment = (
	segment?: Segment,
): segment is ForwardSegment => {
	return segment?.type === "forward";
};

/**
 * 回复消息段
 */
export const ReplySegmentSchema = object({
	type: literal("reply"),
	data: object({
		/** 回复的消息 ID，可通过 /get_msg API 获取具体回复内容 */
		id: string(),
	}),
});
export type ReplySegment = InferOutput<typeof ReplySegmentSchema>;
export const isReplySegment = (segment?: Segment): segment is ReplySegment => {
	return segment?.type === "reply";
};

/**
 * 小程序消息段
 */
export const MiniProgramSegmentSchema = object({
	type: literal("json"),
	data: object({
		data: string(),
	}),
});
export type MiniProgramSegment = InferOutput<typeof MiniProgramSegmentSchema>;
export const isMiniProgramSegment = (
	segment?: Segment,
): segment is MiniProgramSegment => {
	return segment?.type === "json";
};

/**
 * 通用消息段
 */
export const SegmentSchema = union([
	TextSegmentSchema,
	ImageSegmentSchema,
	FileSegmentSchema,
	AudioSegmentSchema,
	VideoSegmentSchema,
	AtSegmentSchema,
	ForwardSegmentSchema,
	ReplySegmentSchema,
	MiniProgramSegmentSchema,
]);
export type Segment = InferOutput<typeof SegmentSchema>;

/**
 * 发送人信息
 */
export const SenderSchema = object({
	/** 发送者 QQ 号 */
	user_id: number(),
	/** 昵称 */
	nickname: string(),
});
export type Sender = InferOutput<typeof SenderSchema>;

/**
 * 群消息事件
 */
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
		array(SegmentSchema),
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
					isImageSegment(segment) ||
					isVideoSegment(segment) ||
					isAudioSegment(segment) ||
					isAtSegment(segment) ||
					isReplySegment(segment) ||
					isForwardSegment(segment)
				);
			}),
		),
	),
	/** 发送人信息 */
	sender: SenderSchema,
	/** 事件发生的时间戳（秒） */
	time: number(),
});
export type GroupMessageEvent = InferOutput<typeof GroupMessageEventSchema>;

/**
 * 大多数事件所需的最小 event 属性
 */
export type MinimalMessageEvent = {
	sender: Sender;
	message: Segment[];
};
