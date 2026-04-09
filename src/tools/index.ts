import { omitBy } from "@/utils/common.js";
import changeModel from "./changeModel.js";
import decodeAbbr from "./decodeAbbr.js";
import getWeather from "./getWeather.js";

/** 可直接传入 OpenAI API /chat-completions 的 tools 请求体 */
export const tools = [changeModel, getWeather, decodeAbbr].map((tool) => ({
  type: "function",
  function: omitBy(tool, (value, key) => key.startsWith("_")),
}));
