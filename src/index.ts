import { timeLog } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { handleCommand } from "./handlers/command";
import { handlePlainText } from "./handlers/plain-text";
import { GroupMessageEventSchema } from "./schemas/onebot";
import { isAtSelfSegment, isCommand, isTextSegment, reply } from "./utils";

const server = Bun.serve({
	port: 8210,
	routes: {
		"/": {
			POST: async (req) => {
				const body = await req.json();
				const validation = safeParse(GroupMessageEventSchema, body);
				if (!validation.success) {
					return reply();
				}

				const e = validation.output;
				if (!isAtSelfSegment(e, 0)) {
					return reply();
				}

				const textSegment = isTextSegment(e, 1);
				if (!textSegment) {
					return reply();
				}

				const { fn, args } = isCommand(textSegment) || {};
				if (fn) {
					return handleCommand(fn, args);
				}
				return handlePlainText(textSegment.data.text, e);
			},
		},
	},
	fetch() {
		return reply();
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
