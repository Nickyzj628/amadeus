import { fetcher, logger, to } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import config from "@/config.js";
import {
	GetForwardMessageResponseSchema,
	GetGroupFileUrlResponseSchema,
	GetMessageHistoryResponseSchema,
	GetMessageResponseSchema,
	GetRecordResponseSchema,
} from "@/onebot/schemas/http.js";
import {
	isForwardSegment,
	type MinimalMessageEvent,
	type Segment,
} from "@/onebot/schemas/http-post.js";

const api = fetcher(`http://127.0.0.1:${config.bot.onebotHttpPort}`);

/**
 * 获取群历史消息
 * @see https://api.luckylillia.com/api-156808591
 */
export const getGroupMessageHistory = async (groupId: number, count = 30) => {
	const response = await api.post("/get_group_msg_history", {
		group_id: groupId,
		count,
	});

	const validation = safeParse(GetMessageHistoryResponseSchema, response);
	if (!validation.success) {
		throw new Error(validation.issues[0].message);
	}

	return validation.output.data.messages;
};

/**
 * 获取消息详情
 * @see https://api.luckylillia.com/api-147574979
 */
export const getMessage = async (messageId: string) => {
	const response = await api.post("/get_msg", {
		message_id: messageId,
	});

	const validation = safeParse(GetMessageResponseSchema, response);
	if (!validation.success) {
		throw new Error(validation.issues[0].message);
	}

	return validation.output.data;
};

/**
 * 获取转发消息详情
 * @see https://api.luckylillia.com/api-159742006
 */
export const getForwardMessage = async (messageId: string) => {
	const response = await api.post("/get_forward_msg", {
		message_id: messageId,
	});

	const validation = safeParse(GetForwardMessageResponseSchema, response);
	if (!validation.success) {
		throw new Error(validation.issues[0].message);
	}

	return validation.output.data.messages;
};

/**
 * 递归查询转发消息详情
 * @remarks 保证安全返回数组，即使报错也返回空数组
 */
export const getForwardMessages = async (
	messageId: string,
	count: number,
): Promise<MinimalMessageEvent[]> => {
	const [error, response] = await to(getForwardMessage(messageId));
	if (error) {
		logger(`查询合并转发消息失败：${error.message}`);
		return [];
	}

	const result: MinimalMessageEvent[] = [];
	const restCount = response.reduce((acc, e) => acc - e.content.length, count);

	for (const e of response) {
		const { sender } = e;
		for (const segment of e.content) {
			// 递归添加深层转发消息
			if (isForwardSegment(segment) && restCount > 0) {
				result.push(...(await getForwardMessages(segment.data.id, restCount)));
			}
			// 添加当前消息
			else {
				result.push({
					sender,
					message: [segment],
				});
			}
		}
	}

	return result;
};

/**
 * 获取群文件资源链接
 * @see https://api.luckylillia.com/api-227239277
 */
export const getFileUrl = async (groupId: number, fileId: string) => {
	const response = await api.post("/get_group_file_url", {
		group_id: groupId,
		file_id: fileId,
	});

	const validation = safeParse(GetGroupFileUrlResponseSchema, response);
	if (!validation.success) {
		throw new Error(validation.issues[0].message);
	}

	return validation.output.data.url;
};

/**
 * 获取消息语音详情
 * @see https://api.luckylillia.com/api-151571424
 */
export const getRecord = async (file: string) => {
	const response = await api.post("/get_record", {
		file,
		out_format: "wav",
	});

	const validation = safeParse(GetRecordResponseSchema, response);
	if (!validation.success) {
		throw new Error(validation.issues[0].message);
	}

	return validation.output.data;
};

/**
 * 发送群聊文本消息
 * @see https://api.luckylillia.com/api-226300081
 */
export const sendGroupMessage = async (groupId: number, message: Segment[]) => {
	return api.post("/send_group_msg", {
		group_id: groupId,
		message,
	});
};
