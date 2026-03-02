import { serve } from "@hono/node-server";
import { log } from "@nickyzj2023/utils";
import { Hono } from "hono";
import { brecRoute } from "./routes/brec.js";
import { rootRoute } from "./routes/index.js";

if (!process.env.SELF_ID) {
	throw new Error("请在.env文件中填写机器人QQ号（SELF_ID）");
}
if (!process.env.ONEBOT_HTTP_POST_PORT) {
	throw new Error(
		"请在.env文件中填写机器人接收消息的服务端口号（ONEBOT_HTTP_POST_PORT）",
	);
}

const app = new Hono();

// 主要路由
app.post("/", rootRoute);

// 直播推送 Webhook
app.post("/brec", brecRoute);

// 默认返回 204 空响应
app.all("*", (c) => {
	return c.newResponse(null, 204);
});

const port = Number(process.env.ONEBOT_HTTP_POST_PORT);
const server = serve({
	fetch: app.fetch,
	port,
});

server.on("listening", () => {
	log(["服务器已启动", server.address()]);
});
