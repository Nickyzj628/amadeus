import {
	array,
	type InferOutput,
	number,
	object,
	record,
	string,
} from "valibot";

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
export const GetRoomInfoSchema = object({
	code: number(),
	message: string(),
	data: object({
		// by_uids: record(string(), object({})),
		by_room_ids: record(string(), RoomInfoSchema),
	}),
});
export type LiveDetailResponse = InferOutput<typeof GetRoomInfoSchema>;

/**
 * 直播通知推送
 * @see src\utils\brec.ts:21
 */
export const BrecWebhookSchema = array(
	object({
		...RoomInfoSchema.entries,
		changedField: string(),
	}),
);
export type BrecWebhook = InferOutput<typeof BrecWebhookSchema>;
