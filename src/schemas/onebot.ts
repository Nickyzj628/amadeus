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

/** 消息段联合 */
export const SegmentSchema = union([TextSegmentSchema, AtSegmentSchema]);
export type Segment = InferOutput<typeof SegmentSchema>;

/** 消息段数组 */
export const MessageSchema = array(SegmentSchema);
export type Message = InferOutput<typeof MessageSchema>;

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
	message: MessageSchema,
	/** 发送人信息 */
	sender: object({
		/** 发送者 QQ 号 */
		user_id: number(),
		/** 昵称 */
		nickname: string(),
		/** 昵称 */
		card: string(),
		/** 角色，owner 或 admin 或 member */
		role: union([literal("member"), literal("admin"), literal("owner")]),
	}),
});
export type GroupMessageEvent = InferOutput<typeof GroupMessageEventSchema>;
