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
	omit,
	optional,
	string,
} from "valibot";
import { GroupMessageEventSchema } from "./http-post.js";

/**
 * 创建通用响应 Schema
 */
const createResponseSchema = <TSchema extends GenericSchema>(
	dataSchema: TSchema,
) => {
	return object({
		status: string(),
		retcode: number(),
		message: optional(string()),
		data: dataSchema,
	});
};

/**
 * POST /get_forawrd_msg 结果
 */
export const GetForwardMessageResponseSchema = createResponseSchema(
	object({
		messages: array(GroupMessageEventSchema),
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
	omit(GroupMessageEventSchema, ["self_id"]),
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
	}),
);
export type GetRecordResponse = InferOutput<typeof GetRecordResponseSchema>;
