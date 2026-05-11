import { access, constants, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { to } from "@nickyzj2023/utils";
import sharp from "sharp";

/** 从项目目录中读取 JSON 配置 */
export const loadJSON = async <T>(
	path: string,
	options?: {
		/** 如果文件不存在，则使用提供的数据来创建 */
		createWithDataIfNotExist?: T;
	},
) => {
	const { createWithDataIfNotExist } = options ?? {};

	const fullPath = `${process.cwd()}${path}`;

	// 如果文件不存在，则使用 createWithDataIfNotExist 新建文件
	try {
		await access(fullPath, constants.F_OK);
		const content = await readFile(fullPath, "utf-8");
		return JSON.parse(content) as T;
	} catch {
		if (!createWithDataIfNotExist) {
			throw new Error(`文件${fullPath}不存在`);
		}
		await writeFile(
			fullPath,
			JSON.stringify(createWithDataIfNotExist),
			"utf-8",
		);
		return createWithDataIfNotExist;
	}
};

/** 将数据保存为 JSON 文件 */
export const saveJSON = async <T>(path: string, data: T) => {
	const fullPath = `${process.cwd()}${path}`;
	await writeFile(fullPath, JSON.stringify(data, null, 2), "utf-8");
};

/** 格式化数字为紧凑格式，例如 1000 显示为 1k */
export const formatNumberCompact = (num: number) => {
	return new Intl.NumberFormat("zh-CN", {
		notation: "compact",
		compactDisplay: "short",
	}).format(num);
};

/**
 * 移除文本中的不自然内容：
 * - 思考标签
 */
export const normalizeText = (text: string) => {
	return (
		text
			// 移除可能残留的思考标签及其内容
			.replace(/<think>[\s\S]*?<\/think>/gi, "")
			.replace(/<thought>[\s\S]*?<\/thought>/gi, "")
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
 * 使用 sharp 压缩图片
 * @param input 网络地址，或任何 sharp 支持的类型
 * @param options 压缩参数，默认压到 720P、10MB 以内
 * @returns
 */
export const compressImage = async (
	input: string | Buffer | ArrayBuffer,
	options?: {
		/**
		 * 压到指定大小以内，默认 10MB
		 * @default 10 * 1024 * 1024
		 */
		maxSize?: number;
		/**
		 * 压到指定高度以内，默认 720px
		 * @default 720
		 */
		maxHeight?: number;
	},
): Promise<string | null> => {
	const { maxSize = 10 * 1024 * 1024, maxHeight = 720 } = options ?? {};
	const qualities = [90, 80, 70, 60, 50];

	/**
	 * 转换 input 为 buffer
	 */

	let buffer: Buffer;

	if (typeof input === "string") {
		// 如果是网络地址，则下载
		if (/^https?:\/\//.test(input)) {
			const [error, response] = await to(fetch(input));
			if (error) {
				return null;
			}
			buffer = Buffer.from(await response.arrayBuffer());
		}
		// 如果是本地文件，则读取
		else if (input.startsWith("file://")) {
			buffer = await readFile(fileURLToPath(input));
		}
		// TODO: 补充更多字符串格式判断
		else {
			buffer = await readFile(input);
		}
	}
	// 如果是 ArrayBuffer，则转成 sharp 支持的 Buffer 类型
	else if (input instanceof ArrayBuffer) {
		buffer = Buffer.from(input);
	}
	// 如果是 sharp 支持的类型，则直接赋值
	else {
		buffer = input;
	}

	/**
	 * 压制 buffer
	 */

	let image = sharp(buffer);

	const metadata = await image.metadata();
	if (metadata.height > maxHeight) {
		image = image.resize({
			height: maxHeight,
			fit: "inside",
			withoutEnlargement: true,
		});
	}

	let outputBuffer = await image.jpeg({ quality: qualities[0] }).toBuffer();
	for (const quality of qualities.slice(1)) {
		if (outputBuffer.length <= maxSize) {
			break;
		}
		outputBuffer = await image.jpeg({ quality }).toBuffer();
	}

	const tempPath = join(tmpdir(), `amadeus-${Date.now()}.jpg`);
	await writeFile(tempPath, outputBuffer);
	return `file://${tempPath}`;
};
