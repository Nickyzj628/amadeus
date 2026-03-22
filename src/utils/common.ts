import { access, constants, readFile, writeFile } from "node:fs/promises";

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

  // 如果文件不存在，则根据 createWithDataIfNotExist 决定新建文件
  try {
    await access(fullPath, constants.F_OK);
  } catch {
    if (!createWithDataIfNotExist) {
      throw new Error(`文件${fullPath}不存在`);
    }
    await writeFile(fullPath, JSON.stringify(createWithDataIfNotExist), "utf-8");
    return createWithDataIfNotExist;
  }

  const content = await readFile(fullPath, "utf-8");
  return JSON.parse(content) as T;
};

/** 将数据保存为 JSON 文件 */
export const saveJSON = async <T>(path: string, data: T): Promise<void> => {
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
