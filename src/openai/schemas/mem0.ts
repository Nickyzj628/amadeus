// ================================
// mem0 记忆搜索接口
// ================================

import {
	array,
	type InferOutput,
	number,
	object,
	record,
	string,
	unknown,
} from "valibot";

/**
 * 单条记忆项
 * 对应 mem0 /memory/search 返回的 results 数组中的一项
 */
export const MemoryItemSchema = object({
	/** 记忆的唯一标识（UUID） */
	id: string(),
	/** 用户QQ号 */
	user_id: string(),
	/** 记忆内容文本 */
	memory: string(),
	/** 相关度评分，0~1，数值越大越相关 */
	score: number(),
	/** 附带的元数据，任意键值对（示例中为空对象） */
	metadata: record(string(), unknown()),
	/** 记忆所属分类，如 ["location"] */
	categories: array(string()),
	/** 创建时间（ISO 8601 字符串） */
	created_at: string(),
	/** 更新时间（ISO 8601 字符串） */
	updated_at: string(),
});
export type MemoryItem = InferOutput<typeof MemoryItemSchema>;

/** mem0 记忆搜索响应 */
export const Mem0SearchResponseSchema = object({
	results: array(MemoryItemSchema),
});
export type Mem0SearchResponse = InferOutput<typeof Mem0SearchResponseSchema>;
