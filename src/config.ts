import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { safeParse } from "valibot";
import { formatIssues } from "@/common/schemas/index.js";
import { type Config, ConfigSchema } from "./config-schema.js";

// 配置跟构建产物放一起，run.bat在仓库根启动，所以固定从dist里拿
const CONFIG_PATH = resolve("dist/config.json");

const loadConfig = (): Config => {
	// 读不到文件基本就是忘了把模板改名
	let raw: string;
	try {
		raw = readFileSync(CONFIG_PATH, "utf-8");
	} catch {
		throw new Error(
			`找不到${CONFIG_PATH}，请把dist/config.example.json改名为config.json再填写`,
		);
	}

	// json本身写坏了单独提示，不然栈里看不出是哪个文件的问题
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch (error) {
		throw new Error(`config.json不是合法的JSON：${(error as Error).message}`);
	}

	const validation = safeParse(ConfigSchema, json);
	if (!validation.success) {
		throw new Error(
			`config.json配置有误：\n${formatIssues(validation.issues)}`,
		);
	}

	return validation.output;
};

const config = loadConfig();
export default config;
