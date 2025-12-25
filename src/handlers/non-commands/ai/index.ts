import type { GroupMessageEvent } from "@/schemas/onebot/http-post";
import type { Model } from "@/schemas/openai";
import { reply } from "@/utils/onebot";
import chat from "./chat";
import summarize from "./summarize";

/** 当前模型，默认取 models 第一个 */
let activeModel = models[0];

/** 切换模型，如果不存在则返回 null */
const changeModel = (nameOrAlias = "") => {
	const target = nameOrAlias.toLowerCase();
	const model = models.find(
		(model) =>
			model.name.toLowerCase() === target ||
			model.aliases.includes(target) ||
			model.model === target,
	);
	if (!model) {
		return null;
	}

	activeModel = model;
	return activeModel;
};

/** 正在生成消息的群号 */
let pendingGroupIds: number[] = [];

/** 根据指定场景（chat、summarize、...）生成回复内容 */
const handle = async (scene: "chat" | "summarize", e: GroupMessageEvent) => {
	const groupId = e.group_id;
	if (pendingGroupIds.includes(groupId)) {
		return reply("正在处理上一条消息，请稍候……");
	}
	pendingGroupIds.push(groupId);

	let text = "";
	if (scene === "chat") {
		text = await chat(e);
	}
	if (scene === "summarize") {
		text = await summarize(groupId);
	}
	pendingGroupIds = pendingGroupIds.filter((id) => id !== groupId);
	return reply(text);
};

export default {
	models,
	specialModels,
	activeModel,
	changeModel,
	handle,
};
