import { compactStr, isObject, timeLog } from "@nickyzj2023/utils";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources";
import type { GroupMessageEvent } from "@/schemas/onebot";
import changeModel, { modelRef } from "./changeModel";
import decodeAbbr from "./decodeAbbr";
import getWeather from "./getWeather";
import searchWeb from "./searchWeb";
import summarizeChat from "./summarizeChat";
import { selectFunctionCallingModel, validateArgs } from "./utils";

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
export const handleTool = async (
	tool: ChatCompletionMessageFunctionToolCall,
	e: GroupMessageEvent,
) => {
	const args = JSON.parse(tool.function.arguments);
	if (!isObject(args)) {
		throw new Error("参数必须是对象");
	}

	modelRef.value = selectFunctionCallingModel();
	if (!modelRef.value) {
		throw new Error("必须先配置一个支持 Function Calling 的模型");
	}

	let result = "";
	switch (tool.function.name) {
		case "changeModel": {
			validateArgs(args, changeModel);
			result = await changeModel.handle(args);
			break;
		}
		case "getWeather": {
			validateArgs(args, getWeather);
			result = await getWeather.handle(args);
			break;
		}
		case "summarizeChat": {
			validateArgs(args, summarizeChat);
			result = await summarizeChat.handle({ ...args, groupId: e.group_id });
			break;
		}
		case "decodeAbbr": {
			validateArgs(args, decodeAbbr);
			result = await decodeAbbr.handle(args);
			break;
		}
		case "searchWeb": {
			validateArgs(args, searchWeb);
			result = await searchWeb.handle(args);
			break;
		}
		default: {
			throw new Error(`调用了不存在的函数（ ${tool.function.name}）`);
		}
	}

	timeLog(
		`${tool.function.name}(${compactStr(tool.function.arguments)})\n${compactStr(result)}`,
	);
	return result;
};
