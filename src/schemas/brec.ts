import { boolean, literal, number, object, string, union } from "valibot";

export const StreamEventSchema = object({
	// 使用 literal 确保 EventType 必须是 "StreamStarted"
	EventType: union([literal("StreamStarted"), literal("StreamEnded")]),
	EventTimestamp: string(), // 如果需要严格校验日期格式，可以使用 pipe 结合 isoTimestamp 或正则
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
