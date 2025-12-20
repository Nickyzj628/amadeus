// --- HTTP 相关类型，用于主动发请求 ---

import { array, type InferOutput, number, object, string } from "valibot";
import {
	type Segment,
	SegmentSchema,
	type Sender,
	SenderSchema,
	type TextSegment,
} from "./http-post";

/** POST /get_forawrd_msg 返回结果 */
export const GetForwardMessageResponseSchema = object({
	status: string(),
	retCode: number(),
	message: string(),
	data: object({
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
});
export type GetForwardMessageResponse = InferOutput<
	typeof GetForwardMessageResponseSchema
>;
export type ForwardMessage =
	GetForwardMessageResponse["data"]["messages"][number];
export type ForwardMessageSingle = {
	/** 暂时只支持纯文本消息段 */
	segment: TextSegment;
	sender: Sender;
	time: number;
};
