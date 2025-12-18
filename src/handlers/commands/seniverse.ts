// --- 心知天气 ---

import { fetcher, to } from "@nickyzj2023/utils";
import { array, object, safeParse, string } from "valibot";
import { makeTextSegment, reply } from "../../utils/onebot";
import { defineCommand } from ".";

const Schema = object({
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
});

const api = fetcher("https://api.seniverse.com/v3");

const getRelativeDate = (date: string) => {
	const dates = ["今天", "明天", "后天"];
	return dates[new Date(date).getDate() - new Date().getDate()] ?? date;
};

const command = defineCommand({
	description: "查询城市天气",
	example: "/天气 <城市名>",
	async handle([city = "上海"]) {
		// 检查 api key
		const key = Bun.env.SENIVERSE_PRIVATE_KEY;
		if (!key) {
			return reply("天气预报查询失败：未配置私钥");
		}

		// 发送请求
		const [error, response] = await to(
			api.get(`/weather/daily.json?key=${key}&location=${city}`),
		);
		if (error) {
			return reply(`天气预报查询失败：${error.message}`);
		}

		// 验证数据
		const dataValidation = safeParse(Schema, response);
		if (!dataValidation.success) {
			return reply(`天气预报数据结构有误：${dataValidation.issues[0].message}`);
		}
		const result = dataValidation.output.results[0];
		if (!result) {
			return reply("没有查询到天气信息");
		}

		return reply(
			makeTextSegment(`${result.location.name}天气：`),
			...result.daily.map((day) => {
				const climate =
					day.text_day === day.text_night
						? day.text_day
						: `${day.text_day}转${day.text_night}`;
				return makeTextSegment(
					`\n${getRelativeDate(day.date)}：${climate}，${day.low}°C ~ ${day.high}°C`,
				);
			}),
			makeTextSegment(
				`\n数据更新时间：${new Date(result.last_update).toLocaleString()}`,
			),
		);
	},
});

export default command;
