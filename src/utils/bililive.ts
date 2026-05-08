import { fetcher, log, to } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import config from "@/config.js";
import type { CommonSegment } from "@/schemas/onebot/http-post.js";
import {
	QueryRoomInfoResponseSchema,
	QueryRoomStatusResponseSchema,
	type RoomStatus,
} from "../schemas/bili.js";
import { sendGroupMessage } from "./onebot/http.js";
import { srcToImageSegment, textToSegment } from "./onebot/segment.js";

const GROUP_IDS = config.brec?.groupIds ?? [];
const UIDS = config.brec?.uids ?? [];
const INTERVAL_MS = 60_000;

const roomIdStatusMap = new Map<number, RoomStatus>();

const liveApi = fetcher("https://api.live.bilibili.com/room/v1");

/** 批量查询直播间状态
 * @remarks 如果查询失败，会抛出异常
 * @see https://sessionhu.github.io/bilibili-API-collect/docs/live/info.html#批量查询直播间状态
 */
export const queryRoomInfoMapByUids = async (uids: number[]) => {
	const queryString = uids.map((id) => `uids[]=${id}`).join("&");
	const [error, response] = await to(
		liveApi.get(`/Room/get_status_info_by_uids?${queryString}`),
	);
	if (error) {
		throw new Error(`查询直播间状态失败：${error.message}`);
	}
	const { success, issues, output } = safeParse(
		QueryRoomStatusResponseSchema,
		response,
	);
	if (!success) {
		throw new Error(`查询直播间状态失败：${issues[0].message}`);
	}
	return output.data;
};

/**
 * 查询直播间信息
 * @remarks 如果查询失败，会抛出异常
 * @see https://sessionhu.github.io/bilibili-API-collect/docs/live/info.html#获取直播间信息
 */
export const queryRoomInfo = async (roomId: number | string) => {
	const [error, response] = await to(
		liveApi.get(`/Room/get_info?room_id=${roomId}`),
	);
	if (error) {
		throw new Error(`查询直播间信息失败：${error.message}`);
	}
	const { success, issues, output } = safeParse(
		QueryRoomInfoResponseSchema,
		response,
	);
	if (!success) {
		throw new Error(`查询直播间信息失败：${issues[0].message}`);
	}
	return output.data;
};

const checkAndSend = async () => {
	if (!GROUP_IDS.length || !UIDS.length) {
		log("未配置 brec.groupIds / brec.roomIds");
		return;
	}

	// 批量查询直播间状态
	const [error, info] = await to(queryRoomInfoMapByUids(UIDS));
	if (error) {
		log(error.message);
		return;
	}

	// 收集直播状态有变化的直播间
	const result = Object.values(info).reduce(
		(result, room) => {
			const roomId = room.short_id || room.room_id;
			const prevRoomStatus = roomIdStatusMap.get(roomId);
			roomIdStatusMap.set(roomId, room);

			// 初始化直播间状态，不推送通知
			if (!prevRoomStatus) {
				log(`初始化直播间：${roomId}（${room.uname}）`);
				return result;
			}

			// 检测直播间变化字段，若无变化，则不推送通知
			let changedField = "";
			if (prevRoomStatus.live_status !== room.live_status) {
				changedField = "live_status";
			} else if (prevRoomStatus.title !== room.title) {
				changedField = "title";
			} else {
				return result;
			}

			result.push({ ...room, changedField });
			return result;
		},
		[] as (RoomStatus & { changedField: string })[],
	);
	if (result.length === 0) {
		return;
	}

	// 构造消息段
	const livedRooms = result.filter((room) => room.live_status === 1);
	for (const room of livedRooms) {
		let action = "";
		if (room.changedField === "live_status") {
			action = "播了";
		} else if (room.changedField === "title") {
			action = "换标题了";
		}

		const imgUrl = room.keyframe || room.cover_from_user || room.face;
		const roomUrl = `https://live.bilibili.com/${room.short_id || room.room_id}`;
		const segments = [
			room.changedField === "live_status" && srcToImageSegment(imgUrl),
			textToSegment(`${room.uname}${action}：${room.title}\n${roomUrl}`),
		].filter(Boolean) as CommonSegment[];

		// 推送到群里
		for (const groupId of GROUP_IDS) {
			const [error] = await to(sendGroupMessage(groupId, segments));
			if (error) {
				log(`直播推送失败：${error.message}`);
				break;
			}
		}
	}
};

export const startBiliLiveTimer = () => {
	checkAndSend();
	const timer = setInterval(() => {
		checkAndSend();
	}, INTERVAL_MS);

	log("直播推送定时器已启动");
	return () => {
		clearInterval(timer);
	};
};
