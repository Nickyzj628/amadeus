import { fetcher, getRealURL, logger } from "@nickyzj2023/utils";
import { parse } from "valibot";
import { queryRoomInfo } from "@/common/bililive.js";
import type { RoomInfo } from "@/common/schemas/bili.js";
import {
	type GetVideoDetail,
	GetVideoDetailSchema,
} from "@/common/schemas/bili.js";
import { formatNumberCompact } from "@/common/util.js";
import type { Segment } from "../schemas/http-post.js";
import { srcToImageSegment, textToSegment } from "../utils/segment.js";

const api = fetcher("https://api.bilibili.com/x/web-interface");

/**
 * 匹配 bilibili 链接的正则表达式
 * - http(s)://(www.)bilibili.com/video/BV1abc123456
 * - https://live.bilibili.com/123456
 * - https://b23.tv/abc123XYZ
 */
const regexp =
	/http[s]?:\/\/\w+\.bilibili\.com\/[A-Za-z0-9?_=&/.]+|https:\/\/b23\.tv\/[A-Za-z0-9]+/;

/**
 * 解析 bilibili 链接，支持视频（BV号长链接、小程序短链接）、直播
 * @remarks 解析失败会抛出异常
 * @returns 解析后的干净链接 + 视频详情或直播详情 组成的对象
 * @remarks 为防群内多个支持解析B站链接的机器人循环发消息，故设定5秒节流
 */
export const resolveBiliLink = async (text: string) => {
	const link = text.match(regexp)?.[0];
	if (!link) {
		throw new Error(`链接格式解析失败：${link}`);
	}

	// 还原短链接
	const url = new URL(link.includes("b23.tv") ? await getRealURL(link) : link);

	// 识别链接类型
	const type = url.pathname.includes("/video/BV")
		? "video"
		: url.hostname === "live.bilibili.com"
			? "live"
			: "";
	if (type === "") {
		return {};
	}

	// 解析视频
	if (type === "video") {
		// 使用bv号获取详情
		const bv = url.pathname.match(/BV[a-zA-Z0-9]+/)?.[0];
		const videoDetail = await api.get(`/view?bvid=${bv}`);
		const { data } = parse(GetVideoDetailSchema, videoDetail);

		// 解析链接中携带的分p、空降参数
		const params = [];
		if (url.searchParams.has("p"))
			params.push(`p=${url.searchParams.get("p")}`);
		if (url.searchParams.has("t"))
			params.push(`t=${url.searchParams.get("t")}`);

		const cleanUrl = `${url.origin}${url.pathname}${params.length > 0 ? `?${params.join("&")}` : ""}`;
		logger(`解析到B站视频：${cleanUrl}`);

		return {
			url: cleanUrl,
			videoDetail: data,
		};
	}

	// 解析直播
	// 使用房间号获取详情
	const roomId = url.pathname.replace("/", "");
	const roomInfo = await queryRoomInfo(roomId);

	const cleanUrl = `${url.origin}${url.pathname}`;
	logger(`解析到B站直播：${cleanUrl}`);
	return {
		url: cleanUrl,
		roomInfo,
	};
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
	const {
		keyframe,
		title,
		live_status,
		area_name,
		live_time,
		short_id,
		room_id,
	} = roomInfo;

	return [
		keyframe && srcToImageSegment(keyframe /** || user_cover */),
		textToSegment(
			[
				title,
				`\n状态：${live_status === 1 ? "直播中" : "未开播"}`,
				`分区：${area_name}`,
				`开播时间：${live_time}`,
				`https://live.bilibili.com/${short_id || room_id}`,
			].join("\n"),
		),
	].filter(Boolean) as Segment[];
};
