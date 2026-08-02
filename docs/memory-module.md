# 记忆模块运作流程

基于 mem0 的长期记忆系统，覆盖「收到群消息 → 注入相关记忆 → 模型回复中读写记忆 → 回复后收回」的完整链路。
整体流程与提交 `6a06e6d` 的描述一致：**回复前注入相关记忆 → 回复中模型自行调用 `saveMemory` / `forgetMemory` → 回复后移除注入的记忆**。

## 总览流程图

```mermaid
flowchart TD
    A["OneBot 收到群消息<br/>src/index.ts:33"] --> B["校验事件格式<br/>GroupMessageEventSchema<br/>src/index.ts:35-48"]
    B --> C["加载该群消息历史<br/>loadMessages<br/>src/index.ts:52"]
    C --> D["请求群专属锁<br/>navigator.locks.request('group-{groupId}')<br/>src/index.ts:68"]
    D --> E["消息转 OpenAI 格式<br/>onebotToOpenAI<br/>src/index.ts:79-80"]
    E --> F["用消息正文搜索记忆<br/>injectMemory<br/>src/index.ts:89-92"]

    subgraph 阶段一：回复前 · 注入相关记忆
        F --> F1{"mem0ApiKey 已配置？<br/>hasMem0ApiKey<br/>memory.ts:25,51"}
        F1 -- "否" --> F1X["静默跳过，不注入<br/>memory.ts:51-53"]
        F1 -- "是" --> F2["POST /search/<br/>query=正文, user_id=QQ, top_k=10<br/>memory.ts:55-64"]
        F2 --> F3{"请求成功且校验通过？<br/>safeParse(Mem0SearchResponseSchema)<br/>memory.ts:70-75"}
        F3 -- "失败" --> F3X["logger 记录 + 注入占位<br/>（暂无相关记忆）<br/>memory.ts:65-75"]
        F3 -- "成功" --> F4["按用户聚合<br/>results.reduce → {user_id:{uuid:内容}}<br/>memory.ts:76-87"]
        F4 --> F5["序列化为文本<br/>'用户ID:\\nuuid: 内容'<br/>memory.ts:89-97"]
        F5 --> F6["push &lt;memory&gt; 消息到上下文末尾<br/>pushMemoryMessage<br/>memory.ts:31-36,99"]
    end

    F6 --> G["模型生成回复<br/>generateContent → chatCompletions(tools)<br/>generate-content.ts:58-63"]

    subgraph 阶段二：回复中 · 模型读写记忆
        G --> H{"模型调用记忆工具？"}
        H -- "saveMemory" --> H1["handler 校验 userId<br/>saveMemory.ts:26-30"]
        H1 --> H2["POST /add/ 或 PUT /{id}/<br/>saveMemory<br/>memory.ts:129-155"]
        H2 --> H3["返回'已记住/已更新'<br/>saveMemory.ts:32-34"]
        H -- "forgetMemory" --> H4["handler 取 memoryId<br/>forgetMemory.ts:16-20"]
        H4 --> H5["DELETE /{id}/<br/>deleteMemory<br/>memory.ts:161-171"]
        H5 --> H6["返回'已删除记忆'<br/>forgetMemory.ts:19"]
        H -- "无工具调用" --> H7["直接输出回复内容"]
        H3 --> I["replyLikeHuman 分段回复<br/>src/index.ts:99-102"]
        H6 --> I
        H7 --> I
    end

    I --> J["自动优化上下文<br/>autoCompact<br/>src/index.ts:104-105"]

    subgraph 阶段三：回复后 · 收回记忆
        J --> K["finally：移除本轮注入的 &lt;memory&gt; 消息<br/>removeInjectedMemory<br/>src/index.ts:110-114"]
        K --> L["保存历史（已无 &lt;memory&gt; 残留）<br/>saveMessages<br/>src/index.ts:115-116"]
    end

    L --> M["释放群锁，本轮结束"]
```

## 阶段一：回复前 · 注入相关记忆

### 1. 收到群消息并加载历史

