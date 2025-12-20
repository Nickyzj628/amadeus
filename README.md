# amadeus

男生自用全新QQ机器人

### 安装 LLBot

出门左转[LLBot文档](https://www.llonebot.com/)

使用LLBot登录机器人QQ后，在Bot配置栏目下启用OneBot 11，及其HTTP和HTTP POST服务，记住它们的端口号，后面要填。

### 配置环境变量

在项目根目录创建 `.env` 文件，并按需配置以下环境变量：

- `ONEBOT_HTTP_PORT`：用于机器人主动交互（即上方开启的OneBot 11 HTTP服务端口号）
- `SENIVERSE_PRIVATE_KEY`: 心知天气 API密钥（用于查询城市天气）
- `DEEPSEEK_API_KEY`: DeepSeek API密钥（用于AI聊天）
- `GEMINI_API_KEY`: Google Gemini API密钥（用于AI聊天）
- `GLM_API_KEY`: Google Gemini API密钥（用于AI聊天）

如果不需要某个AI，可以在`src/plain-text.ts`文件下的`Ai.models`里注释掉。

如果不需要某条指令，可以在`src/command.ts`文件下的`commandMap`里注释掉。

示例 `.env` 文件：

```env
ONEBOT_HTTP_PORT=1234
SENIVERSE_PRIVATE_KEY=qwer
DEEPSEEK_API_KEY=zxcv
GEMINI_API_KEY=dfjk
GLM_API_KEY=asdf
```

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
