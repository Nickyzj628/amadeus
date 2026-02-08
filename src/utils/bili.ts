import { fetcher } from "@nickyzj2023/utils";
import { parse } from "valibot";
import {
	LiveDetailResponseSchema,
	VideoDetailResponseSchema,
} from "@/schemas/bili";

const api = fetcher("https://api.bilibili.com/x/web-interface");
const liveApi = fetcher("https://api.live.bilibili.com");

/**
 * 匹配 bilibili 链接的正则表达式
 * - https://www.bilibili.com/video/BV1abc123456
 * - https://live.bilibili.com/123456
 * - https://b23.tv/abc123XYZ
 */
const regexp =
	/https:\/\/\w+\.bilibili\.com\/[A-Za-z0-9?_=&/.]+|https:\/\/b23\.tv\/[A-Za-z0-9]+/;

/** 从 url 响应头获取真实链接 */
const expandShortURL = async (shortUrl: string) => {
	const response = await fetch(shortUrl, {
		redirect: "manual", // 手动处理重定向
	});

	const location = response.headers.get("location");
	return location || shortUrl;
};

/**
 * 解析 bilibili 链接，支持视频（BV号长链接、小程序短链接）、直播
 * @returns 解析后的干净链接 + 视频详情或直播详情 组成的对象
 */
export const resolveBiliLink = async (text: string) => {
	const link = text.match(regexp)?.[0];
	if (!link) {
		return;
	}

	// 还原短链接
	const url = new URL(
		link.includes("b23.tv") ? await expandShortURL(link) : link,
	);

	// 解析视频
	if (url.pathname.includes("/video/BV")) {
		// 使用bv号获取详情
		const bv = url.pathname.match(/BV[a-zA-Z0-9]+/)?.[0];
		const { data } = parse(
			VideoDetailResponseSchema,
			await api.get(`/view?bvid=${bv}`),
		);

		// 解析链接中携带的分p、空降参数
		const params = [];
		if (url.searchParams.has("p"))
			params.push(`p=${url.searchParams.get("p")}`);
		if (url.searchParams.has("t"))
			params.push(`t=${url.searchParams.get("t")}`);

		return {
			url: `${url.origin}${url.pathname}${params.length > 0 ? `?${params.join("&")}` : ""}`,
			videoDetail: data,
		};
	}
	// 解析直播
	else if (url.hostname === "live.bilibili.com") {
		// 使用房间号获取详情
		const roomId = url.pathname.replace("/", "");
		const { data } = parse(
			LiveDetailResponseSchema,
			await liveApi.get(`/room/v1/Room/get_info?room_id=${roomId}`),
		);

		return {
			url: `${url.origin}${url.pathname}`,
			liveDetail: data,
		};
	}
};
