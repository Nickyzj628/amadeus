# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **注意：本项目的所有代码、注释、提交信息、文档等均使用简体中文。**

## 项目简介

Amadeus 是一个基于 [LLBot](https://luckylillia.com/) 的 QQ 群聊机器人，使用 TypeScript + Hono 构建。机器人通过 OneBot 11 HTTP/HTTP POST 协议与 LLBot 通信，调用兼容 OpenAI API 格式的大模型进行对话，支持工具调用（Function Calling / MCP）、图片/视频理解、B站直播推送等功能。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 开发模式，tsx watch 热重载 |
| `pnpm build` | 打包到 `dist-test/`（含未压缩的调试构建） |
| `pnpm build:prod` | 打包到 `dist/`（生产构建，minify） |
| `pnpm start` | 运行 `dist-test/` 构建 |
| `pnpm start:prod` | 运行 `dist/` 构建 |
| `pnpm check` | Biome 检查并自动修复代码格式和 lint 问题 |

首次开发前，将 `src/config.example.ts` 复制为 `src/config.ts` 并填入实际配置。

## 项目架构

### 核心数据流

请求处理的生命周期在 `src/index.ts:37-123` 中，按以下顺序执行：

1. **接收消息** — OneBot HTTP POST 推送群消息到 Hono 服务器的 `/` 路由
2. **预处理** (`beforeLLM`) — 在 `src/onebot/before-llm/` 中，处理无需模型即可回复的场景（如解析B站链接），若返回非空数组则直接回复
3. **格式转换** (`onebotToOpenaiMessages`) — 将 OneBot 消息段转为 OpenAI API 兼容的 messages 数组。图片/视频会压缩后上传 WebDAV 得到 URL；若当前模型不支持多模态，则调用多模态模型将图片翻译成自然语言
4. **模型调用** (`generateContent`) — 调用大模型生成回复，支持工具调用。若用户消息包含安全词，则自动插入人设锚点提示词
5. **后处理** (`afterLLM`) — 保存群聊消息到本地、优化上下文（缩减图片、总结历史消息）
6. **回复消息** (`replyLikeHuman`) — 模拟人类打字节奏分段回复

### 目录结构

```
src/
├── index.ts                    # 入口：Hono 服务器、路由、生命周期编排
├── config.ts / config.example.ts  # 配置文件：机器人QQ、模型配置、MCP、B站订阅等
├── constants.ts                # 加载 prompts/*.md 为字符串常量
├── common/                     # 通用工具
│   ├── bililive.ts             # B站直播推送定时器
│   └── util.ts                 # JSON 读写、WebDAV 上传等
├── onebot/                     # OneBot 协议层
│   ├── schemas/                # OneBot 消息格式定义（http-post.ts 为核心）
│   ├── utils/                  # 发送消息、获取消息详情、消息段操作
│   └── before-llm/             # 调用模型前的预处理逻辑
└── openai/                     # 大模型交互层
    ├── schemas/                # OpenAI API 格式定义（message.ts, model.ts, tool.ts）
    ├── utils/                  # 核心逻辑
    │   ├── generate-content.ts # 调用大模型 + 图片翻译
    │   ├── group-messages.ts   # 群聊消息内存管理 + 本地持久化
    │   ├── message.ts          # OneBot ↔ OpenAI 消息格式转换
    │   ├── model.ts            # 当前模型引用管理
    │   ├── mcp.ts              # MCP 客户端管理
    │   ├── optimizations.ts    # 消息总结、图片缩减
    │   └── function-tool.ts    # 工具定义辅助函数
    ├── tools/                  # Function Calling 工具实现
    │   ├── changeModel.ts      # 切换当前使用的模型
    │   ├── decodeAbbr.ts       # 解码缩写
    │   ├── getWeather.ts       # 查询天气
    │   └── index.ts            # 工具注册（含 MCP 工具合并）
    ├── prompts/                # 系统提示词（Markdown 格式）
    └── after-llm/              # 调用模型后的处理（保存、优化）
```

### 关键技术约定

- **模块化格式**：ESM（`"type": "module"`），NodeNext 模块解析
- **路径别名**：`@/*` 映射到 `./src/*`
- **类型导入**：`verbatimModuleSyntax: true`，类型必须使用 `import type`
- **严格模式**：`noUncheckedIndexedAccess: true`，数组/对象索引访问可能返回 `undefined`
- **代码风格**：Biome 管理，tab 缩进，双引号。`noExplicitAny` 和 `noNonNullAssertion` 已关闭
- **代理**：`index.ts` 中硬编码了 `http://127.0.0.1:7890` 代理，通过 undici 的 `setGlobalDispatcher` 全局启用
- **构建产物**：`tsdown.config.ts` 配置，单入口 `src/index.ts`，ESM 格式，Node 平台，minify，shims
- **提示词管理**：`src/openai/prompts/*.md` 中的 Markdown 文件在 `constants.ts` 中被读取，其中 `{xxx}` 会被替换为 `config` 中对应路径的值。构建时通过 `copyfiles` 复制到 dist 目录

### 群聊消息持久化

`src/openai/utils/group-messages.ts` 使用 `Map<number, Message[]>` 在内存中缓存每个群的消息数组，超过 `maxActiveGroupCount`（默认 2）时释放最早不活跃的群聊内存到 `data/*.json`。

### 工具系统

`src/openai/tools/index.ts` 同时管理两类工具：
- **本地 Function Calling 工具**：`functionTools` 数组中的自定义工具
- **MCP 远程工具**：通过 `MCPRouter` 连接配置在 `config.mcpServers` 中的 Streamable HTTP MCP 服务端

两者合并为 `openaiTools` 和 `toolHandlers`，传入 `@nickyzj2023/utils` 的 `chatCompletions` 函数。

### 模型切换与多模态

- `src/openai/utils/model.ts` 中的 `modelRef` 管理当前使用的模型
- `config.models` 可配置多个模型，至少需要一个支持图片理解的模型用于图片翻译
- 当前模型不支持图片/视频时，会自动fallback到多模态模型翻译

### B站直播推送

`src/common/bililive.ts` 中的 `startBiliLiveTimer` 会定时轮询配置在 `config.brec.uids` 中的 UP 主直播状态，开播时推送到 `config.brec.groupIds` 中的 QQ 群。需要在 `index.ts:136` 处启动定时器。
