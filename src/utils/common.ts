export const normalizeText = (text: string) => {
	return (
		text
			// 移除可能残留的思考标签及其内容
			.replace(/<think>[\s\S]*?<\/think>/gi, "")
			// 移除孤立的闭合思考标签
			.replace(/<\/think>/gi, "")
			// 移除元数据标签
			.replace(/\[FROM:.*?\]|\[BODY:.*?\]|\[IMAGE_PARSED:.*?\]/gi, "")
			.trim()
	);
};
