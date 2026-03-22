import { fetcher, getRealURL } from "@nickyzj2023/utils";
import { parse } from "valibot";
import {
  GetRoomBaseInfoSchema,
  type GetVideoDetail,
  GetVideoDetailSchema,
  type RoomInfo,
} from "@/schemas/bili.js";
import { formatNumberCompact } from "./common.js";
import { srcToImageSegment, textToSegment } from "./onebot.js";

const api = fetcher("https://api.bilibili.com/x/web-interface");
const liveApi = fetcher("https://api.live.bilibili.com/xlive/web-room/v1", {
  params: {
    req_biz: "web_room_componet",
  },
});

/**
 * 匹配 bilibili 链接的正则表达式
 * - http://www.bilibili.com/video/BV1abc123456
 * - https://live.bilibili.com/123456
 * - https://b23.tv/abc123XYZ
 */
const regexp =
  /http[s]?:\/\/\w+\.bilibili\.com\/[A-Za-z0-9?_=&/.]+|https:\/\/b23\.tv\/[A-Za-z0-9]+/;

/**
 * 解析 bilibili 链接，支持视频（BV号长链接、小程序短链接）、直播
 * @returns 解析后的干净链接 + 视频详情或直播详情 组成的对象
 */
export const resolveBiliLink = async (text: string, options?: { shouldToSegments: boolean }) => {
  const { shouldToSegments = false } = options ?? {};

  const link = text.match(regexp)?.[0];
  if (!link) {
    return;
  }

  // 还原短链接
  const url = new URL(link.includes("b23.tv") ? await getRealURL(link) : link);

  // 解析视频
  if (url.pathname.includes("/video/BV")) {
    // 使用bv号获取详情
    const bv = url.pathname.match(/BV[a-zA-Z0-9]+/)?.[0];
    const { data } = parse(GetVideoDetailSchema, await api.get(`/view?bvid=${bv}`));

    // 解析链接中携带的分p、空降参数
    const params = [];
    if (url.searchParams.has("p")) params.push(`p=${url.searchParams.get("p")}`);
    if (url.searchParams.has("t")) params.push(`t=${url.searchParams.get("t")}`);

    return {
      url: `${url.origin}${url.pathname}${params.length > 0 ? `?${params.join("&")}` : ""}`,
      videoDetail: data,
      segments: shouldToSegments ? videoDetailToSegments(data) : [],
    };
  }
  // 解析直播
  else if (url.hostname === "live.bilibili.com") {
    // 使用房间号获取详情
    const roomId = url.pathname.replace("/", "");
    const { data } = parse(
      GetRoomBaseInfoSchema,
      await liveApi.get(`/index/getRoomBaseInfo?room_ids=${roomId}`),
    );

    const roomInfo = Object.values(data.by_room_ids)[0];
    if (!roomInfo) {
      return;
    }

    return {
      url: `${url.origin}${url.pathname}`,
      roomInfo,
      segments: shouldToSegments ? roomInfoToSegments(roomInfo) : [],
    };
  }
};

export const videoDetailToSegments = (videoDetail: GetVideoDetail["data"]) => {
  const { pic, title, owner, duration, stat, pubdate, bvid } = videoDetail;
  return [
    srcToImageSegment(pic),
    textToSegment(
      [
        title,
        `@${owner.name}\n`,
        `视频时长：${Math.floor(duration / 60)}分${duration % 60}秒`,
        `发布时间：${new Date(pubdate * 1000).toLocaleString()}`,
        `${formatNumberCompact(stat.view)}播放 ${formatNumberCompact(stat.like)}点赞 ${formatNumberCompact(stat.coin)}硬币 ${formatNumberCompact(stat.favorite)}收藏`,
        `https://www.bilibili.com/video/${bvid}`,
      ].join("\n"),
    ),
  ];
};

export const roomInfoToSegments = (roomInfo: RoomInfo) => {
  const { cover, title, uname, live_status, area_name, live_time, live_url } = roomInfo;

  return [
    srcToImageSegment(cover),
    textToSegment(
      [
        title,
        `@${uname}`,
        `\n状态：${live_status === 1 ? "直播中" : "未开播"}`,
        `分区：${area_name}`,
        `开播时间：${live_time}`,
        live_url,
      ].join("\n"),
    ),
  ];
};
