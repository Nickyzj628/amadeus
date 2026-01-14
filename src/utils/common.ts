/** 从项目目录中读取 JSON 配置 */
export const loadJSON = async <T>(
	path: string,
	options?: {
		/** 如果文件不存在，则使用提供的数据来创建 */
		createWithDataIfNotExist?: T;
	},
): Promise<T> => {
	const { createWithDataIfNotExist } = options ?? {};

	const fullPath = `${process.cwd()}${path}`;
	const file = Bun.file(fullPath);

	// 如果文件不存在，则根据 createWithDataIfNotExist 决定新建文件
	const isExist = await file.exists();
	if (!isExist) {
		if (!createWithDataIfNotExist) {
			throw new Error(`文件${fullPath}不存在`);
		}
		await Bun.write(fullPath, JSON.stringify(createWithDataIfNotExist));
		return createWithDataIfNotExist;
	}

	return await file.json();
};

/** 将数据保存为 JSON 文件 */
export const saveJSON = async <T>(path: string, data: T): Promise<void> => {
	const fullPath = `${process.cwd()}${path}`;
	await Bun.write(fullPath, JSON.stringify(data));
};
