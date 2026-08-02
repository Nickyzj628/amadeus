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

export const QueryRoomStatusResponseSchema = object({
	code: number(),
	message: string(),
	data: record(string(), RoomStatusSchema),
});

// --- 查询直播间信息 ---

export const RoomInfoSchema = object({
	room_id: number(),
	short_id: number(),
	uid: number(),
	/** 1为直播中，其他都是未开播 */
	live_status: number(),
	/** 时间字符串，如"2026-04-24 18:02:35" */
	live_time: string(),
	title: string(),
	/** 直播大区，如单机游戏 */
	parent_area_name: string(),
	/** 细分直播分区，如我的世界 */
	area_name: string(),
	/** 直播关键帧地址，优先取这个 */
	keyframe: string(),
	/** 直播间封面地址，次选这个 */
	user_cover: string(),
});
export type RoomInfo = InferOutput<typeof RoomInfoSchema>;

export const QueryRoomInfoResponseSchema = object({
	code: number(),
	message: string(),
	data: RoomInfoSchema,
});

// ================================
// B站非直播接口
// ================================

/**
 * 视频详情
 * @see https://api.bilibili.com/x/web-interface/view?bvid={bv}
 */
export const GetVideoDetailSchema = object({
	code: number(),
	message: string(),
	data: object({
		bvid: string(),
		aid: number(),
		pic: string(),
		title: string(),
		pubdate: number(),
		desc: string(),
		state: number(),
		/** 视频时长，单位秒 */
		duration: number(),
		owner: object({
			mid: number(),
			name: string(),
			face: string(),
		}),
		stat: object({
			view: number(),
			danmaku: number(),
			reply: number(),
			like: number(),
			coin: number(),
			favorite: number(),
			share: number(),
		}),
	}),
});
export type GetVideoDetail = InferOutput<typeof GetVideoDetailSchema>;
