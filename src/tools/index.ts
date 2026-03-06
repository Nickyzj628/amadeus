import { changeModelTool } from "./changeModel.js";
import { decodeAbbrTool } from "./decodeAbbr.js";
import { getWeatherTool } from "./getWeather.js";
import { searchWebTool } from "./searchWeb.js";

export const tools = {
	changeModel: changeModelTool,
	decodeAbbr: decodeAbbrTool,
	getWeather: getWeatherTool,
	searchWeb: searchWebTool,
};
