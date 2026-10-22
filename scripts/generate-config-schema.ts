import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { toJsonSchema } from "@valibot/to-json-schema";
import { ConfigSchema } from "../src/config-schema.js";

// schema只给分发包用，开发时根目录不需要，直接丢dist
const OUTPUT_PATH = resolve("dist/config.schema.json");
const DIST_CONFIG_PATH = resolve("dist/config.json");

const jsonSchema = {
	...toJsonSchema(ConfigSchema),
	title: "amadeus配置",
	description: "QQ群聊机器人amadeus的配置文件",
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(jsonSchema, null, "\t")}\n`);

// 顺手让dist里的配置指向同目录schema，分发出去才有编辑器提示
if (existsSync(DIST_CONFIG_PATH)) {
	const config = JSON.parse(readFileSync(DIST_CONFIG_PATH, "utf-8"));
	config.$schema = "./config.schema.json";
	writeFileSync(DIST_CONFIG_PATH, `${JSON.stringify(config, null, "\t")}\n`);
}

console.log("dist/config.schema.json已生成");
