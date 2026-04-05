import config from "@/config.js";
import { fetcher, to } from "@nickyzj2023/utils";
import { array, object, safeParse, string } from "valibot";

const WeatherResponseSchema = object({
  results: array(
    object({
      location: object({
        name: string(),
      }),
      daily: array(
        object({
          date: string(),
          text_day: string(),
          text_night: string(),
          high: string(),
          low: string(),
        }),
      ),
      last_update: string(),
    }),
  ),
});

const getRelativeDate = (date: string): string => {
  const dates = ["今天", "明天", "后天"];
  const index = new Date(date).getDate() - new Date().getDate();
  return dates[index] ?? date;
};

export const getWeatherTool = {
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
  execute: async ({ city }: { city: string }) => {
    if (!config.apiKeys.seniversePrivateKey) {
      return "天气预报查询失败：未配置apiKeys.seniversePrivateKey";
    }

    const api = fetcher("https://api.seniverse.com/v3", {
      params: {
        key: config.apiKeys.seniversePrivateKey ?? "",
      },
    });

    const [error, response] = await to(
      api.get("/weather/daily.json", {
        params: { location: city },
      }),
    );

    if (error) {
      return `天气查询失败：${(error as any).status ?? error.message}`;
    }

    const validation = safeParse(WeatherResponseSchema, response);
    if (!validation.success) {
      return `天气查询失败：${validation.issues[0].message}`;
    }

    const result = validation.output.results[0];
    if (!result) {
      return "没有查询到天气信息";
    }

    const lines = result.daily.map((day) => {
      const climate =
        day.text_day === day.text_night
          ? day.text_day
          : `${day.text_day}转${day.text_night}`;
      return `${getRelativeDate(day.date)}：${climate}，${day.low}°C ~ ${day.high}°C`;
    });

    return [
      `${result.location.name}天气：`,
      ...lines,
      `数据更新时间：${new Date(result.last_update).toLocaleString()}`,
    ].join("\n");
  },
};
