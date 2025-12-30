import { timeLog } from "@nickyzj2023/utils";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources";
import type { GroupMessageEvent } from "@/schemas/onebot";
import changeModel from "./changeModel";
import decodeAbbr from "./decodeAbbr";
import getWeather from "./getWeather";
import searchWeb from "./searchWeb";
import summarizeChat from "./summarizeChat";

export const tools = [changeModel, getWeather, summarizeChat, decodeAbbr].map(
	(item) => item.tool,
);

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
	switch (tool.function.name) {
		case "changeModel": {
			return changeModel.handle(args);
		}
		case "getWeather": {
			return getWeather.handle(args);
		}
		case "summarizeChat": {
			return summarizeChat.handle(args, { groupId: e.group_id });
		}
		case "decodeAbbr": {
			return decodeAbbr.handle(args);
		}
		case "searchWeb": {
			return searchWeb.handle(args);
		}
		default: {
			throw new Error(`调用了不存在的函数（ ${tool.function.name}）`);
		}
	}
};
