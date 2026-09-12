import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { logger } from "@nickyzj2023/utils";
import sharp from "sharp";

/** 格式化数字为紧凑格式，例如 1000 显示为 1k */
export const formatNumberCompact = (num: number) => {
	return new Intl.NumberFormat("zh-CN", {
		notation: "compact",
		compactDisplay: "short",
	}).format(num);
};

/**
 * 判断地址是本地/远程/base64
 */
export const checkUrlType = (str: string) => {
	// 网络地址
	if (/^https?:\/\//.test(str)) {
		return "remote";
	}
	// base64 Data URL
	if (/^data:/.test(str)) {
		return "base64";
	}
	// 本地文件路径：
	// - 相对路径 ./ ../
	// - 绝对路径 C:\ D:/
	if (/^(\.{1,2}[/\\]|[a-zA-Z]:[/\\])/.test(str)) {
		return "local";
	}
	return "";
};

/** 将字节数转换为人类可读的字符串，例如 1024 => 1 KB */
export const formatBytes = (bytes: number) => {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
	}
	if (bytes >= 1024) {
		return `${(bytes / 1024).toFixed(2)} KB`;
	}
	return `${bytes} B`;
};

/**
 * 移除文本中的不自然内容：
 * - 思考标签
 * - 字面量换行 => 真换行
 * - 各平台的换行符 => \n
 * - 多重换行 => \n
 */
export const normalizeText = (text: string) => {
	return (
		text
			// 移除可能残留的思考标签及其内容
			.replace(/<think>[\s\S]*?<\/think>/gi, "")
			.replace(/<thought>[\s\S]*?<\/thought>/gi, "")
			// 把字面量换行还原成真换行
			.replace(/\\r\\n|\\n/g, "\n")
			// 统一换行符，Windows的\r\n会在段落尾部残留\r
			.replace(/\r\n?/g, "\n")
			// 合并多重换行
			.replace(/\n\s*\n/g, "\n")
	);
};

/**
 * lodash.get()
 *
 * @example
 * const obj = { a: { b: [1, 2, 3] } };
 * get(obj, "a.b[1]"); // 2
 */
export const get = (obj: Record<string, any>, path: string) => {
	// "a.b[0].c" => "a.b.0.c" => ["a", "b", "0", "c"]
	const segments = path
		.replace(/\[(\d+)\]/g, ".$1")
		.split(".")
		.filter(Boolean);

	return segments.reduce((result, key) => {
		if (typeof result !== "object" || result === null) {
			return undefined;
		}
		return result[key];
	}, obj);
};

/**
 * 使用sharp压缩图片，动图转gif，静态图转webp
 * @param input 支持任意地址、Buffer
 * @param options 压缩参数
 * @returns base64 Data URL
 */
export const compressImage = async (
	input: string,
	options?: {
		/**
		 * 压到指定大小以内
		 * @default 5 * 1024 * 1024
		 */
		maxSize?: number;
		/**
		 * 压到指定高度以内
		 * @default 600
		 */
		maxHeight?: number;
	},
): Promise<string> => {
	const { maxSize = 5 * 1024 * 1024, maxHeight = 600 } = options ?? {};

	/**
	 * 把图片统一处理成 Buffer，便于 sharp 解析
	 */
	let sharpInput: Buffer;
	const inputType = checkUrlType(input);
	switch (inputType) {
		case "": {
			throw new Error(`不支持的地址：${input}`);
		}
		case "remote": {
			const response = await fetch(input);
			const arrayBuffer = await response.arrayBuffer();
			sharpInput = Buffer.from(arrayBuffer);
			break;
		}
		case "local": {
			sharpInput = await readFile(resolve(input));
			break;
		}
		case "base64": {
			sharpInput = Buffer.from(input.split(",")[1]!, "base64");
			break;
		}
	}

	const metadata = await sharp(sharpInput).metadata();
	const frames = metadata.pages ?? 1;
	const isAnimated = frames > 1;
	// 动图的metadata.height是全部帧堆叠的总高，要除以帧数才能还原出单帧高度
	const frameHeight =
		metadata.pageHeight ?? Math.round((metadata.height ?? 0) / frames);

	let outputBuffer: Buffer;
	let mime: string;

	// 动图：压缩宽高、色数，输出gif
	if (isAnimated) {
		// 必须是gif（部分模型不认animated webp）
		mime = "image/gif";

		const sourceSize = metadata.size ?? Infinity;
		const sourceWidth = metadata.width ?? 0;
		let nextWidth =
			frameHeight > maxHeight
				? Math.max(1, Math.round((sourceWidth * maxHeight) / frameHeight))
				: undefined;

		// 尝试3次
		const maxAttempts = 3;
		const coloursSteps = [128, 64, 32];
		let compressed: Buffer;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			let image = sharp(sharpInput, { animated: true });
			if (nextWidth) {
				image = image.resize({ width: nextWidth });
			}
			for (const colours of coloursSteps) {
				compressed = await image.gif({ colours, effort: 7, loop: 0 }).toBuffer();
				if (compressed && compressed.length <= Math.min(sourceSize, maxSize)) {
					break;
				}
			}
			nextWidth = Math.max(1, Math.round((nextWidth ?? sourceWidth) * 0.6));
		}
		outputBuffer = compressed!;
	}
	// 静态图：压缩宽高、体积，输出webp
	else {
		mime = "image/webp";
		let image = sharp(sharpInput);

		/**
		 * 压缩到maxHeight以内
		 */
		if (metadata.height && metadata.height > maxHeight) {
			image = image.resize({
				height: maxHeight,
				fit: "inside",
				withoutEnlargement: true,
			});
		}

		/**
		 * 压缩到maxSize以内
		 */
		let compressed: Buffer;
		for (let quality = 80; quality >= 40; quality -= 10) {
			compressed = await image.webp({ quality }).toBuffer();
			if (compressed.length <= maxSize) {
				break;
			}
		}
		outputBuffer = compressed!;
	}

	logger(
		`压缩了一张${mime}图片：${formatBytes(metadata.size ?? 0)} => ${formatBytes(outputBuffer.length)}`,
	);
	return `data:${mime};base64,${outputBuffer.toString("base64")}`;
};
