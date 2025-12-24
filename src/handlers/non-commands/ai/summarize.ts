/** 总结群聊消息 */
const summarize = async (
	groupId: number,
	options?: {
		/** 消息数量 */
		count?: number;
	},
) => {
	return "施工中……";
	// if (pendingGroupIds.includes(groupId)) {
	// 	throw new Error("正在处理上一条消息，请稍候……");
	// }
	// pendingGroupIds.push(groupId);

	// const messages = readGroupFullMessages(groupId);
	// if (messages.length === 0) {
	// 	throw new Error("没有可以总结的消息");
	// }

	// const [error, content] = await to(
	// 	chatCompletions([
	// 		{ role: "system", content: SUMMARIZE_SYSTEM_PROMPT },
	// 		...messages.slice(-100),
	// 	]),
	// );
	// pendingGroupIds = pendingGroupIds.filter((id) => id !== groupId);

	// if (error) {
	// 	return reply(`总结失败：${error.message}`);
	// }

	// return reply(content);
};

export default summarize;
