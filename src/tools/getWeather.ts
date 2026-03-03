import { fetcher, to } from "@nickyzj2023/utils";
import { jsonSchema } from "ai";
import { array, object, safeParse, string } from "valibot";

const ResponseSchema = object({
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

const api = fetcher("https://api.seniverse.com/v3", {
	params: {
		key: process.env.SENIVERSE_PRIVATE_KEY,
	},
});

const getRelativeDate = (date: string) => {
	const dates = ["今天", "明天", "后天"];
	return dates[new Date(date).getDate() - new Date().getDate()] ?? date;
};

export const getWeatherTool: any = {
	description: "获取指定城市三日内的天气情况",
	inputSchema: jsonSchema({
		type: "object",
		properties: {
			city: {
				type: "string",
				description: "城市名称，如上海、哈尔滨",
			},
		},
		required: ["city"],
	}),
	execute: async ({ city }: { city: string }) => {
		const key = process.env.SENIVERSE_PRIVATE_KEY;
		if (!key) {
			return "天气预报查询失败：未配置私钥";
		}

		const [error, response] = await to<unknown>(
			api.get("/weather/daily.json", {
				params: { location: city },
			}),
		);
		if (error) {
			return `天气查询失败：${(error as any).status}`;
		}

		const dataValidation = safeParse(ResponseSchema, response);
		if (!dataValidation.success) {
			return dataValidation.issues[0].message;
		}
		const result = dataValidation.output.results[0];
		if (!result) {
			return "没有查询到天气信息";
		}

		return [
			`${result.location.name}天气：`,
			...result.daily.map((day) => {
				const climate =
					day.text_day === day.text_night
						? day.text_day
						: `${day.text_day}转${day.text_night}`;
				return `${getRelativeDate(day.date)}：${climate}，${day.low}°C ~ ${day.high}°C`;
			}),
			`数据更新时间：${new Date(result.last_update).toLocaleString()}`,
		].join("\n");
	},
};
