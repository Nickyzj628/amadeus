import { timeLog } from "@nickyzj2023/utils";
import { safeParse } from "valibot";
import { handleCommand } from "./handlers/command";
import { handlePlainText } from "./handlers/plain-text";
import { GroupMessageEventSchema } from "./schemas/onebot";
import { isAtSelfSegment, isCommand, isTextSegment } from "./utils";

const server = Bun.serve({
	port: 7280,
	routes: {
		"/": {
			POST: async (req) => {
				const body = await req.json();
				const validation = safeParse(GroupMessageEventSchema, body);
				if (!validation.success) {
					return new Response();
				}

				const e = validation.output;
				if (!isAtSelfSegment(e, 0)) {
					return new Response();
				}

				const textSegment = isTextSegment(e, 1);
				if (!textSegment) {
					return new Response();
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
		return new Response("404 Not Found", { status: 404 });
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
