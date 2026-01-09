import { fetcher, to } from "@nickyzj2023/utils";
import { array, type InferOutput, object, safeParse, string } from "valibot";
import { defineTool } from "./utils";

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

type Response = InferOutput<typeof Schema>;
type Error = {
	status: string;
	status_code: string;
};

const api = fetcher("https://api.seniverse.com/v3", {
	params: {
		key: Bun.env.SENIVERSE_PRIVATE_KEY,
	},
});

const getRelativeDate = (date: string) => {
	const dates = ["今天", "明天", "后天"];
	return dates[new Date(date).getDate() - new Date().getDate()] ?? date;
};

export default defineTool(
	{
		type: "function",
		function: {
			name: "getWeather",
			description: "获取指定城市三日内的天气情况",
			parameters: {
				type: "object",
				properties: {
					city: {
						type: "string",
						description: "城市名称，如上海、哈尔滨",
					},
				},
				required: ["city"],
			},
		},
	},
	async ({ city }) => {
		// 检查 api key
		const key = Bun.env.SENIVERSE_PRIVATE_KEY;
		if (!key) {
			return "天气预报查询失败：未配置私钥";
		}

		// 发送请求
		const [error, response] = await to<Response, Error>(
			api.get(`/weather/daily.json`, {
				params: {
					location: city,
				},
			}),
		);
		if (error) {
			return `天气查询失败：${error.status}`;
		}

		// 验证数据
		const dataValidation = safeParse(Schema, response);
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
);
