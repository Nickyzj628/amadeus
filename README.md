# amadeus

男生自用全新QQ群聊机器人，基于[LLBot](https://luckylillia.com/)。

### 安装 LLBot

出门左转[LLBot快速安装](https://luckylillia.com/guide/choice_install)

使用LLBot登录机器人QQ后，在Bot配置栏目下启用OneBot 11，及其HTTP和HTTP POST服务，随意填写它们的端口号。

### 配置环境变量、模型、MCP、...

将`src/config.example.ts`改名为`src/config.ts`，参照其中注释完善配置。

### 安装依赖:

```bash
pnpm install
```

### 运行:

可以直接运行，也可以先打包再启动（体积小一些）

```bash
pnpm dev

# 或者
pnpm build:prod && pnpm start:prod
```
