# amadeus

男生自用全新QQ机器人

### 安装 LLBot

出门左转[LLBot文档](https://www.llonebot.com/)

使用LLBot登录机器人QQ后，在Bot配置栏目下启用OneBot 11，及其HTTP和HTTP POST服务，随意填写它们的端口号。

### 配置环境变量

参考`.env.example`，只有`SELF_ID`（机器人QQ号）、`ONEBOT_HTTP_PORT`（OntBot HTTP服务端口号）、`ONEBOT_HTTP_POST_PORT`（OneBot HTTP POST服务端口号）是必填的。

### 安装依赖:

```bash
bun install
```

### 运行:

可以直接运行，也可以先打包再启动（体积小一些）

```bash
bun run dev

// 或者
bun run build && bun run start
```

This project was created using `bun init` in bun v1.3.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
