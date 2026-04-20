import { fetcher, log, to } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import config from "@/config.js";
import {
	type BrecWebhook,
	GetRoomStatusSchema,
	type RoomStatus,
} from "../schemas/brec.js";
import { sendGroupMessage } from "./onebot/http.js";
import { srcToImageSegment, textToSegment } from "./onebot/segment.js";

const GROUP_IDS = config.brec?.groupIds ?? [];
const UIDS = config.brec?.uids ?? [];
const INTERVAL_MS = 60_000;

const roomIdStatusMap = new Map<number, RoomStatus>();

const liveApi = fetcher("https://api.live.bilibili.com/room/v1");

const runOnce = async () => {
	if (!GROUP_IDS.length || !UIDS.length) {
		log("未配置 brec.groupIds / brec.roomIds");
		return;
	}

	// 批量查询直播间状态
	// @see https://sessionhu.github.io/bilibili-API-collect/docs/live/info.html#%E6%89%B9%E9%87%8F%E6%9F%A5%E8%AF%A2%E7%9B%B4%E6%92%AD%E9%97%B4%E7%8A%B6%E6%80%81
	const queryString = UIDS.map((id) => `uids[]=${id}`).join("&");
	const [error, response] = await to(
		liveApi.get(`/Room/get_status_info_by_uids?${queryString}`),
	);
	if (error) {
		log(`查询直播间状态失败：${error.message}`);
		return;
	}

	// 校验数据结构
	const { success, issues, output } = safeParse(GetRoomStatusSchema, response);
	if (!success) {
		log(`查询直播间状态失败：${issues[0].message}`);
		return;
	}

	// 收集直播状态有变化的直播间
	const result: BrecWebhook = [];
	for (const room of Object.values(output.data)) {
		const roomId = room.short_id || room.room_id;
		const prevRoomStatus = roomIdStatusMap.get(roomId);
		roomIdStatusMap.set(roomId, room);

		// 初始化直播间状态，不推送通知
		if (!prevRoomStatus) {
			log(`初始化直播间：${roomId}（${room.uname}）`);
			continue;
		}

		// 检测直播间变化字段，若无变化，则不推送通知
		let changedField = "";
		if (prevRoomStatus.live_status !== room.live_status) {
			changedField = "live_status";
		} else if (prevRoomStatus.title !== room.title) {
			changedField = "title";
		} else {
			continue;
		}

		result.push({ ...room, changedField });
	}
	if (result.length === 0) {
		return;
	}

	// 筛选出已开播的
	const livedRooms = result.filter((room) => room.live_status === 1);

	// 构造消息段
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
			srcToImageSegment(imgUrl),
			textToSegment(`${room.uname}${action}：${room.title}\n${roomUrl}`),
		];

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

export const startBrecTimer = () => {
	runOnce();
	const timer = setInterval(() => {
		runOnce();
	}, INTERVAL_MS);

	log("直播推送定时器已启动");
	return () => {
		clearInterval(timer);
	};
};
