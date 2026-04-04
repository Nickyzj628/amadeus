import type { Segment } from "@/schemas/onebot/http-post.js";
import { normalizeText } from "../common.js";
import { isTextSegment, textToSegment } from "./segment.js";

/** 构造回复消息体 */
export const makeReplyBody = (
  ...segments: (string | Segment)[]
): { reply: Segment[]; at_sender: boolean } | undefined => {
  // 移除文本消息段里的不自然内容
  const normalizedSegments = segments.map((segment) => {
    if (typeof segment === "string") {
      return textToSegment(normalizeText(segment));
    }
    if (isTextSegment(segment)) {
      segment.data.text = normalizeText(segment.data.text);
    }
    return segment;
  });

  return {
    reply: normalizedSegments,
    at_sender: true,
  };
};

export class ReplyError extends Error {
  data: ReturnType<typeof makeReplyBody>;

  constructor(data: ReturnType<typeof makeReplyBody>) {
    super("ReplyError");
    this.data = data;
  }
}
