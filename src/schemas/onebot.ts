import {
	array,
	type GenericSchema,
	type InferOutput,
	literal,
	number,
	object,
	pipe,
	string,
	transform,
	union,
	unknown,
} from "valibot";
import {
	isAtSegment,
	isForwardSegment,
	isImageSegment,
	isTextSegment,
} from "@/utils/onebot";

// ================================
// HTTP POST 相关类型，用于接收消息
// @see https://github.com/botuniverse/onebot-11/blob/master/event/message.md
// ================================

/** 纯文本消息段 */
export const TextSegmentSchema = object({
	type: literal("text"),
	data: object({
		text: string(),
	}),
});
export type TextSegment = InferOutput<typeof TextSegmentSchema>;

/** @某人消息段 */
export const AtSegmentSchema = object({
	type: literal("at"),
	data: object({
		/** @的 QQ 号，all 表示全体成员 */
		qq: string(),
	}),
});
export type AtSegment = InferOutput<typeof AtSegmentSchema>;

/** 合并转发消息段 */
export const ForwardSegmentSchema = object({
	type: literal("forward"),
	data: object({
		/** 合并转发 ID，需通过 get_forward_msg API 获取具体内容 */
		id: string(),
	}),
});
export type ForwardSegment = InferOutput<typeof ForwardSegmentSchema>;

/** 图片消息段 */
export const ImageSegmentSchema = object({
	type: literal("image"),
	data: object({
		file: string(),
		subType: number(),
		url: string(),
		file_size: string(),
	}),
});
export type ImageSegment = InferOutput<typeof ImageSegmentSchema>;

/** 通用消息段联合 */
export const CommonSegmentSchema = object({
	type: string(),
	data: unknown(),
});
export type CommonSegment = InferOutput<typeof CommonSegmentSchema>;

/** 当前代码支持的消息段联合 */
export const SegmentSchema = union([
	TextSegmentSchema,
	AtSegmentSchema,
	ForwardSegmentSchema,
	ImageSegmentSchema,
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
				if (
					!isTextSegment(segment) &&
					!isAtSegment(segment) &&
					!isForwardSegment(segment) &&
					!isImageSegment(segment)
				) {
					return false;
				}
				if (isTextSegment(segment)) {
					segment.data.text = segment.data.text
						// 移除可能残留的思考标签及其内容
						.replace(/<think>[\s\S]*?<\/think>/gi, "")
						// 移除孤立的闭合思考标签
						.replace(/<\/think>/gi, "")
						// 移除元数据标签
						.replace(/\[FROM:.*?\]|\[BODY:.*?\]|\[IMAGE_PARSED:.*?\]/gi, "")
						.trim();
					return segment.data.text !== "";
				}
				return true;
			}),
		),
	),
	/** 发送人信息 */
	sender: SenderSchema,
});
export type GroupMessageEvent = InferOutput<typeof GroupMessageEventSchema>;
export type MinimalMessageEvent = Pick<GroupMessageEvent, "message" | "sender">;

// ================================
// HTTP 相关类型，用于主动发请求
// @see https://api.luckylillia.com/doc-5416163
// ================================

/** 创建通用响应 Schema */
const createResponseSchema = <TSchema extends GenericSchema>(
	dataSchema: TSchema,
) => {
	return object({
		status: string(),
		retcode: number(),
		message: string(),
		data: dataSchema,
	});
};

/** POST /get_forawrd_msg 结果 */
export const GetForwardMessageResponseSchema = createResponseSchema(
	object({
		messages: array(
			object({
				content: array(SegmentSchema),
				sender: SenderSchema,
				time: number(),
				message_format: string(),
				message_type: string(),
			}),
		),
	}),
);
export type GetForwardMessageResponse = InferOutput<
	typeof GetForwardMessageResponseSchema
>;
export type ForwardMessage =
	GetForwardMessageResponse["data"]["messages"][number];

/** POST /get_group_msg_history 结果 */
export const GetMessageHistoryResponseSchema = createResponseSchema(
	object({
		messages: array(GroupMessageEventSchema),
	}),
);
export type GetMessageHistoryResponse = InferOutput<
	typeof GetMessageHistoryResponseSchema
>;
