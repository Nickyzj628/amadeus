import { isObject, timeLog } from "@nickyzj2023/utils";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources";
import type { GroupMessageEvent } from "@/schemas/onebot";
import changeModel from "./changeModel";
import decodeAbbr from "./decodeAbbr";
import getWeather from "./getWeather";
import searchWeb from "./searchWeb";
import summarizeChat from "./summarizeChat";
import { validateArgs } from "./utils";

export const tools = [
	changeModel,
	getWeather,
	summarizeChat,
	decodeAbbr,
	searchWeb,
].map((item) => item.tool);

/**
 * 根据传入的 function tool call，返回工具调用结果
 * @remarks 如果找不到对应工具，会抛出异常
 */
export const chooseAndHandleTool = async (
	tool: ChatCompletionMessageFunctionToolCall,
	e: GroupMessageEvent,
) => {
	timeLog("调用工具", tool.function.name, tool.function.arguments);
	const args = JSON.parse(tool.function.arguments);
	if (!isObject(args)) {
		throw new Error("参数必须是对象");
	}

	switch (tool.function.name) {
		case "changeModel": {
			validateArgs(args, changeModel);
			return changeModel.handle(args);
		}
		case "getWeather": {
			validateArgs(args, getWeather);
			return getWeather.handle(args);
		}
		case "summarizeChat": {
			validateArgs(args, summarizeChat);
			return summarizeChat.handle({ ...args, groupId: e.group_id });
		}
		case "decodeAbbr": {
			validateArgs(args, decodeAbbr);
			return decodeAbbr.handle(args);
		}
		case "searchWeb": {
			validateArgs(args, searchWeb);
			return searchWeb.handle(args);
		}
		default: {
			throw new Error(`调用了不存在的函数（ ${tool.function.name}）`);
		}
	}
};
