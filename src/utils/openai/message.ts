import {
	camelToSnake,
	imageUrlToBase64,
	mapKeys,
	mapValues,
	timeLog,
	to,
} from "@nickyzj2023/utils";
import type { ChatCompletionMessageParam } from "openai/resources";
import sharp from "sharp";
import type { MinimalMessageEvent } from "@/schemas/onebot";
import {
	flattenForwardSegment,
	getMessage,
	isAtSegment,
	isForwardSegment,
	isImageSegment,
	isReplySegment,
	isTextSegment,
} from "@/utils/onebot";

/**
 * 构造 OpenAI API 消息对象
 * @remarks 通过泛型 K 捕获 role 的具体类型，从而精准推导剩余字段
 */
export const contentToMessage = <K extends ChatCompletionMessageParam["role"]>(
	content: ChatCompletionMessageParam["content"],
	options?: {
		/** 修改消息对应的角色，默认 user */
		role?: K;
	} & Partial<
		Omit<Extract<ChatCompletionMessageParam, { role: K }>, "content" | "role">
	>,
): ChatCompletionMessageParam => {
	const { role = "user" as K, ...restOptions } = options ?? {};

	return {
		role,
		content,
		...restOptions,
	} as ChatCompletionMessageParam;
};

/**
 * 把消息格式从 OneBot 转成 OpenAI API
 * @remarks 保证安全返回消息对象
 */
export const onebotToOpenaiMessages = async (
	e: MinimalMessageEvent,
	options?: {
		/** 是否忽略回复的消息 */
		ignoreReply?: boolean;
		/** 是否忽略合并转发消息 */
		ignoreForward?: boolean;
		/** 每条转发消息允许递归获取的消息数 */
		forwardCount?: number;
		/** 是否为被引用的上下文消息 */
		isQuoted?: boolean;
	},
): Promise<ChatCompletionMessageParam[]> => {
	const { ignoreReply, ignoreForward, forwardCount, isQuoted } = options ?? {};

	const bodyItems: string[] = [];
	const mediaItems: string[] = [];
	const mentionedUserIds: string[] = [];
	const quotedMessages: ChatCompletionMessageParam[] = [];

	// 解析消息段数组
	for (const segment of e.message) {
		// 文字
		if (isTextSegment(segment)) {
			bodyItems.push(segment.data.text);
		}
		// 图片
		else if (isImageSegment(segment)) {
			timeLog("识别到一条图片消息", segment);
			const [error, base64] = await to(
				imageUrlToBase64(segment.data.url, {
					compressor: async (buffer, mime, quality) => {
						const input = Buffer.from(buffer);
						const maxDimension = 1600; // 最大边长
						const targetSize = 300 * 1024; // 目标大小（KB）

						// 获取图片元数据
						const image = sharp(input);
						const metadata = await image.metadata();
						const width = metadata.width || 0;
						const height = metadata.height || 0;
						const maxSide = Math.max(width, height);

						// 如果已经小于目标大小，则直接返回
						if (input.length <= targetSize) {
							return `data:${mime};base64,${input.toString("base64")}`;
						}

						// 计算缩放后的尺寸
						const ratio = maxSide > maxDimension ? maxDimension / maxSide : 1;
						const resizeWidth = Math.floor(width * ratio);
						const resizeHeight = Math.floor(height * ratio);

						// 经验公式估算 quality：目标大小 / 原图大小 * 100，限制在 40-80 之间
						const estimatedQuality = Math.max(
							40,
							Math.min(80, Math.floor((targetSize / input.length) * 100)),
						);

						const compressed = await image
							.resize(resizeWidth, resizeHeight, { fit: "inside" })
							.jpeg({ quality: estimatedQuality, progressive: true })
							.toBuffer();

						timeLog(
							`图片压缩成果：${width}x${height}(${(input.length / 1024).toFixed(2)}KB) -> ${resizeWidth}x${resizeHeight}(${(compressed.length / 1024).toFixed(2)}KB)`,
						);
						return `data:image/jpeg;base64,${compressed.toString("base64")}`;
					},
				}),
			);
			if (!error) {
				mediaItems.push(base64);
			}
		}
		// @ 某人
		else if (isAtSegment(segment)) {
			mentionedUserIds.push(segment.data.qq);
		}
		// 合并转发
		else if (isForwardSegment(segment) && !ignoreForward) {
			const forwardedMessages = (
				await flattenForwardSegment(segment.data.id, {
					count: forwardCount,
					processMessageEvent: (e) =>
						onebotToOpenaiMessages(e, {
							...options,
							isQuoted: true,
						}),
				})
			).flat();

			quotedMessages.push(...forwardedMessages);
		}
		// 回复
		else if (isReplySegment(segment) && !ignoreReply) {
			const e = await getMessage(segment.data.id);
			if (e) {
				const repliedMessages = await onebotToOpenaiMessages(e, {
					...options,
					isQuoted: true,
				});
				quotedMessages.push(...repliedMessages);
			}
		}
	}

	// 把散落的消息合并为一个复合数组返回
	return [
		// 上下文消息
		...quotedMessages,
		// 当前消息
		contentToMessage([
			{
				type: "text",
				text: JSON.stringify(
					mapValues(
						mapKeys(
							{
								isQuoted,
								userId: String(e.sender.user_id),
								userName: e.sender.nickname,
								body: bodyItems.join("\n"),
								mentionedUserIds,
								time: new Date().toLocaleString(),
							},
							camelToSnake,
						),
						(value) => value,
						{
							filter: (value) => {
								if (Array.isArray(value)) {
									return value.length > 0;
								}
								return !!value;
							},
						},
					),
				),
			},
		]),
		// 当前图片消息
		...mediaItems.map((item) =>
			contentToMessage([
				{
					type: "image_url",
					image_url: {
						url: item,
					},
				},
			]),
		),
	];
};
