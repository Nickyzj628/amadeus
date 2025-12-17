import { fetcher, timeLog, to } from "@nickyzj2023/utils";
import { array, object, safeParse, string } from "valibot";
import type { GroupMessageEvent } from "../schemas/onebot";
import type { Model } from "../schemas/openai";
import { makeTextSegment, reply } from "../utils";
import { Ai } from "./plain-text";

type Command = {
	/** 功能描述 */
	description: string;
	/** 指令格式示例 */
	example: string;
	/** 运行函数 */
	handle: (
		e: GroupMessageEvent,
		...args: string[]
	) => Response | Promise<Response>;
};

/** 心知天气 */
const seniverse = {
	description: "查询城市天气",
	example: "/天气 <城市名>",
	async handle(e: GroupMessageEvent, city = "上海") {
		// 检查 api key
		const key = Bun.env.SENIVERSE_PRIVATE_KEY;
		if (!key) {
			return reply("天气预报查询失败：未配置私钥");
		}

		// 发送请求
		const [error, response] = await to(
			fetcher().get(
				`https://api.seniverse.com/v3/weather/daily.json?key=${key}&location=${city}`,
			),
		);
		if (error) {
			return reply(`天气预报查询失败：${error.message}`);
		}

		// 验证数据
		const dataValidation = safeParse(this.Schema, response);
		if (!dataValidation.success) {
			return reply(`天气预报数据结构有误：${dataValidation.issues[0].message}`);
		}
		const result = dataValidation.output.results[0];
		if (!result) {
			return reply("没有查询到天气信息");
		}

		return reply(
			makeTextSegment(`${result.location.name}天气：`),
			...result.daily.map((day) =>
				makeTextSegment(
					`\n${this.getRelativeDate(day.date)}：${day.text_day}转${day.text_night}，${day.low}°C ~ ${day.high}°C`,
				),
			),
			makeTextSegment(
				`\n数据更新时间：${new Date(result.last_update).toLocaleString()}`,
			),
		);
	},

	Schema: object({
		results: array(
			object({
				location: object({
					id: string(),
					name: string(),
					country: string(),
					path: string(),
					timezone: string(),
					timezone_offset: string(),
				}),
				daily: array(
					object({
						date: string(),
						text_day: string(),
						code_day: string(),
						text_night: string(),
						code_night: string(),
						high: string(),
						low: string(),
						rainfall: string(),
						precip: string(),
						wind_direction: string(),
						wind_direction_degree: string(),
						wind_speed: string(),
						wind_scale: string(),
						humidity: string(),
					}),
				),
				last_update: string(),
			}),
		),
	}),

	getRelativeDate(date: string) {
		const dates = ["今天", "明天", "后天"];
		return dates[new Date(date).getDate() - new Date().getDate()] ?? date;
	},
};

/** 切换 AI 模型 */
const changeModel = {
	description: "切换 AI 聊天模型",
	example: "/模型 <模型名称>",
	handle: async (e: GroupMessageEvent, name: string) => {
		const nextModel = Ai.changeModel(name);
		if (!nextModel) {
			return reply(
				makeTextSegment("可用的模型有："),
				...Ai.models.map((model, index) =>
					makeTextSegment(
						`\n${index + 1}. ${model.name}（${model.aliases.join("、")}）`,
					),
				),
				makeTextSegment(`\n当前模型：${Ai.model?.name}`),
			);
		}

		return reply(`已切换到${nextModel.name}`);
	},
};

/** 总结一下（调用本地 Ollama Qwen3:0.6b 小模型） */
const summarize = {
	description: "归纳总结最近的群聊内容",
	example: "/总结一下",
	handle: async (e: GroupMessageEvent) => {
		return await Ai.summarize(e.group_id);
	},
};

// --- 分流处理指令 ---

const commandMap: Record<string, Command> = {
	天气: seniverse,
	模型: changeModel,
	总结一下: summarize,
};

export const handleCommand = (
	e: GroupMessageEvent,
	fn: string,
	args?: string[],
) => {
	const command = commandMap[fn];
	if (!command) {
		return reply(
			makeTextSegment("可用的指令有："),
			...Object.values(commandMap).map((command, index) =>
				makeTextSegment(
					`\n${index + 1}. ${command.example} - ${command.description}；`,
				),
			),
		);
	}

	timeLog("执行指令", fn, args);
	return command.handle(e, ...(args ?? []));
};
