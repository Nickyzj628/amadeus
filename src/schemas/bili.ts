// ================================
// B站非直播接口
// ================================

import {
	array,
	type InferOutput,
	number,
	object,
	record,
	string,
} from "valibot";

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

export const RoomInfoSchema = object({
	room_id: number(),
	short_id: number(),
	uid: number(),
	/** 1=直播中，其他都是未开播 */
	live_status: number(),
	live_url: string(),
	live_time: string(),
	title: string(),
	parent_area_name: string(),
	area_name: string(),
	uname: string(),
	cover: string(),
});
export type RoomInfo = InferOutput<typeof RoomInfoSchema>;

/**
 * 直播间详情
 * @see https://api.live.bilibili.com/room/v1/Room/get_info?room_id={roomId}
 */
export const GetRoomBaseInfoSchema = object({
	code: number(),
	message: string(),
	data: object({
		// by_uids: record(string(), object({})),
		by_room_ids: record(string(), RoomInfoSchema),
	}),
});
export type GetRoomBaseInfo = InferOutput<typeof GetRoomBaseInfoSchema>;

/**
 * 直播通知推送
 * @see backend\src\utils\brec.ts:21
 */
export const BrecWebhookSchema = array(
	object({
		...RoomInfoSchema.entries,
		changedField: string(),
	}),
);
