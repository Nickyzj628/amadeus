import { changeModelTool } from "./changeModel.js";
import { decodeAbbrTool } from "./decodeAbbr.js";
import { getWeatherTool } from "./getWeather.js";
import { searchWebTool } from "./searchWeb.js";

export { changeModelTool } from "./changeModel.js";
export { decodeAbbrTool } from "./decodeAbbr.js";
export { getWeatherTool } from "./getWeather.js";
export { searchWebTool } from "./searchWeb.js";

/**
 * 所有可用工具的集合
 * 供 Vercel AI SDK 使用
 */
export const tools = {
	changeModel: changeModelTool,
	getWeather: getWeatherTool,
	decodeAbbr: decodeAbbrTool,
	searchWeb: searchWebTool,
};
