import { execSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

// dist会被清空，先把用户配置挪出来，构建完再塞回去
const CONFIG_PATH = resolve("dist/config.json");
const BACKUP_PATH = resolve(".config.json.bak");

// 上次构建如果中途挂了，旧备份先清掉，别拿它覆盖新配置
if (existsSync(BACKUP_PATH)) {
	rmSync(BACKUP_PATH);
}

const hasConfig = existsSync(CONFIG_PATH);
if (hasConfig) {
	copyFileSync(CONFIG_PATH, BACKUP_PATH);
}

try {
	execSync("tsdown", { stdio: "inherit" });
} finally {
	// 构建失败也得把配置放回去，不然下次启动就找不到文件了
	if (hasConfig && existsSync(BACKUP_PATH)) {
		copyFileSync(BACKUP_PATH, CONFIG_PATH);
		rmSync(BACKUP_PATH);
	}
}

// schema最后生成，免得被tsdown的clean冲掉
execSync("tsx scripts/generate-config-schema.ts", { stdio: "inherit" });
