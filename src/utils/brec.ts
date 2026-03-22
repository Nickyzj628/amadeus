import { fetcher, log, to } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import config from "@/config.js";
import { type BrecWebhook, GetRoomInfoSchema, type RoomInfo } from "../schemas/brec.js";
import { sendGroupMessage, textToSegment } from "./onebot.js";

const GROUP_IDS = config.brec?.groupIds ?? [];
const ROOM_IDS = config.brec?.roomIds ?? [];
const INTERVAL_MS = 60_000;

const roomIdInfoMap = new Map<string, RoomInfo>();

const liveApi = fetcher("https://api.live.bilibili.com/xlive/web-room/v1", {
  params: {
    req_biz: "web_room_componet",
  },
});

const runOnce = async () => {
  if (!GROUP_IDS.length || !ROOM_IDS.length) {
    log("未配置 brec.groupIds / brec.roomIds");
    return;
  }

  // 批量获取直播间信息
  // @see https://sessionhu.github.io/bilibili-API-collect/docs/live/info.html#%E8%8E%B7%E5%8F%96%E7%9B%B4%E6%92%AD%E9%97%B4%E5%9F%BA%E6%9C%AC%E4%BF%A1%E6%81%AF
  const queryString = ROOM_IDS.map((id) => `room_ids=${id}`).join("&");
  const [error, response] = await to(liveApi.get(`/index/getRoomBaseInfo?${queryString}`));
  if (error) {
    log(`查询直播间信息失败：${error.message}`);
    return;
  }

  // 校验数据结构
  const validation = safeParse(GetRoomInfoSchema, response);
  if (!validation.success) {
    log(`查询直播间信息失败：${validation.issues[0].message}`);
    return;
  }

  // 收集直播状态有变化的直播间
  const { output } = validation;
  const result: BrecWebhook = [];
  for (const [roomId, roomInfo] of Object.entries(output.data.by_room_ids)) {
    const prevRoomInfo = roomIdInfoMap.get(roomId);
    roomIdInfoMap.set(roomId, roomInfo);

    // 初始化时不推送
    if (!prevRoomInfo) {
      log(`初始化直播间：${roomId}（${roomInfo.uname}）`);
      continue;
    }

    // 直播状态无变化时不推送
    let changedField = "";
    if (prevRoomInfo.live_status !== roomInfo.live_status) {
      changedField = "live_status";
    } else if (prevRoomInfo.title !== roomInfo.title) {
      changedField = "title";
    } else {
      continue;
    }

    result.push({ ...roomInfo, changedField });
  }

  if (!result.length) {
    return;
  }

  // 筛选出已开播的
  const rooms = result.filter((room) => room.live_status === 1);

  // 构造消息段
  for (const roomInfo of rooms) {
    let action = "";
    if (roomInfo.changedField === "live_status") {
      action = "播了";
    } else if (roomInfo.changedField === "title") {
      action = "换标题了";
    }

    const segments = [
      textToSegment(`${roomInfo.uname}${action}：${roomInfo.title}\n${roomInfo.live_url}`),
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
