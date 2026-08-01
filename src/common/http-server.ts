/**
 * 极简 Hono 风格 HTTP 服务器封装
 *
 * 用原生 node:http 复刻了本项目用到的一小部分 Hono API，
 * 目的是在去掉 hono / @hono/node-server 依赖的同时，
 * 让路由处理代码保持接近 Hono 的写法：
 *
 *   const app = createApp();
 *   app.post("/", async (c) => {
 *     const body = await c.req.json();
 *     if (!body) return c.body(null, 204);
 *     return c.json({ ok: true });
 *   });
 *   serve(app, port);
 *
 * 设计取舍（有意为之，别指望这里是完整框架）：
 * - 只支持精确路径匹配，不支持 :param 动态段（本项目只有一个 POST / 路由）
 * - 只提供 get/post/put/delete 四个常用方法，需要更多可自行扩展
 * - 未注册路由返回 404 空响应；handler 抛异常返回 500，
 *   避免 async handler 抛错变成 unhandled rejection 直接崩掉进程
 */

import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";

/** 路由处理函数：入参是上下文 c，返回 HTTP 响应描述 */
export type Handler = (c: Context) => HttpResponse | Promise<HttpResponse>;

/** HTTP 响应描述：由 serve 负责写入真实响应（保持纯数据，方便测试） */
export interface HttpResponse {
	/** 状态码，如 200 / 204 */
	status: number;
	/** 响应头 */
	headers: Record<string, string>;
	/** 响应体；null 表示不写 body（用于 204 等无体响应） */
	body: string | null;
}

/** 内部路由表项 */
export interface Route {
	method: string;
	path: string;
	handler: Handler;
}

/** 注册路由的 App，用法贴近 Hono：app.post("/", handler) */
export interface App {
	get: (path: string, handler: Handler) => void;
	post: (path: string, handler: Handler) => void;
	put: (path: string, handler: Handler) => void;
	delete: (path: string, handler: Handler) => void;
	/** 已注册的路由表（serve 内部读取，正常情况下不需要动） */
	readonly routes: Route[];
}

/**
 * 请求上下文，用法贴近 Hono 的 Context
 *
 * 每个请求创建独立实例（闭包持有请求流，天然无共享状态）
 */
export interface Context {
	req: {
		/**
		 * 读取并解析 JSON 请求体
		 * 带 1MB 大小上限；body 不是合法 JSON 时该请求会得到 400 响应
		 */
		json: () => Promise<unknown>;
	};
	/**
	 * 构造响应：
	 * - body 为 null / undefined 时不写响应体（配合 204 使用）
	 * - body 为字符串时按 text/plain 发送
	 * - 对象请用 c.json()，这里不会自动序列化
	 */
	body: (body?: unknown, status?: number) => HttpResponse;
	/** 构造 JSON 响应（默认 200，content-type 与 Hono 保持一致） */
	json: (obj: unknown, status?: number) => HttpResponse;
}

/** 请求体大小上限：OneBot 消息体通常只有几 KB，1MB 足够宽松 */
const MAX_BODY_SIZE = 1024 * 1024;

/**
 * 带状态码的 HTTP 错误：由 serve 层捕获并转成对应状态码的响应
 * （如请求体解析失败 → 400、请求体过大 → 413）
 */
class HttpError extends Error {
	constructor(
		public readonly statusCode: number,
		message: string,
	) {
		super(message);
		this.name = "HttpError";
	}
}

