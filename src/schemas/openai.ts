export type MessageContentText = {
  type: "text";
  text: string;
};

export type MessageContentImage = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

export type MessageContent =
  | string
  | (MessageContentText | MessageContentImage)[];

export type SystemMessage = {
  role: "system";
  content: MessageContent;
};

export type UserMessage = {
  role: "user";
  content: MessageContent;
};

export type ToolMessage = {
  role: "tool";
  content: MessageContent;
};

export type Message = SystemMessage | UserMessage | ToolMessage;

export type Model = {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  /** 上下文窗口，默认 128k */
  totalContext: number;
  /** 请求时额外携带的 body 参数 */
  extraBody?: Record<string, any>;
};
