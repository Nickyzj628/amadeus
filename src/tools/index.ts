import { compactStr, isObject, log } from "@nickyzj2023/utils";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources";
import type { GroupMessageEvent } from "@/schemas/onebot.js";
import { normalizeText } from "@/utils/onebot.js";
import changeModel from "./changeModel.js";
import decodeAbbr from "./decodeAbbr.js";
import getWeather from "./getWeather.js";
import searchWeb from "./searchWeb.js";
import { validateArgs } from "./utils.js";

export const tools = [changeModel, getWeather, decodeAbbr, searchWeb].map(
	(item) => item.tool,
);

/**
 * 根据传入的 function tool call，返回工具调用结果
 * @remarks 如果找不到对应工具，会抛出异常
 */
export const handleTool = async (
	tool: ChatCompletionMessageFunctionToolCall,
	e: GroupMessageEvent,
) => {
	const args = JSON.parse(tool.function.arguments);
	if (!isObject(args)) {
		throw new Error("参数必须是对象");
	}

	let content = "";
	switch (tool.function.name) {
		case "changeModel": {
			validateArgs(args, changeModel);
			content = await changeModel.handle(args);
			break;
		}
		case "getWeather": {
			validateArgs(args, getWeather);
			content = await getWeather.handle(args);
			break;
		}
		case "decodeAbbr": {
			validateArgs(args, decodeAbbr);
			content = await decodeAbbr.handle(args);
			break;
		}
		case "searchWeb": {
			validateArgs(args, searchWeb);
			content = await searchWeb.handle(args);
			break;
		}
		default: {
			throw new Error(`调用了不存在的函数（ ${tool.function.name}）`);
		}
	}

	log(
		`${tool.function.name}(${compactStr(
			tool.function.arguments,
		)})\n${compactStr(content)}`,
	);
	return normalizeText(content);
};