/** 从请求流中读出原始 body（Buffer），超限时终止连接并报 413 */
const readRawBody = (req: IncomingMessage): Promise<Buffer> =>
	new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let size = 0;
		req.on("data", (chunk: Buffer) => {
			size += chunk.length;
			if (size > MAX_BODY_SIZE) {
				// 超限后不再积累数据，丢弃剩余请求体并报 413。
				// 注意不能 req.destroy()：那样客户端会收到连接重置而不是 413 状态码
				req.resume();
				reject(new HttpError(413, "请求体过大"));
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});

/** 每个请求创建一个独立的上下文 */
const createContext = (req: IncomingMessage): Context => {
	// 缓存解析结果：同一个请求里多次调用 c.req.json() 只读一次流
	let rawBodyPromise: Promise<Buffer> | null = null;
	let jsonPromise: Promise<unknown> | null = null;

	return {
		req: {
			json: () => {
				// 惰性读取：只有 handler 真正用到 body 时才消费请求流
				rawBodyPromise ??= readRawBody(req);
				jsonPromise ??= rawBodyPromise.then((buf) => {
					try {
						return JSON.parse(buf.toString("utf8"));
					} catch {
						// 解析失败统一转成 400（与 Hono 行为一致）
						throw new HttpError(400, "请求体不是合法 JSON");
					}
				});
				return jsonPromise;
			},
		},
		body: (body?: unknown, status = 200): HttpResponse => {
			if (body === undefined || body === null) {
				return { status, headers: {}, body: null };
			}
			return {
				status,
				headers: { "content-type": "text/plain; charset=UTF-8" },
				body: String(body),
			};
		},
		json: (obj, status = 200) => ({
			status,
			headers: { "content-type": "application/json; charset=UTF-8" },
			body: JSON.stringify(obj),
		}),
	};
};

/** 创建 App，用法贴近 Hono：app.post("/", handler) */
export const createApp = (): App => {
	const routes: Route[] = [];
	const on = (method: string, path: string, handler: Handler) => {
		routes.push({ method, path, handler });
	};
	return {
		get: (path, handler) => on("GET", path, handler),
		post: (path, handler) => on("POST", path, handler),
		put: (path, handler) => on("PUT", path, handler),
		delete: (path, handler) => on("DELETE", path, handler),
		routes,
	};
};

/** 把响应描述写入真实的 ServerResponse（写入失败只吞掉，绝不让它穿透成 unhandledRejection） */
const writeResponse = (res: ServerResponse, r: HttpResponse) => {
	// 客户端已断开（如超时/主动关闭）时不再写入，避免抛 ERR_STREAM_DESTROYED 等异常
	if (res.destroyed || res.writableEnded) {
		return;
	}
	try {
		res.writeHead(r.status, r.headers);
		res.end(r.body ?? undefined);
	} catch {
		// 连接被中途掐断等竞态：响应写不写都无所谓了，忽略即可
	}
};

/** 处理单个请求：路由匹配 → 执行 handler → 写响应，全程兜底异常 */
const handleRequest = async (
	app: App,
	req: IncomingMessage,
	res: ServerResponse,
) => {
	// 去掉 query string 再匹配路径（Hono 也是按 pathname 匹配）
	const { pathname } = new URL(req.url ?? "/", "http://localhost");
	const route = app.routes.find(
		(r) => r.method === req.method && r.path === pathname,
	);

	// 未注册路由：返回 404 空响应（与 Hono 默认行为一致）
	if (!route) {
		writeResponse(res, { status: 404, headers: {}, body: null });
		return;
	}

	try {
		const c = createContext(req);
		const response = await route.handler(c);
		if (!response) {
			// handler 忘了 return（TS 类型层一般会拦住，这里是运行时兜底）
			writeResponse(res, { status: 500, headers: {}, body: null });
			return;
		}
		writeResponse(res, response);
	} catch (error) {
		if (error instanceof HttpError) {
			// body 解析失败 / 请求体过大等已知错误 → 对应状态码
			writeResponse(res, {
				status: error.statusCode,
				headers: {},
				body: null,
			});
			return;
		}
		// 未知异常：返回 500，避免 async handler 抛错变成 unhandled rejection 崩掉进程
		writeResponse(res, { status: 500, headers: {}, body: null });
	}
};

/**
 * 启动 HTTP 服务器，用法贴近 \@hono/node-server 的 serve
 * @returns 原生 http.Server（有 .address() / .close(cb)，退出逻辑无需改动）
 */
export const serve = (app: App, port: number): Server => {
	const server = createServer((req, res) => {
		handleRequest(app, req, res).catch(() => {
			// 最后一道防线：连 handleRequest 都意外抛错时保证进程不崩
			writeResponse(res, { status: 500, headers: {}, body: null });
		});
	});
	server.listen(port);
	// 端口被占用等 listen 失败属于致命错误：打印后退出进程，
	// 与 @hono/node-server 的行为一致（它不监听 error，Node 会把事件升级为未捕获异常导致崩溃）。
	// 若此处只打印不退出，进程会存活但服务不可用，部署按进程存活判断健康会误判
	server.on("error", (error) => {
		console.error("[http-server]", error);
		process.exit(1);
	});
	return server;
};
