/**
 * 配置文件
 * 复制此文件为 config.ts 后填入你的实际配置
 */

export default {
  /** 机器人核心配置 */
  bot: {
    /** 机器人 QQ 号 */
    selfId: "12345678",
    /** OneBot HTTP 服务端口号（用于机器人主动发送请求） */
    onebotHttpPort: 7280,
    /** OneBot HTTP POST 服务端口号（用于机器人接收消息） */
    onebotHttpPostPort: 8210,
  },

  /** 模型列表
   * @remarks 模型必须满足以下条件：
   * 1. 兼容 OpenAI API 请求格式
   * 2. 多模态，否则无法识别图片、调用工具
   */
  models: [
    {
      /** 提供商名称 */
      provider: "OpenRouter",
      /** 模型 ID */
      model: "openai/gpt-5.4-nano",
      /** API 前缀地址 */
      baseUrl: "https://openrouter.ai/api/v1",
      /** API 密钥 */
      apiKey: "xxxxx",
      /** 总上下文大小（token 数，128K 约等于 128000，1M 约等于 1048576） */
      totalContext: 400000,
    },
    {
      /** 提供商名称 */
      provider: "七牛云",
      /** 模型 ID */
      model: "doubao-seed-2.0-pro",
      /** API 前缀地址 */
      baseUrl: "https://api.qnaigc.com/v1",
      /** API 密钥 */
      apiKey: "xxxxx",
      /** 总上下文大小（token 数，128K 约等于 128000，1M 约等于 1048576） */
      totalContext: 256000,
    },
    {
      /** 提供商名称 */
      provider: "本地",
      /** 模型 ID */
      model: "koboldcpp/gemma-4-E4B-it-Q4_K_M",
      /** API 前缀地址 */
      baseUrl: "http://localhost:5001/v1",
      /** API 密钥 */
      apiKey: "",
      /** 总上下文大小（token 数，128K 约等于 128000，1M 约等于 1048576） */
      totalContext: 8192,
    },
  ],

  /** API 密钥配置（可选，用于 Function Calling Tools） */
  apiKeys: {
    /**
     * 心知天气私钥，用于查询城市三日天气
     * @see https://www.seniverse.com/dashboard
     * @remarks 控制台 - 我的产品 - 免费版 - API 密钥 - 私钥
     */
    seniversePrivateKey: "xxxxx",
  },

  /** 远程 MCP 服务器配置（可选）
   * @remarks 工具列表会自动从远程 MCP 服务器的 listTools() API 获取
   */
  mcpServers: {
    /**
     * Tavily 联网搜索
     * @see https://github.com/tavily-ai/tavily-mcp?tab=readme-ov-file#remote-mcp-server
     */
    "tavily-remote-mcp": {
      type: "streamable_http",
      url: "https://mcp.tavily.com/mcp/?tavilyApiKey=xxxxx",
      // 如果 MCP 客户端中含有不需要的工具，可以写在这里忽略，减少上下文长度
      ignoredToolNames: [
        "tavily_crawl",
        "tavily_map",
        "tavily_research",
        "tavily_skill",
      ],
    },
  },

  /**
   * Bilibili 直播通知推送配置（可选）
   */
  brec: {
    /**
     * 要订阅哪些直播间
     * 12dora、api、泛式、张哥、星铁
     */
    roomIds: [544786, 92613, 33989, 5050, 27263119, 213, 4788550],
    /** 要推送到哪些 QQ 群 */
    groupIds: [123456789],
  },
};
