import { timeLog } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { handleCommand } from "./handlers/command";
import { handlePlainText } from "./handlers/plain-text";
import { GroupMessageEventSchema } from "./schemas/onebot";
import { isAtSelfSegment, isCommandText, isTextSegment } from "./utils";

const server = Bun.serve({
	port: 8210,
	routes: {
		"/": {
			POST: async (req) => {
				// 验证请求体格式
				const body = await req.json();
				const validation = safeParse(GroupMessageEventSchema, body);
				if (!validation.success) {
					return new Response(null, { status: 204 });
				}
				const e = validation.output;
				if (!isAtSelfSegment(e, 0)) {
					return new Response(null, { status: 204 });
				}
				const textSegment = isTextSegment(e, 1);
				if (textSegment === false) {
					return new Response(null, { status: 204 });
				}

				// 分流处理指令、纯文本
				const { fn, args } = isCommandText(textSegment) || {};
				if (fn !== undefined) {
					return handleCommand(fn, args);
				}
				return handlePlainText(textSegment.data.text, e);
			},
		},
	},
	fetch() {
		return new Response(null, { status: 204 });
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
