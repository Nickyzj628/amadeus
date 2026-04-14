import { access, constants, readFile, writeFile } from "node:fs/promises";
import { isObject } from "@nickyzj2023/utils";

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
			// 移除孤立的闭合思考标签
			.replace(/<\/think>/gi, "")
	);
};

/** 从任意异常中提取类似 error.message 的可读文字 */
export const extractErrorMessage = (error: unknown): string => {
	// 如果是原生异常，则返回 message 字段
	if (error instanceof Error) {
		return error.message;
	}

	// 如果已经是字符串了，则直接返回
	if (typeof error === "string") {
		return error;
	}

	// 如果是自定义对象，则尝试提取可能的报错字段
	if (isObject(error)) {
		const directMessage = error.message || error.msg;
		if (directMessage) {
			return directMessage;
		}
		// 遍历对象的所有字段，找出可能的报错字段
		for (const value of Object.values(error)) {
			const message = extractErrorMessage(value);
			if (message) {
				return message;
			}
		}
	}

	// 兜底情况，将异常转换为字符串返回
	return JSON.stringify(error, null, 2);
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