- **位置**：`src/index.ts:33-52`
- OneBot 推送群消息到 HTTP 路由，`safeParse(GroupMessageEventSchema)` 校验后取出 `group_id` / `user_id`（`:51`），`loadMessages(groupId)` 加载/常驻该群的消息数组（`:52`）
- 随后 `navigator.locks.request("group-{groupId}", ...)` 获取群专属锁，保证同群消息按序处理（`:68`）

### 2. 消息转 OpenAI 格式

- **位置**：`src/index.ts:79-80`
- `onebotToOpenAI(e)` 把 OneBot 消息段转成 `AI.Message[]`，正文消息含 `<user_id>` / `<body>` 等标签（供模型推断记忆归属，见阶段二）

### 3. 用消息正文搜索记忆（injectMemory）

- **调用处**：`src/index.ts:89-92`——取 `onebotToOpenAI` 返回的最后一条消息（正文）作为搜索 query
- **实现**：`src/openai/utils/memory.ts:45-100`

流程细节：

| 步骤 | 代码位置 | 说明 |
|---|---|---|
| Key 检查 | `memory.ts:51-53` | `hasMem0ApiKey()`（`memory.ts:25`）未配置则静默跳过，不注入、不报错 |
| 请求参数 | `memory.ts:55-64` | `POST /search/`，`query` 为消息正文，`filters = { user_id: String(userId) }` 按用户过滤，`top_k: 10` |
| 请求失败兜底 | `memory.ts:65-69` | `to()` 捕获错误 → `logger` 记录 → 注入占位消息 |
| 响应校验 | `memory.ts:70-75` | `safeParse(Mem0SearchResponseSchema)`（schema 见 `src/openai/schemas/mem0.ts:19-42`）；校验失败同样注入占位 |
| 按用户聚合 | `memory.ts:76-87` | `results.reduce` → `{ user_id: { id: memory } }`，一条记忆一个 UUID |
| 序列化 | `memory.ts:89-97` | 转成 `用户ID:\nuuid: 内容\n...` 多行文本（模型后续靠这个格式取 UUID 更新/删除） |
| 注入消息 | `memory.ts:31-36, 99` | `pushMemoryMessage` 用 `createXMLText("memory", serialized)` 生成 `<memory>` 标签，`contentToMessage` 包成 `role: "user"` 消息 push 到**上下文末尾** |

- 无相关记忆或搜索失败时，占位文本 `（暂无相关记忆）` 保证 `<memory>` 消息**始终存在**
- 系统提示词对 `<memory>` 语义的解释：`src/openai/prompts/base.md:40-48`（记忆参考、不是用户发言、UUID 即唯一标识）

## 阶段二：回复中 · 模型读写记忆

### 4. 模型生成回复（可调用工具）

- **位置**：`src/openai/utils/generate-content.ts:58-63`
- `chatCompletions(model, messages, { tools: openaiTools, ... })`，工具列表在 `src/openai/tools/index.ts:13-19` 组装
- **关键**：`tools/index.ts:18` 中 `saveMemory` / `forgetMemory` 仅在 `config.apiKeys.mem0ApiKey` 已配置时才注册——没 Key 时模型根本看不到这两个工具
- 工具调用由 `@nickyzj2023/utils` 的 `chatCompletions` 内部执行（`handler(参数, options)`），结果自动作为 `role: "tool"` 消息回填，无需本项目代码介入

### 5. saveMemory 工具（新增/更新记忆）

- **定义**：`src/openai/tools/saveMemory.ts:4-35`
- **参数**：`text`（必填，记忆内容）、`userId`（必填，归属用户 QQ 号，模型从 `<user_id>` / `<mentioned_user_ids>` / `<memory>` 推断，不限于当前发言者）、`memoryId`（可选，更新目标）
- **handler**：`saveMemory.ts:26-35` → 校验 `userId` 后调用底层函数
- **底层实现**：`src/openai/utils/memory.ts:129-155`
  - 新建：`POST /add/`，`user_id`、`infer: false`（原样存入、不走 mem0 提取）、`messages` 包一条 assistant 消息（`:140-146`）
  - 更新：`PUT /{id}/`，`text`（`:147-151`）
  - Key 缺失静默跳过（`:134-137`）；失败只 `logger` 不抛异常（`:152-154`）

