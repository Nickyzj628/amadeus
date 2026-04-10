import { omitBy } from "@/utils/common.js";
import changeModel from "./changeModel.js";
import decodeAbbr from "./decodeAbbr.js";
import getWeather from "./getWeather.js";

/** 可直接传入 OpenAI API /chat-completions 的 tools 请求体 */
export const tools = [changeModel, getWeather, decodeAbbr].map((tool) => ({
  type: "function",
  function: omitBy(tool, (value, key) => key.startsWith("_")),
}));

export const executeTool = async (name: string, args: Record<string, any>) => {
  const tool = tools.find((tool) => tool.function.name === name);
  if (!tool) {
    return;
  }

  return await tool.function._execute?.(args);
};
