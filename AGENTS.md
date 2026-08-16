# amadeus

男生自用 QQ 群聊机器人：经 OneBot 11 协议端（LLBot/SnowLuma）接收群消息，调用 OpenAI 兼容大模型回复，支持工具调用、远程 MCP、mem0 记忆、B站直播推送。

## Project

- 技术栈：TypeScript(strict) + Node.js ESM(NodeNext)，pnpm 管理，tsx 运行，tsdown 打包，valibot 校验，sharp 压缩图片，`@nickyzj2023/utils` 提供 AI 请求/日志/fetcher
- 入口：`src/index.ts`（HTTP POST `/` 接收 OneBot 群消息事件，启动时做必填配置检查）
- 配置：`src/config.ts`（gitignored，需从 `src/config.example.ts` 复制后修改）
- 路径别名：`@/*` → `src/*`，但 import 必须带 `.js` 后缀（如 `@/common/db.js`）

## Commands

- `pnpm dev` — tsx watch 热重载运行 `src/index.ts`
- `pnpm build` — tsdown 打包到 `dist/`（ESM + minify，并复制 `src/openai/prompts/**/*.md`）
- `pnpm start` — `node dist/index.mjs` 运行生产版（需先 build；README 里的 build:prod/start:prod 是过时写法）
- `pnpm check` — biome 检查并 `--write` 自动修复；⚠️ 当前不可用：biome 未装进 devDependencies，运行必失败

## Architecture

- `src/common/` — 基础设施：`db.ts`（JSON 读写 `./data/`，路径以 process.cwd() 为根）、`util.ts`（normalizeText 清洗文本 / compressImage 压图 / checkUrlType）、`http-server.ts`（原生 node:http 的极简 Hono 风格封装，仅支持精确路径匹配）、`bililive.ts`（B站直播轮询推送）、`webdav.ts`
- `src/onebot/` — OneBot 协议端：`schemas/http-post.ts`（valibot 校验群消息事件 + 各消息段 Segment 类型）、`schemas/http.ts`（OneBot API 响应校验）、`utils/http.ts`（主动调用 OneBot API：发消息/取历史/取文件）、`utils/action.ts`（`replyLikeHuman` 模拟人类逐段回复）、`before-llm/`（无需模型的前置处理，如解析 B站链接直接回）
- `src/openai/` — 与模型交互：`prompts/*.md`（系统提示词，支持 `{xxx}` 从 config 取值替换）、`utils/generate-content.ts`（chatCompletions + 工具循环 + `visionToText` 多模态翻译）、`utils/messages.ts`（每群消息常驻内存，落盘 `data/{groupId}.json`，刷新系统提示词，释放不活跃群）、`utils/compact.ts`（上下文自动压缩：工具结果/媒体/总结三档阈值）、`utils/memory.ts`（mem0 记忆注入）、`utils/mcp.ts`（MCPRouter 管理远程 MCP 客户端）、`tools/`（Function Calling 工具：changeModel/getWeather/decodeAbbr/denyReply/saveMemory/forgetMemory）
- 请求链路：HTTP POST `/` → safeParse 校验 → `loadMessages` → `beforeLLM`（可短路直回）→ Web Locks 每群排队 → `onebotToOpenAI` 转格式 → `injectMemory` → `generateContent` → `replyLikeHuman` → `autoCompact` → `saveMessages`

## Conventions

- 外部输入一律 `safeParse`（valibot）校验；无法处理的消息在入口返回 204 静默丢弃，不抛错
- 每群串行队列用 `navigator.locks`，锁名格式 `group-${groupId}` 必须在 `index.ts`（请求锁）与 `messages.ts`（ifAvailable 探测空闲）两侧保持一致，改一处必须同步另一处
- 临时注入的 `<memory>` 消息每轮结束后必须 `removeInjectedMemory`，不随历史持久化
- type-only 导入用 `import type`（verbatimModuleSyntax）；import 一律带 `.js` 后缀
- 注释用中文，解释"为什么"而非"做了什么"；日志统一用 `logger`（@nickyzj2023/utils）
- 错误处理：async 函数抛异常由调用方 catch；不重要的错误可用 `to()` 包装吞掉
- `data/`、`dist/`、`config.ts` 均在 .gitignore，勿提交
- 新增模型须满足 OpenAI API Compatible；多模态任务用 `findModelByModality` 选模型
- 新工具在 `src/openai/tools/` 下建文件并用 `defineTool` 定义，在 `tools/index.ts` 注册；依赖 mem0 的工具在未配置 key 时不注册

## Notes

（留空待补充）
