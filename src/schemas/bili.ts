import {
	boolean,
	type InferOutput,
	literal,
	number,
	object,
	string,
	union,
} from "valibot";

/**
 * 直播姬 Webhook 事件
 */
export const StreamEventSchema = object({
	EventType: union([literal("StreamStarted"), literal("StreamEnded")]),
	EventTimestamp: string(),
	EventId: string(),
	EventData: object({
		RoomId: number(),
		ShortId: number(),
		Name: string(),
		Title: string(),
		AreaNameParent: string(),
		AreaNameChild: string(),
		Recording: boolean(),
		Streaming: boolean(),
		DanmakuConnected: boolean(),
	}),
});

/**
 * 视频详情
 * @see https://api.bilibili.com/x/web-interface/view?bvid={bv}
 */
export const VideoDetailResponseSchema = object({
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

export type VideoDetailResponse = InferOutput<typeof VideoDetailResponseSchema>;
export type VideoDetail = InferOutput<typeof VideoDetailResponseSchema>["data"];

/**
 * 直播间详情
 * @see https://api.live.bilibili.com/room/v1/Room/get_info?room_id={roomId}
 */
export const LiveDetailResponseSchema = object({
	code: number(),
	message: string(),
	data: object({
		room_id: number(),
		short_id: number(),
		/** 1为直播中，其他为未正式开播 */
		live_status: number(),
		/** 未开播时为 "0000-00-00 00:00:00" */
		live_time: string(),
		title: string(),
		/** 直播封面 */
		user_cover: string(),
		/** 直播截图 */
		keyframe: string(),
	}),
});

export type LiveDetailResponse = InferOutput<typeof LiveDetailResponseSchema>;
export type LiveDetail = InferOutput<typeof LiveDetailResponseSchema>["data"];
