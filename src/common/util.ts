import { access, constants, readFile, writeFile } from "node:fs/promises";
import { logger } from "@nickyzj2023/utils";
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
 * @param input sharp 支持的类型（Buffer、string 文件路径等）
 * @param options 压缩参数
 * @returns base64 Data URL
 * @throws 输入类型不被 sharp 支持时抛出异常
 * @throws 图片无法压缩到 maxSize 和 maxHeight 以内时抛出异常
 */
export const compressImage = async (
	input: NonNullable<Parameters<typeof sharp>[0]>,
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
): Promise<string> => {
	const { maxSize = 10 * 1024 * 1024, maxHeight = 720 } = options ?? {};

	// 网络地址先下载为 Buffer，其余类型直接交给 sharp（sharp 会自行校验）
	const resolved =
		typeof input === "string" && /^https?:\/\//.test(input)
			? Buffer.from(await (await fetch(input)).arrayBuffer())
			: input;

	const metadata = await sharp(resolved).metadata();
	const isAnimated = (metadata.pages ?? 1) > 1;
	let image = sharp(resolved, { animated: isAnimated });

	// 压缩到 maxHeight 以内
	if (metadata.height && metadata.height > maxHeight) {
		image = image.resize({
			height: maxHeight,
			fit: "inside",
			withoutEnlargement: true,
		});
	}

	// 压缩到 maxSize 以内
	let outputBuffer: Buffer | null = null;
	for (let quality = 90; quality >= 40; quality -= 10) {
		outputBuffer = await image.webp({ quality }).toBuffer();
		if (outputBuffer.length <= maxSize) {
			break;
		}
	}
	if (!outputBuffer) {
		throw new Error(`图片无法压缩到 ${formatBytes(maxSize)} 以内`);
	}

	logger(
		`压缩了一张图片：${formatBytes(metadata.size ?? 0)} => ${formatBytes(outputBuffer.length)}`,
	);
	return `data:image/webp;base64,${outputBuffer.toString("base64")}`;
};
