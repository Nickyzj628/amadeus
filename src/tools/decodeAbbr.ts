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
			description: "把用户输入的未知拼音缩写转换成可能的释义",
			parameters: {
				type: "object",
				properties: {
					abbr: {
						type: "string",
						description: "待转换的拼音缩写",
					},
				},
				required: ["abbr"],
			},
		},
	},
	async ({ abbr }) => {
		const [error, response] = await to(api.post("/guess", { text: abbr }));
		if (error) {
			return `缩写解密失败：${error.message}`;
		}

		const validation = safeParse(Schema, response);
		if (!validation.success) {
			return `缩写解密失败：${validation.issues[0].message}`;
		}
		const item = validation.output[0];
		if (!item) {
			return `缩写解密失败：响应体为空`;
		}

		const items = item.trans || [];
		if (items.length === 0) {
			return "未找到任何缩写释义";
		}
		return `用户想说的可能是：${items.join("、")}`;
	},
);
