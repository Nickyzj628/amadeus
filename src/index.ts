import { timeLog } from "@nickyzj2023/utils";
import { rootRoute } from "./routes";
import { brecRoute } from "./routes/brec";
import { reply } from "./utils/onebot";

if (!Bun.env.SELF_ID) {
	throw new Error("请在.env文件中填写机器人QQ号（SELF_ID）");
}
if (!Bun.env.ONEBOT_HTTP_POST_PORT) {
	throw new Error(
		"请在.env文件中填写机器人接收消息的服务端口号（ONEBOT_HTTP_POST_PORT）",
	);
}

const server = Bun.serve({
	port: Bun.env.ONEBOT_HTTP_POST_PORT,
	routes: {
		"/": rootRoute,
		"/brec": brecRoute,
	},
	fetch() {
		return reply();
	},
});

timeLog(`${server.protocol}://${server.hostname}:${server.port}`);
