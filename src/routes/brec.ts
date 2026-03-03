import { log, sleep, to } from "@nickyzj2023/utils";
import type { Context } from "hono";
import { safeParse } from "valibot";
import { BrecWebhookSchema } from "@/schemas/bili.js";
import { sendGroupMessage, textToSegment } from "@/utils/onebot.js";

/** 直播推送 Webhook */
export const brecRoute = async (c: Context) => {
	// 检查是否填写推送群号
	const groupIds = (process.env.BREC_GROUP_IDS || "").split(",").map(Number);
	if (groupIds.length === 0) {
		return c.newResponse(null, 204);
	}

	// 验证请求体格式
	const body = await c.req.json();
	const validation = safeParse(BrecWebhookSchema, body);
	if (!validation.success) {
		return c.newResponse(null, 204);
	}

	// 筛选出已开播的
	const rooms = validation.output.filter((room) => room.live_status === 1);

	// 构造消息段
	for (const roomInfo of rooms) {
		let action = "";
		if (roomInfo.changedField === "live_status") {
			action = "播了";
		} else if (roomInfo.changedField === "title") {
			action = "换标题了";
		}

		const segments = [
			textToSegment(
				`${roomInfo.uname}${action}：${roomInfo.title}\n${roomInfo.live_url}`,
			),
		];

		// 推送到群里
		for (const groupId of groupIds) {
			const [error] = await to(sendGroupMessage(groupId, segments));
			if (error) {
				log(`直播推送失败：${error.message}`);
				break;
			}
			await sleep();
		}
	}

	return c.newResponse(null, 204);
};
