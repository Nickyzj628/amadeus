// --- 能不能好好说话 ---

import { fetcher, to } from "@nickyzj2023/utils";
import { array, object, optional, safeParse, string } from "valibot";
import { reply } from "../../utils/onebot";

const IGNORED_TEXTS = ["myspoon", "myfork"];

const Schema = array(
	object({
		name: string(),
		trans: optional(array(string())),
	}),
);

const api = fetcher("https://lab.magiconch.com/api/nbnhhsh");

const handle = async (text: string) => {
	const [error, response] = await to(api.post("/guess", { text }));
	if (error) {
		return reply(`调用nbnhhsh出错：${error.message}`);
	}

	const validation = safeParse(Schema, response);
	if (!validation.success) {
		return reply(`nbnhhsh返回数据格式有误：${validation.issues[0].message}`);
	}
	const item = validation.output[0];
	if (!item) {
		return reply(`nbnhhsh未找到结果`);
	}

	const items = item.trans || [];
	if (items.length === 0) {
		return reply("未查询到结果，这在我的数据库里没有啊！");
	}
	return reply(`你想说的是不是：${items.join("、")}`);
};

export default { IGNORED_TEXTS, handle };
