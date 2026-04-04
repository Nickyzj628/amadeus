import config from "@/config.js";
import { isNil } from "@nickyzj2023/utils";
import { getForwardMessages } from "./http.js";
import type {
  AtSegment,
  CommonSegment,
  ForwardSegment,
  ImageSegment,
  MinimalMessageEvent,
  MiniProgramSegment,
  ReplySegment,
  Segment,
  TextSegment,
} from "@/schemas/onebot/http-post.js";

const selfId = Number(config.bot.selfId);

/** 是否为 @ 某人的消息段 */
export const isAtSegment = (segment?: CommonSegment): segment is AtSegment => {
  return !isNil(segment) && segment.type === "at";
};

/** 是否为 @ 当前机器人的消息段 */
export const isAtSelfSegment = (segment?: CommonSegment): segment is AtSegment => {
  return isAtSegment(segment) && Number(segment.data.qq) === selfId;
};

/** 是否为纯文本消息段 */
export const isTextSegment = (segment?: CommonSegment): segment is TextSegment => {
  return !isNil(segment) && segment.type === "text";
};

/** 从纯文本消息段中提取出"/<fn> <...args>" */
export const textSegmentToCommand = (segment: TextSegment) => {
  const { text } = segment.data;
  if (!text.startsWith("/")) {
    return { fn: undefined, args: [] };
  }

  const [fn, ...args] = text.slice(1).split(" ");
  return { fn, args };
};

/** 构造纯文本消息段 */
export const textToSegment = (text: string): TextSegment => ({
  type: "text",
  data: { text },
});

/** 是否为合并转发消息段 */
export const isForwardSegment = (segment?: CommonSegment): segment is ForwardSegment => {
  return !isNil(segment) && segment.type === "forward";
};

/** 是否为图片消息段 */
export const isImageSegment = (segment?: CommonSegment): segment is ImageSegment => {
  return !isNil(segment) && segment.type === "image";
};

/** 从图片 URL 构造图片消息段 */
export const srcToImageSegment = (src: string): ImageSegment => ({
  type: "image",
  data: { url: src },
});

/** 是否为回复消息段 */
export const isReplySegment = (segment?: CommonSegment): segment is ReplySegment => {
  return !isNil(segment) && segment.type === "reply";
};

/** 是否为小程序消息段 */
export const isMiniProgramSegment = (segment?: CommonSegment): segment is MiniProgramSegment => {
  return !isNil(segment) && segment.type === "json";
};

/**
 * 递归展开合并转发的消息
 * @remarks 保证安全返回数组
 */
export const flattenForwardSegment = async <T = Segment>(
  messageId: ForwardSegment["data"]["id"],
  options?: {
    /** 把消息转换成期望的类型 */
    processMessageEvent?: (e: MinimalMessageEvent) => Promise<T>;
    /** 递归展开的消息数量，默认 50 */
    count?: number;
  },
): Promise<T[]> => {
  const resultItems: T[] = [];
  const {
    processMessageEvent = (async (e) => e.message) as (e: MinimalMessageEvent) => Promise<T>,
    count = 50,
  } = options ?? {};

  const forwardMessages = await getForwardMessages(messageId, count);

  // 把消息转换成期望的格式
  for (const e of forwardMessages) {
    const item = await processMessageEvent(e);
    resultItems.push(item);
  }

  return resultItems;
};
