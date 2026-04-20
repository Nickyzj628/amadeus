import {
	array,
	type InferOutput,
	number,
	object,
	record,
	string,
} from "valibot";

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

/**
 * 直播间状态
 * @see https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids?uids[]=70093&uids[]=13046
 */
export const GetRoomStatusSchema = object({
	code: number(),
	message: string(),
	data: record(string(), RoomStatusSchema),
});
export type LiveDetailResponse = InferOutput<typeof GetRoomStatusSchema>;

/**
 * 直播通知推送
 * @see src\utils\brec.ts:21
 */
export const BrecWebhookSchema = array(
	object({
		...RoomStatusSchema.entries,
		changedField: string(),
	}),
);
export type BrecWebhook = InferOutput<typeof BrecWebhookSchema>;
