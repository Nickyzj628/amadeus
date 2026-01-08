/** 从项目目录中读取 JSON 配置 */
export const loadJSON = async <T>(path: string): Promise<T> => {
	const fullPath = `${process.cwd()}${path}`;
	const file = Bun.file(fullPath);
	if (!(await file.exists())) {
		throw new Error(`${fullPath}不存在`);
	}
	return await file.json();
};
