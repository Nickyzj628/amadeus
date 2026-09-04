import { access, constants, readFile, writeFile } from "node:fs/promises";

/** 将数据保存为本地 JSON 文件 */
export const saveJSON = async <T>(path: string, data: T) => {
	const fullPath = `${process.cwd()}${path}`;
	await writeFile(fullPath, JSON.stringify(data, null, 2), "utf-8");
};

/** 从项目目录中读取 JSON 配置 */
export const loadJSON = async <T>(path: string) => {
	const fullPath = `${process.cwd()}${path}`;
	try {
		await access(fullPath, constants.F_OK);
		const content = await readFile(fullPath, "utf-8");
		return JSON.parse(content) as T;
	} catch {
		// 如果文件不存在，则返回null，而非报错
		return null;
	}
};
