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

				const { fn, args } = isCommand(textSegment) || {};
				if (fn !== undefined) {
					return handleCommand(fn, args);
				}
				return handlePlainText(textSegment.data.text, e);
			},
		},
	},
	fetch() {
		return new Response();
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
