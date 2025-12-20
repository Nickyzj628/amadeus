import { timeLog } from "@nickyzj2023/utils";
import type { GroupMessageEvent } from "../../schemas/onebot/http-post";
import { reply, textToSegment } from "../../utils/onebot";
import changeModel from "./change-model";
import seniverse from "./seniverse";
import summarize from "./summarize";

type Command = {
	/** 功能描述 */
	description: string;
	/** 指令格式示例 */
	example: string;
	/** 运行函数 */
	handle: (
		args: string[],
		e: GroupMessageEvent,
	) => Response | Promise<Response>;
};

export function defineCommand(command: Command) {
	return command;
}

const commandMap: Record<string, Command> = {
	天气: seniverse,
	模型: changeModel,
	总结一下: summarize,
};

export const handleCommand = (
	fn: string,
	args: string[],
	e: GroupMessageEvent,
) => {
	const command = commandMap[fn];
	if (!command) {
		return reply(
			textToSegment("可用的指令有："),
			...Object.values(commandMap).map((command, index) =>
				textToSegment(
					`\n${index + 1}. ${command.example} - ${command.description}；`,
				),
			),
		);
	}

	timeLog("执行指令", fn, args);
	return command.handle(args, e);
};
