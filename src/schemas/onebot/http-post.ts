// --- HTTP POST 相关类型，用于接收消息 ---
// @see https://github.com/botuniverse/onebot-11/blob/master/event/message.md

import {
	array,
	type InferOutput,
	literal,
	number,
	object,
	string,
	union,
} from "valibot";

/** 纯文本消息 */
export const TextSegmentSchema = object({
	type: literal("text"),
	data: object({
		text: string(),
	}),
});
export type TextSegment = InferOutput<typeof TextSegmentSchema>;

/** @某人消息 */
export const AtSegmentSchema = object({
	type: literal("at"),
	data: object({
		/** @的 QQ 号，all 表示全体成员 */
		qq: string(),
	}),
});
export type AtSegment = InferOutput<typeof AtSegmentSchema>;

/** 合并转发消息 */
export const ForwardSegmentSchema = object({
	type: literal("forward"),
	data: object({
		/** 合并转发 ID，需通过 get_forward_msg API 获取具体内容 */
		id: string(),
	}),
});
export type ForwardSegment = InferOutput<typeof ForwardSegmentSchema>;

/** 消息段联合 */
export const SegmentSchema = union([
	TextSegmentSchema,
	AtSegmentSchema,
	ForwardSegmentSchema,
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
	message: array(SegmentSchema),
	/** 发送人信息 */
	sender: SenderSchema,
});
export type GroupMessageEvent = InferOutput<typeof GroupMessageEventSchema>;
