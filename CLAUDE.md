# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**重要提醒：AI 禁止将代码打包到 dist-prod 目录。**

## 项目概述

Amadeus 是一个基于 OneBot 11 协议的 QQ 群聊机器人，使用 Hono + Node.js + TypeScript 开发。以大语言模型（LLM）作为核心对话引擎，支持多模态理解、工具调用、上下文记忆等功能。项目人格设定基于《命运石之门》中的牧濑红莉栖。

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 开发模式（tsx watch 热重载）
pnpm build            # 构建（输出到 dist/）
pnpm build:prod       # 生产构建（输出到 dist-prod/）
pnpm start            # 运行 dist/index.js
pnpm start:prod       # 运行 dist-prod/index.js
pnpm lint             # 代码检查（oxlint）
pnpm format           # 代码格式化（oxfmt）
```

## 技术栈

- **运行时**: Node.js v20+
- **语言**: TypeScript 5.9+
- **包管理**: pnpm
- **HTTP 服务**: Hono + @hono/node-server
- **AI SDK**: Vercel AI SDK + @ai-sdk/openai
- **Schema 验证**: Valibot v1.2
- **MCP 协议**: @modelcontextprotocol/sdk
- **代码质量**: oxlint + oxfmt（由 oxc 提供）

## 架构要点

### 消息处理流程

```
OneBot HTTP POST → src/index.ts → 消息验证 → 上下文管理 → LLM 生成 → 工具调用 → 回复
```

### 核心模块

| 模块   | 路径                  | 职责                                          |
| ------ | --------------------- | --------------------------------------------- |
| 入口   | `src/index.ts`        | HTTP 服务器、消息路由、群聊并发控制           |
| 配置   | `src/config.ts`       | 机器人 QQ、模型列表、MCP 服务器、直播推送配置 |
| 常量   | `src/constants.ts`    | 系统提示词、人设锚点、安全词、模型列表        |
| 工具   | `src/tools/index.ts`  | 本地工具注册（天气、缩写解密、模型切换）      |
| OpenAI | `src/utils/openai/`   | LLM 调用、MCP 客户端、消息存储/读取/总结/修剪 |
| OneBot | `src/utils/onebot.ts` | 消息段解析、回复构建、群消息发送              |
| B站    | `src/utils/bili.ts`   | 链接解析、直播间信息获取                      |

### 上下文管理

- 每个群聊独立维护消息历史（内存 Map + JSON 文件 `data/{groupId}.json`）
- `MAX_ACTIVE_GROUPS = 2`：超过此数量的活跃群聊时释放不活跃群聊的内存
- `SUMMARIZE_THRESHOLD = 50`：消息数量达到此阈值时自动总结部分历史消息
- `ANCHOR_THRESHOLD = 10`：消息超过此数量时添加临时人设锚点

### 工具系统

本地工具定义在 `src/tools/`，使用 Vercel AI SDK 的 `tool` 格式：

```typescript
export const tools = {
  changeModel: changeModelTool,
  decodeAbbr: decodeAbbrTool,
  getWeather: getWeatherTool,
};
```

MCP 工具通过 `src/utils/openai/mcp-client.ts` 动态获取并缓存。

### MCP 客户端管理

- 支持 `streamable_http` 和 `Stdio` 两种传输类型
- 连接复用：同类型服务器只建立一次连接
- 首次调用 `getAllMcpTools()` 时初始化所有 MCP 工具
- 程序退出时自动关闭所有连接

## 配置

从 `src/config.example.ts` 复制为 `src/config.ts` 后填写实际配置：

```typescript
export default {
  bot: {
    selfId: "机器人QQ号",
    onebotHttpPort: 7280, // 主动请求端口
    onebotHttpPostPort: 8210, // 接收消息端口
  },
  models: [
    {
      provider: "OpenRouter",
      model: "xiaomi/mimo-v2-omni",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk-or-v1-xxx",
      totalContext: 256000,
    },
  ],
  mcpServers: {
    "tavily-remote-mcp": {
      type: "streamable_http",
      url: "https://mcp.tavily.com/mcp/?tavilyApiKey=xxx",
    },
  },
  brec: {
    roomIds: [544786, 92613],
    groupIds: [1016022926],
  },
};
```

## 路径别名

- `@/` 映射到 `./src/`
- 导入示例：`import { xxx } from "@/utils/onebot.js"`

## 构建配置

- 入口：`src/index.ts`
- 输出格式：ESM
- 平台：Node.js
- 产物目录：`dist/`（开发构建）、`dist-prod/`（生产构建）
- TypeScript 配置：`tsconfig.json`，使用 `NodeNext` 模块解析

## 安全约束

- 单次对话最多 5 轮工具调用（`MAX_REQUEST_COUNT = 5`）
- 每个群聊同时只能处理一条消息（并发限制）
- API Key 存储在配置文件中，禁止提交到 Git
