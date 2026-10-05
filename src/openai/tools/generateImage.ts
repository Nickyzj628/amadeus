import { defineTool } from "@nickyzj2023/ai";
import { fetcher, logger, to } from "@nickyzj2023/utils";
import { array, number, object, optional, safeParse, string } from "valibot";
import config from "@/config.js";
import { sendGroupMessage } from "@/onebot/utils/http.js";
import { urlToImageSegment } from "@/onebot/utils/segment.js";

// 真正要用的只有图片地址，其余都是元信息和账单，缺了也不耽误取图，所以一律optional
const ResponseSchema = object({
	data: array(
		object({
			url: string(),
		}),
	),
	created: optional(number()),
	output_format: optional(string()),
	size: optional(string()),
	usage: optional(
		object({
			input_tokens: number(),
			input_tokens_details: object({
				image_tokens: number(),
				text_tokens: number(),
			}),
			output_tokens: number(),
			total_tokens: number(),
			images_count: number(),
		}),
	),
});

export default defineTool(
	"generate_image",
	"生成一张图片。何时调用：用户主动要求你生成一张图片，且提供了生图提示词（prompt）",
	{
		prompt: {
			type: "string",
			description: "生图提示词，如：DeepSeek的Q版二次元形象图",
			required: true,
		},
	},
	async ({ groupId, prompt }) => {
		const api = fetcher("https://apihub.agnes-ai.com/v1", {
			headers: {
				Authorization: `Bearer ${config.apiKeys.agnes}`,
			},
		});
		const [error, response] = await to(
			api.post("/images/generations", {
				model: "agnes-image-2.5-flash",
				prompt,
				size: "1024x1024",
				extra_body: {
					response_format: "url",
				},
			}),
		);
		if (error) {
			return `图片生成失败：${error.message}`;
		}

		const validation = safeParse(ResponseSchema, response);
		if (!validation.success) {
			return `图片生成失败：${validation.issues[0].message}`;
		}

		const { data, usage } = validation.output;
		const { url } = data[0] ?? {};
		if (!url) {
			return "图片生成失败：服务调用成功，但未返回任何图片地址";
		}
		usage && logger("生成了一张图片，消耗", usage);

		await sendGroupMessage(groupId, [urlToImageSegment(url)]);
		return `生成了一张图片：${url}\n已经发送给用户，你可以和TA继续对话，或者调用skip_reply就此打住`;
	},
);
