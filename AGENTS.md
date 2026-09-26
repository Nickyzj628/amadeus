# amadeus

男生自用 QQ 群聊机器人：经 OneBot 11 协议端（LLBot/SnowLuma）接收群消息，调用 OpenAI 兼容大模型回复，支持工具调用、远程 MCP、本地长期记忆、B站直播推送。

## Project

- 技术栈：TypeScript(strict) + Node.js ESM(NodeNext)，pnpm 管理，tsx 运行，tsdown 打包，valibot 校验，sharp 压缩图片
- `@nickyzj2023/ai`（`runAgent`/`compact`/`defineTool`/MCP 客户端）和 `@nickyzj2023/utils`（logger/fetcher/XML 工具）由 `pnpm-workspace.yaml` 里 `link:../ai`、`link:../utils` 链到仓库外的源码目录，要改这两个包得去同级目录改
- 入口：`src/index.ts`（HTTP POST `/` 接收 OneBot 群消息事件，启动时做必填配置检查）
- 配置：`src/config.ts`（gitignored，需从 `src/config.example.ts` 复制后修改）
- 路径别名：`@/*` → `src/*`，但 import 必须带 `.js` 后缀（如 `@/common/db.js`）
- `data/*.json` 和 `src/openai/prompts/*.md` 都按 `process.cwd()` 定位，必须在仓库根启动

## Commands

- `pnpm dev` — tsx watch 热重载运行 `src/index.ts`
- `pnpm build` — tsdown 打包到 `dist/`（ESM + minify，另把 `src/openai/prompts/**/*.md` 复制进 `dist/`）
- `pnpm start` — `node dist/index.mjs` 运行生产版（需先 build）
- `pnpm check` — biome check --write 自动修复 `src/**/*.ts`；biome 2.5.13 已装可用，但 biome.json 要求 CRLF 行尾（本地文件是 LF），跑一次会把 src 下几乎每个文件都重写

## Architecture

- `src/common/` — 基础设施：`db.ts`（`saveJSON`/`loadJSON` 读写 `<cwd>/data/*.json`，读不到返回 null）、`util.ts`（normalizeText 清洗文本 / compressImage 压图 / checkUrlType 判断地址类型 / get 取值 / generateUUID）、`http-server.ts`（原生 node:http 的极简 Hono 风格封装，仅支持精确路径匹配）、`bililive.ts`（B站直播轮询推送）、`webdav.ts`（视频上传 WebDAV 再读回 base64）、`schemas/bili.ts`
- `src/onebot/` — OneBot 协议端：`schemas/http-post.ts`（valibot 校验消息事件 + 各消息段 Segment 类型和 `isXxxSegment` 判断）、`schemas/http.ts`（OneBot API 响应校验）、`utils/http.ts`（主动调用 OneBot API：发消息/取历史/取消息详情/取转发/取语音）、`utils/action.ts`（`replyLikeHuman` 模拟人类逐段回复）、`utils/segment.ts`（构造消息段）、`before-llm/`（无需模型的前置处理，如解析 B站链接直接回）
- `src/openai/` — 与模型交互：
  - `prompts/*.md` 系统提示词，启动时由 `utils/constants.ts` 读取，其中 `{xxx}` 按 config 路径取值替换
  - `utils/generate-content.ts`（`runAgent` + 工具循环 + `visionToText` 多模态翻译；最新用户消息含 `config.etc.safeWord` 时插入人设锚点）
  - `utils/messages.ts`（每群消息常驻内存，落盘 `data/{groupId}.json`，刷新系统提示词，释放不活跃群）
  - `utils/memory.ts`（手写长期记忆，见下）
  - `utils/model.ts`（`modelRef.current` 全局当前模型 + `findModelByName`/`findModelByModality`）
  - `utils/convert.ts`（OneBot 消息段转 OpenAI messages：图片压缩 / 视频走 WebDAV / 音视频多模态翻译 / 引用和合并转发展开）
  - `after-try/`（每轮调用模型后的生命周期：收回注入记忆、清理过时 system-reminder、按天压缩、通用压缩）
  - `tools/`（Function Calling 工具：changeModel/getWeather/decodeAbbr/skipReply/loadMemory/saveMemory/deleteMemory，全在 `tools/index.ts` 注册；MCP 工具用 `@nickyzj2023/ai/mcp` 的 `loadMCPTools(config.mcpServers)` 动态加载）

### 记忆

无外部服务，直接读写本地 JSON：`data/{userId}.json` 存 `{memoryId: 内容}`，userId 是 QQ 号，memoryId 用 `generateUUID()` 生成。

- 注入：每轮请求前 `injectMemory` 把发送者的记忆拼成 `<memory>` 消息挂在上下文尾部
- 工具：模型可调 `saveMemory`（带 memoryId 即更新）/`deleteMemory`，`loadMemory` 供主动召回其他用户记忆
- 采集：消息被压缩丢弃前，`collectMemories` 先把它们当一轮对话读一遍，自主调用上述工具增删改

## Conventions

- 外部输入一律 `safeParse`（valibot）校验；无法处理的消息在入口返回 204 静默丢弃，不抛错
- `messages[0]` 必须始终是 system 提示词，`index.ts` 发现它没了会直接丢弃消息（有上下文操作吞掉提示词的前科），改动上下文逻辑时留意
- 每群串行队列用 `navigator.locks`，锁名格式 `group-${groupId}` 必须在 `index.ts`（请求锁）与 `messages.ts`（ifAvailable 探测空闲）两侧保持一致，改一处必须同步另一处
- 注入的 `<memory>` 是临时消息，由 `afterTry` 里的 `deleteInjectedMemory` 收回，不随历史持久化
- type-only 导入用 `import type`（verbatimModuleSyntax）；import 一律带 `.js` 后缀
- 注释用中文，解释"为什么"而非"做了什么"；日志统一用 `logger`（@nickyzj2023/utils）
- 错误处理：async 函数抛异常由调用方 catch；不重要的错误可用 `to()` 包装吞掉
- `data/`、`dist/`、`config.ts`、`pnpm-workspace.yaml`、`pnpm-lock.yaml` 均在 .gitignore，勿提交
- 新增模型须满足 OpenAI API Compatible；多模态任务用 `findModelByModality` 选模型
- 新工具在 `src/openai/tools/` 下建文件并用 `defineTool` 定义，在 `tools/index.ts` 注册

## Notes

（留空待补充）
