import { isObject } from "@nickyzj2023/utils";
import { access, constants, readFile, writeFile } from "node:fs/promises";

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

/**
 * Creates a new object composed of the properties that do not satisfy the predicate function.
 *
 * This function takes an object and a predicate function, and returns a new object that
 * includes only the properties for which the predicate function returns false.
 *
 * @template T - The type of object.
 * @param {T} obj - The object to omit properties from.
 * @param {(value: T[string], key: keyof T) => boolean} shouldOmit - A predicate function that determines
 * whether a property should be omitted. It takes the property's key and value as arguments and returns `true`
 * if the property should be omitted, and `false` otherwise.
 * @returns {Partial<T>} A new object with the properties that do not satisfy the predicate function.
 *
 * @example
 * const obj = { a: 1, b: 'omit', c: 3 };
 * const shouldOmit = (value) => typeof value === 'string';
 * const result = omitBy(obj, shouldOmit);
 * // result will be { a: 1, c: 3 }
 */
export function omitBy<T extends Record<string, any>>(
  obj: T,
  shouldOmit: (value: T[keyof T], key: keyof T) => boolean,
): Partial<T> {
  const result: Partial<T> = {};

  for (const key in obj) {
    const value = obj[key];

    if (!shouldOmit(value, key)) {
      result[key] = value;
    }
  }

  return result;
}

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
