// ================================
// B站直播通知相关接口
// ================================

import { type InferOutput, number, object, record, string } from "valibot";

// --- 批量查询直播间状态 ---

export const RoomStatusSchema = object({
	room_id: number(),
	short_id: number(),
	uid: number(),
	/** 1为直播中，其他都是未开播 */
	live_status: number(),
	/** 时间戳，如1776666531，需要*1000 */
	live_time: number(),
	title: string(),
	/** 直播大区，如单机游戏 */
	area_v2_parent_name: string(),
	/** 细分直播分区，如我的世界 */
	area_v2_name: string(),
	uname: string(),
	/** 直播关键帧地址，优先取这个 */
	keyframe: string(),
	/** 直播间封面地址，次选这个 */
	cover_from_user: string(),
	/** 用户头像地址，兜底 */
	face: string(),
});
export type RoomStatus = InferOutput<typeof RoomStatusSchema>;

export const GetRoomStatusResponseSchema = object({
	code: number(),
	message: string(),
	data: record(string(), RoomStatusSchema),
});

// --- 查询直播间信息 ---