### 6. forgetMemory 工具（删除记忆）

- **定义**：`src/openai/tools/forgetMemory.ts:5-20`
- **参数**：`memoryId`（必填，从 `<memory>` 里取目标 UUID）
- **handler**：`forgetMemory.ts:16-20` → 调用底层函数
- **底层实现**：`src/openai/utils/memory.ts:161-171`——`DELETE /{id}/`，Key 缺失静默跳过（`:163-165`），失败 `to()` 捕获并 `logger`

### 7. 回复用户

- **位置**：`src/index.ts:99-102`——`replyLikeHuman(content, groupId, ...)` 把模型回复分段发出

## 阶段三：回复后 · 收回记忆

### 8. 自动优化上下文

- **位置**：`src/index.ts:104-105`——`autoCompact(messages, usage)` 按 token 用量压缩历史（与记忆模块无耦合）

### 9. 收回本轮注入的 `<memory>` 消息

- **位置**：`src/index.ts:110-114`（`finally` 块）——**无论成败都执行**
- **实现**：`src/openai/utils/memory.ts:108-120`——`removeInjectedMemory` 用 `findLastIndex` 从后往前找最后一条 content 含 `<memory>` 的消息并 `splice`
  - 从后往前的原因：历史成功轮次的 `<memory>` 也会残留在消息数组里，但位置靠前；本轮注入的是最后一条，只删它、不误删历史（`memory.ts:109-111`）
- **为什么在 `finally`**：`<memory>` 是每轮临时注入的参考，不应随历史持久化；`saveMessages` 在 `finally` 之后才执行（`src/index.ts:115-116`），保证落盘的一定是干净上下文

### 10. 保存历史

- **位置**：`src/index.ts:115-116`——`saveMessages(groupId, messages)`，此时 `<memory>` 已被收回

### 失败路径

- 模型处理失败（异常）→ `src/index.ts:106-109`：先 `autoCompact` 压缩，再 `return error` 带出；`finally`（`:110-114`）仍会收回 `<memory>`，但不会执行 `saveMessages`
- 错误统一分类：`src/index.ts:120-130` 之后（`denyReply` 静默、其余打日志/回复）

## 关键实现细节

| 关注点 | 位置 | 说明 |
|---|---|---|
| mem0 客户端 | `memory.ts:14-18` | `fetcher("https://api.mem0.ai/v3/memories")`，Header 带 `Token ${config.apiKeys.mem0ApiKey}` |
| Key 缺失降级 | `memory.ts:25` + `tools/index.ts:18` | 双重保险：工具不注册 + 底层函数静默跳过 |
| 响应 schema | `schemas/mem0.ts:19-42` | `MemoryItemSchema`（`id`/`user_id`/`memory`/`score`/`metadata`/`categories`/`created_at`/`updated_at`） |
| 记忆归属隔离 | `memory.ts:55, 142` | 搜索、创建均带 `user_id`；更新/删除按 UUID 定位 |
| 工具与底层的命名 | `forgetMemory.ts:2-3` | 工具名 `forgetMemory`（模型语义），底层函数仍叫 `deleteMemory` |

## 涉及文件清单

- `src/index.ts` —— 流程编排（注入/回复/收回/保存）
- `src/openai/utils/memory.ts` —— 记忆核心逻辑（搜索/注入/收回/增删改）
- `src/openai/tools/saveMemory.ts`、`src/openai/tools/forgetMemory.ts` —— 记忆读写工具
- `src/openai/tools/index.ts` —— 工具注册（按 Key 条件化）
- `src/openai/schemas/mem0.ts` —— 搜索响应校验
- `src/openai/prompts/base.md` —— 系统提示词中的记忆机制说明
- `src/openai/utils/generate-content.ts` —— 携带 tools 发起模型请求
