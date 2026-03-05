# MCP Servers

本项目使用 MCP（Model Context Protocol）管理工具，通过 `mcp.config.json` 配置管理，支持 **本地 stdio** 和 **远程 HTTP/SSE** 两种传输模式。

## 配置文件

所有 MCP Server 配置位于项目根目录 `mcp.config.json`：

### 当前配置

```json
{
  "amadeus": {
    "command": "npx",
    "args": ["tsx", "src/mcp/amadeus-server.ts"],
    "env": {
      "TAVILY_API_KEY": "your_api_key",
      "SENIVERSE_PRIVATE_KEY": "your_api_key"
    }
  },
  "fetch": {
    "command": "uvx",
    "args": ["mcp-server-fetch", "--ignore-robots-txt"],
    "env": {
      "PYTHONIOENCODING": "utf-8"
    }
  }
}
```

### 添加远程 MCP（如 ModelScope）

```json
{
  "amadeus": {
    "command": "npx",
    "args": ["tsx", "src/mcp/amadeus-server.ts"],
    "env": {
      "TAVILY_API_KEY": "tvly-xxx",
      "SENIVERSE_PRIVATE_KEY": "xxx"
    }
  },
  "fetch": {
    "command": "uvx",
    "args": ["mcp-server-fetch", "--ignore-robots-txt"],
    "env": {}
  },
  "github": {
    "type": "streamable_http",
    "url": "https://mcp.api-inference.modelscope.net/xxx/mcp"
  }
}
```

---

## 配置说明

### Stdio 模式（本地）

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 可选，默认为 `"stdio"` |
| `command` | string | 启动命令，如 `npx`, `node`, `uvx` |
| `args` | string[] | 命令参数 |
| `env` | object | 环境变量 |

### HTTP 模式（远程）

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 必需， `"streamable_http"` 或 `"sse"` |
| `url` | string | MCP Server URL |
| `headers` | object | 可选，自定义 HTTP headers |

---

## 传输模式对比

| 特性 | Stdio (本地) | HTTP (远程) |
|------|-------------|-------------|
| **内存占用** | 高（每个 client 一个子进程） | 低（共享 server 进程） |
| **启动速度** | 慢（需启动子进程） | 快（已有连接） |
| **网络要求** | 无 | 需要网络连接 |
| **适用场景** | < 10 个 servers | > 10 个 servers / Cloud 部署 |
| **延迟** | 低（本地进程间通信） | 中等（网络延迟） |

---

## Amadeus MCP Server（整合版）

**文件**: `src/mcp/amadeus-server.ts`

整合三个工具的单一 MCP Server：

| 工具名 | 功能 | 环境变量 |
|--------|------|----------|
| `web_search` | Tavily 网络搜索 | `TAVILY_API_KEY` |
| `decode_abbr` | 拼音缩写解密 | 无需 |
| `get_weather` | 心知天气查询 | `SENIVERSE_PRIVATE_KEY` |

**优势**：
- 减少内存占用（从 3 个子进程变为 1 个）
- 简化配置（一个配置项替代三个）
- 统一错误处理和日志

---

## Fetch MCP Server

**方式 A：本地运行（当前使用）**

```json
{
  "fetch": {
    "command": "uvx",
    "args": ["mcp-server-fetch", "--ignore-robots-txt"],
    "env": {
      "PYTHONIOENCODING": "utf-8"
    }
  }
}
```

**方式 B：ModelScope 远程（可选）**

```json
{
  "fetch": {
    "type": "streamable_http",
    "url": "https://mcp.api-inference.modelscope.net/c10c3856703048/mcp"
  }
}
```

---

## 架构

### 整合前（3 个子进程）

```
┌───────────────────────────────────────────┐
│              mcp.config.json                │
│  ┌─────────┐ ┌─────────┐ ┌────────┐        │
│  │ search  │ │ decode  │ │ weather│        │
│  └────┬────┘ └────┬────┘ └───┬────┘        │
└───────┼───────────┼──────────┼─────────────┘
        │           │          │
        ▼           ▼          ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ Process │ │ Process │ │ Process │
   │ ~80MB   │ │ ~50MB   │ │ ~60MB   │
   │         │ │         │ │         │
   │ ~190MB  │ 总计       │         │
   └─────────┘ └─────────┘ └─────────┘
```

### 整合后（1 个子进程）

```
┌───────────────────────────────────────────┐
│              mcp.config.json                │
│  ┌──────────┐          ┌────────┐         │
│  │ amadeus  │          │ fetch  │         │
│  │[3 tools] │          │[stdio] │         │
│  └────┬─────┘          └───┬────┘         │
└───────┼────────────────────┼──────────────┘
        │                    │
        ▼                    ▼
   ┌─────────┐         ┌──────────┐
   │ Process │         │ Process  │
   │ ~100MB  │         │ ~80MB    │
   │         │         │          │
   │ ~180MB  │ 总计     │          │
   └─────────┘         └──────────┘
```

---

## 在当前项目中使用

```typescript
import { 
  getMcpTool, 
  getWebSearchTool, 
  getDecodeAbbrTool,
  getFetchTool,
  getWeatherTool 
} from "./mcp-client.js";

// 通用方法
const searchTool = await getMcpTool("amadeus", "web_search");
const decodeTool = await getMcpTool("amadeus", "decode_abbr");
const weatherTool = await getMcpTool("amadeus", "get_weather");
const fetchTool = await getMcpTool("fetch", "fetch");

// 快捷方法（推荐）
const searchTool = await getWebSearchTool();
const decodeTool = await getDecodeAbbrTool();
const weatherTool = await getWeatherTool();
const fetchTool = await getFetchTool();
```

连接日志示例：
```
[14:30:15] amadeus MCP 客户端已连接 [stdio]
[14:30:15] fetch MCP 客户端已连接 [stdio]
```

---

## 添加新的 MCP Server

### 本地 Server

如果新工具与现有功能紧密相关，考虑添加到 `amadeus-server.ts`：

```typescript
// 在 amadeus-server.ts 中注册新工具
server.registerTool(
  "new_tool",
  { /* ... */ },
  async (args) => { /* ... */ }
);
```

如果是独立功能，创建新 server：

1. 创建 `src/mcp/new-server.ts`
2. 添加到 `mcp.config.json`：

```json
{
  "newServer": {
    "command": "npx",
    "args": ["tsx", "src/mcp/new-server.ts"],
    "env": {}
  }
}
```

3. 在 `mcp-client.ts` 添加快捷函数（可选）：

```typescript
export const getNewTool = () => getMcpTool("newServer", "tool_name");
```

### 远程 Server（ModelScope）

1. 访问 https://modelscope.cn/mcp
2. 选择需要的 MCP Server（如 github、postgres 等）
3. 点击"生成配置"
4. 复制 URL 到 `mcp.config.json`

**示例 ModelScope MCPs：**
- `fetch` - 网页抓取
- `github` - GitHub API 操作
- `postgres` - PostgreSQL 数据库
- `sqlite` - SQLite 数据库
- `time` - 时间工具

使用远程 MCP 可以大幅减少内存占用，特别是当你有 10+ 个 servers 时。

---

## 在 Claude Desktop 中使用

Claude Desktop 配置格式略有不同（使用 `mcpServers` 包裹层）：

```json
{
  "mcpServers": {
    "amadeus": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/amadeus/src/mcp/amadeus-server.ts"],
      "env": {
        "TAVILY_API_KEY": "xxx",
        "SENIVERSE_PRIVATE_KEY": "xxx"
      }
    },
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"],
      "env": {}
    }
  }
}
```
