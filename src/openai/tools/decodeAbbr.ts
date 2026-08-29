import { defineTool } from "@nickyzj2023/ai";
import { fetcher, to } from "@nickyzj2023/utils";
import { array, object, optional, safeParse, string } from "valibot";

const DecodeResponseSchema = array(
	object({
		name: string(),
		trans: optional(array(string())),
	}),
);

export default defineTool(
	"decodeAbbr",
	"把用户输入的未知拼音缩写转换成可能的释义",
	{
		abbr: {
			type: "string",
			description: "待转换的拼音缩写",
			required: true,
		},
	},
	async ({ abbr }) => {
		const api = fetcher("https://lab.magiconch.com/api/nbnhhsh");
		const [error, response] = await to(api.post("/guess", { text: abbr }));
		if (error) {
			return `缩写解密失败：${error.message}`;
		}

		const validation = safeParse(DecodeResponseSchema, response);
		if (!validation.success) {
			return `缩写解密失败：${validation.issues[0].message}`;
		}

		const item = validation.output[0];
		const items = item?.trans;
		if (!items || items.length === 0) {
			return "未找到任何缩写释义";
		}

		return `用户想说的可能是：${items.join("、")}`;
	},
);
