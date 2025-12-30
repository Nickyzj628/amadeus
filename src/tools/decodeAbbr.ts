import { fetcher, to } from "@nickyzj2023/utils";
import { array, object, optional, safeParse, string } from "valibot";
import { defineTool } from "./utils";

const Schema = array(
	object({
		name: string(),
		trans: optional(array(string())),
	}),
);

const api = fetcher("https://lab.magiconch.com/api/nbnhhsh");

export default defineTool(
	{
		type: "function",
		function: {
			name: "decodeAbbr",
			description:
				"语义解密工具。当你遇到无法通过逻辑推导理解的中文拼音缩写（如 smg, jtjdg, yyds）时，调用此工具进行解密。",
			parameters: {
				type: "object",
				properties: {
					abbr: {
						type: "string",
						description: "待解密的缩写或不明所以的网络词汇。",
					},
				},
				required: ["abbr"],
			},
		},
	},
	async ({ abbr }) => {
		const [error, response] = await to(api.post("/guess", { text: abbr }));
		if (error) {
			return `暗号解密失败：${error.message}`;
		}

		const validation = safeParse(Schema, response);
		if (!validation.success) {
			return `暗号解密失败：${validation.issues[0].message}`;
		}
		const item = validation.output[0];
		if (!item) {
			return `暗号解密失败：响应体为空`;
		}

		const items = item.trans || [];
		if (items.length === 0) {
			return "未查询到结果，这在我的数据库里没有啊！";
		}
		return `你想说的是不是：${items.join("、")}`;
	},
);
