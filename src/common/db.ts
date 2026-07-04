import { access, constants, readFile, writeFile } from "node:fs/promises";

/** 将数据保存为本地 JSON 文件 */
export const saveJSON = async <T>(path: string, data: T) => {
	const fullPath = `${process.cwd()}${path}`;
	await writeFile(fullPath, JSON.stringify(data, null, 2), "utf-8");
};

/** 从项目目录中读取 JSON 配置 */
export const loadJSON = async <T>(
	path: string,
	options?: {
		/** 如果文件不存在，则使用提供的数据来创建 */
		fallbackData?: T;
	},
) => {
	const { fallbackData } = options ?? {};
	const fullPath = `${process.cwd()}${path}`;

	try {
		await access(fullPath, constants.F_OK);
		const content = await readFile(fullPath, "utf-8");
		return JSON.parse(content) satisfies T;
	} catch {
		if (!fallbackData) {
			throw new Error(`文件${fullPath}不存在`);
		}
		// 如果文件不存在，则使用 fallbackData 新建文件
		await saveJSON(path, fallbackData);
		return fallbackData;
	}
};
