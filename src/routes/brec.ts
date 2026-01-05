import { timeLog, to } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { StreamEventSchema } from "@/schemas/brec";
import { http, reply, textToSegment } from "@/utils/onebot";

export const brecRoute = {
	POST: async (req: Request) => {
		// 验证请求体格式
		const body = await req.json();
		const validation = safeParse(StreamEventSchema, body);
		if (!validation.success) {
			return reply();
		}

		// 构造消息
		const { Name, Streaming, Title, RoomId } = validation.output.EventData;
		if (!Streaming) {
			return reply();
		}
		const segment = textToSegment(
			`${Name}播了：${Title}\nhttps://live.bilibili.com/${RoomId}`,
		);

		// 推送到群里
		const groupIds = (Bun.env.BREC_GROUP_IDS || "").split(",");
		if (groupIds.length === 0) {
			return reply();
		}
		for (const groupId of groupIds) {
			const [error, response] = await to(
				http.post("/send_group_msg", {
					group_id: groupId,
					message: [segment],
				}),
			);
			if (error) {
				timeLog(`直播推送失败：${error.message}`);
				break;
			}
		}
		return reply();
	},
};
