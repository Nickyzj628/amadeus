// ================================
// HTTP 相关类型，用于主动发请求
// @see https://api.luckylillia.com/doc-5416163
// ================================

import { array, type InferOutput, number, object, string } from "valibot";
import {
	GroupMessageEventSchema,
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

/** POST /get_msg 返回结果 */
export const GetMessageResponseSchema = object({
	status: string(),
	retCode: number(),
	message: string(),
	data: GroupMessageEventSchema,
});
export type GetMessageResponse = InferOutput<typeof GetMessageResponseSchema>;
