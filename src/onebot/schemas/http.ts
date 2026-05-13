// ================================
// HTTP 相关类型，用于主动发请求
// @see https://api.luckylillia.com/doc-5416163
// ================================

import {
	array,
	type GenericSchema,
	type InferOutput,
	number,
	object,
	string,
} from "valibot";
import {
	GroupMessageEventSchema,
	SegmentSchema,
	SenderSchema,
} from "./http-post.js";

/**
 * 创建通用响应 Schema
 */
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

/**
 * POST /get_forawrd_msg 结果
 */
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

/**
 * POST /get_group_msg_history 结果
 */
export const GetMessageHistoryResponseSchema = createResponseSchema(
	object({
		messages: array(GroupMessageEventSchema),
	}),
);
export type GetMessageHistoryResponse = InferOutput<
	typeof GetMessageHistoryResponseSchema
>;

/**
 * POST /get_msg 结果
 */
export const GetMessageResponseSchema = createResponseSchema(
	GroupMessageEventSchema,
);
export type GetMessageResponse = InferOutput<typeof GetMessageResponseSchema>;

/**
 * POST /get_group_file_url 结果
 */
export const GetGroupFileUrlResponseSchema = createResponseSchema(
	object({
		url: string(),
	}),
);
export type GetGroupFileUrlResponse = InferOutput<
	typeof GetGroupFileUrlResponseSchema
>;

/**
 * POST /get_record 结果
 */
export const GetRecordResponseSchema = createResponseSchema(
	object({
		file: string(),
		file_size: string(),
		file_name: string(),
		base64: string(),
	}),
);
export type GetRecordResponse = InferOutput<typeof GetRecordResponseSchema>;
