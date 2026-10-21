import { defineTool } from "@nickyzj2023/ai";
import { fetcher, to } from "@nickyzj2023/utils";
import { object, safeParse, string } from "valibot";
import config from "@/config.js";

const ResponseSchema = object({
	/** 页面标题，缺失时为空字符串 */
	title: string(),
	/** 抓取后的Markdown正文 */
	content: string(),
});

export default defineTool(
	"web_fetch",
	"抓取网页，返回页面标题与Markdown格式的内容",
	{
		url: {
			type: "string",
			description:
				"要抓取的网页地址，长度不超过8192；必须为含host的HTTP/HTTPS URL",
			required: true,
		},
	},
	async ({ url }) => {
		const { deepseek: token } = config.apiKeys;
		if (!token) {
			return "抓取失败：请先配置config.apiKeys.deepseek，才能获得DeepSeek联网搜索工具的使用能力";
		}

		const api = fetcher("https://api.deepseek.com/v1", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});
		const [error, response] = await to(api.post("/tools/fetch", { url }));
		if (error) {
			return `抓取失败：${error.message}`;
		}

		const validation = safeParse(ResponseSchema, response);
		if (!validation.success) {
			return `抓取成功，但数据结构校验失败：${validation.issues[0].message}`;
		}

		return validation.output;
	},
);
