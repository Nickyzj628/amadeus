import type { BaseIssue } from "valibot";

/** 把valibot的校验错误摊平成多行文本，一行一个字段，方便直接照着改 */
export const formatIssues = (issues: readonly BaseIssue<unknown>[]): string =>
	issues
		.map((issue) => {
			// path是嵌套字段路径，而根对象没有path，给个兜底文案
			const path =
				issue.path?.map((item) => String(item.key)).join(".") || "根对象";
			return `- ${path}：${issue.message}`;
		})
		.join("\n");
