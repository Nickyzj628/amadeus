# Amadeus - AI Coding Agent Guide

## Project Overview

Amadeus 是一个基于 OneBot 11 协议的 QQ 群聊机器人，使用 TypeScript + Bun 运行时开发。机器人以大语言模型（LLM）作为核心对话引擎，支持多模态理解、工具调用、上下文记忆等功能。

项目名称来源于《命运石之门》中的 Amadeus 系统，机器人的人格设定基于角色牧濑红莉栖。

## Technology Stack

- **Runtime**: [Bun](https://bun.sh/) v1.3.2+
- **Language**: TypeScript 5.9.3+
- **HTTP Server**: Bun 原生 `Bun.serve()`
- **Schema Validation**: [Valibot](https://valibot.dev/) v1.2.0
- **HTTP Client**: `@nickyzj2023/utils` 内置 fetcher
- **Code Quality**: Biome (formatting + linting)

## Project Structure

```
amadeus/
├── src/
│   ├── index.ts           # 入口文件，启动 HTTP 服务器
│   ├── constants.ts       # 全局常量、系统提示词、模型配置
│   ├── routes/
│   │   ├── index.ts       # 根路由：处理群聊消息
│   │   └── brec.ts        # 录播姬 Webhook：B站直播推送
│   ├── schemas/
│   │   ├── onebot.ts      # OneBot 11 协议类型定义
│   │   ├── openai.ts      # OpenAI API 类型定义
│   │   └── bili.ts        # B站 API 类型定义
│   ├── tools/
│   │   ├── index.ts       # 工具注册与分发
│   │   ├── utils.ts       # 工具定义辅助函数
│   │   ├── changeModel.ts # 切换 LLM 模型
│   │   ├── getWeather.ts  # 查询天气（心知天气）
│   │   ├── searchWeb.ts   # 联网搜索（Tavily）
│   │   └── decodeAbbr.ts  # 拼音缩写解密
│   └── utils/
│       ├── common.ts      # 通用工具（JSON 读写、数字格式化）
│       ├── onebot.ts      # OneBot 协议工具
│       ├── openai.ts      # OpenAI API 封装
│       └── bili.ts        # B站链接解析
├── data/                  # 群聊消息持久化存储（JSON）
├── dist/                  # 构建输出目录
├── .env                   # 环境变量（必填）
├── llms.config.json       # LLM 模型配置
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
└── biome.json             # Biome 代码规范配置
```

## Build and Run Commands

```bash
# 安装依赖
bun install

# 开发模式（热重载）
bun run dev

# 生产构建
bun run build

# 运行生产构建
bun run start

# 代码检查
bunx biome check .

# 代码格式化
bunx biome format --write .
```

## Configuration

### 1. 环境变量 (.env)

复制 `.env.example` 为 `.env`，填写以下必填项：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `SELF_ID` | 机器人 QQ 号 | `12345678` |
| `ONEBOT_HTTP_PORT` | OneBot HTTP 服务端口号 | `7280` |
| `ONEBOT_HTTP_POST_PORT` | 机器人接收消息端口 | `8210` |
| `SENIVERSE_PRIVATE_KEY` | 心知天气私钥（可选） | - |
| `TAVILY_API_KEY` | Tavily 搜索 API Key（可选） | - |
| `BREC_GROUP_IDS` | 直播通知群号，逗号分隔（可选） | `123,456` |

### 2. 模型配置 (llms.config.json)

复制 `llms.config.example.json` 为 `llms.config.json`，配置 LLM 提供商：

```json
[
  {
    "provider": "提供商名称",
    "model": "模型ID",
    "baseUrl": "API 基础地址",
    "apiKey": "API 密钥",
    "contextWindow": 128000,
    "extraBody": { "reasoning": { "enabled": false } },
    "extraOptions": { "proxy": "http://127.0.0.1:7890" }
  }
]
```

**建议**：配置多模态模型以获得最佳体验（支持图片识别 + Function Calling）。

### 3. OneBot 配置

本项目需要配合 [LLBot](https://www.llonebot.com/) 使用：

1. 安装并登录 LLBot
2. 在 Bot 配置中启用 OneBot 11
3. 启用 HTTP 和 HTTP POST 服务
4. 将端口配置与 `.env` 中的环境变量对应

## Code Style Guidelines

本项目使用 **Biome** 进行代码规范检查，配置见 `biome.json`：

- **缩进**: Tab（非空格）
- **引号**: 双引号
- **分号**: 自动处理
- **行尾**: 自动处理
- **最大行宽**: 默认（80字符）

### 命名约定

- **文件**: 小写驼峰（camelCase），如 `changeModel.ts`
- **函数**: 小写驼峰，如 `handleTool()`
- **类型/接口**: 大写驼峰（PascalCase），如 `GroupMessageEvent`
- **常量**: 全大写下划线，如 `MAX_REQUEST_COUNT`

### 导入顺序

1. 第三方库（如 `valibot`, `@nickyzj2023/utils`）
2. 项目内部模块（使用 `@/` 路径别名）
3. 相对路径导入（同一目录下的工具函数）

## Key Architecture Details

### 1. 消息处理流程

```
OneBot HTTP POST → src/routes/index.ts → 消息解析 → 上下文管理 → LLM 请求 → 工具调用 → 回复
```

### 2. 上下文管理

- 每个群聊独立维护消息历史
- 消息存储在内存（Map）+ 本地 JSON 文件（`data/{groupId}.json`）
- 限制最大活跃群聊数（`MAX_ACTIVE_GROUPS = 2`），超出时释放不活跃群内存
- 消息数量达到阈值时自动总结（`SUMMARIZE_THRESHOLD = 30`）

### 3. 工具系统

工具定义在 `src/tools/` 目录，使用 `defineTool()` 辅助函数创建：

```typescript
export default defineTool(
  {
    type: "function",
    function: {
      name: "toolName",
      description: "工具描述",
      parameters: { /* JSON Schema */ }
    }
  },
  async (args) => {
    // 工具实现
    return "结果字符串";
  }
);
```

现有工具：
- `changeModel`: 切换当前使用的 LLM
- `getWeather`: 查询城市三日天气
- `searchWeb`: Tavily 联网搜索
- `decodeAbbr`: 拼音缩写解密（调用第三方 API）

### 4. B站链接解析

消息中检测到 B站链接时，会直接解析并回复视频/直播信息，不经过 LLM 处理。

### 5. 人设系统

- **基础人设**: 牧濑红莉栖（《命运石之门》角色）
- **安全词**: `myfork` - 触发时添加永久人设锚点
- **临时锚点**: 消息超过 10 条时自动添加，防止人设漂移

## Testing

本项目目前没有自动化测试。测试方式：

1. **本地运行**: `bun run dev`
2. **发送消息**: 在配置好的 QQ 群中 @机器人或发送消息
3. **查看日志**: 控制台输出包含时间戳的请求/响应日志

## Security Considerations

1. **API Key 管理**: 所有 API Key 存储在环境变量和配置文件中，**切勿提交到 Git**
2. **消息过滤**: 自动移除 `<think>` 标签内容，防止推理过程泄露
3. **请求限制**: 单次对话最多 5 次 LLM 请求（防止无限工具调用）
4. **并发控制**: 每个群同时只能处理一条消息

## Common Development Tasks

### 添加新工具

1. 在 `src/tools/` 创建新文件，如 `myTool.ts`
2. 使用 `defineTool()` 定义工具和处理器
3. 在 `src/tools/index.ts` 中导入并添加到 `tools` 数组
4. 在 `handleTool()` switch 语句中添加分发逻辑

### 修改人设/提示词

编辑 `src/constants.ts` 中的：
- `SYSTEM_PROMPT`: 基础系统提示词
- `IDENTITY_ANCHOR`: 人设锚点提示词
- `SAFE_WORD`: 触发锚点的关键词

### 添加新的消息段支持

1. 在 `src/schemas/onebot.ts` 定义 Schema
2. 在 `src/utils/onebot.ts` 添加类型守卫函数（如 `isXxxSegment`）
3. 在 `src/utils/openai.ts` 的 `onebotToOpenaiMessages()` 中添加转换逻辑

## Dependencies

### 生产依赖
- `@nickyzj2023/utils`: 通用工具库（fetcher、日志、类型检查等）
- `valibot`: Schema 验证

### 开发依赖
- `@biomejs/biome`: 代码规范
- `@types/bun`: Bun 类型定义
- `openai`: OpenAI API 类型定义（仅用于类型）
- `typescript`: TypeScript 编译器

## Notes

- 项目使用 ES Module（`"type": "module"`）
- 路径别名 `@/` 映射到 `./src/`
- 构建产物在 `dist/` 目录，使用 `--packages external` 不打包依赖
- 数据文件存储在项目根目录的 `data/` 文件夹中
