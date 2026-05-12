import { readFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const WEBDAV_BASE = "https://nickyzj.run:2020/Amadeus";

const EXT_MIME_PAIRS: [string, string][] = [
	["png", "image/png"],
	["jpg", "image/jpeg"],
	["jpeg", "image/jpeg"],
	["gif", "image/gif"],
	["webp", "image/webp"],
	["mp4", "video/mp4"],
	["webm", "video/webm"],
	["mov", "video/quicktime"],
	["mkv", "video/x-matroska"],
	["avi", "video/x-msvideo"],
];
const extToMime = Object.fromEntries(EXT_MIME_PAIRS);
const mimeToExt = Object.fromEntries(
	EXT_MIME_PAIRS.map(([ext, mime]) => [mime, ext]),
);

/**
 * 检查 WebDAV 上是否已存在同名文件
 * @returns 文件存在时返回文件 URL，否则返回 false
 * @remarks 可能抛出异常（网络错误等）
 */
export const checkSameFileName = async (filename: string) => {
	const url = `${WEBDAV_BASE}/${filename}`;
	const response = await fetch(url, { method: "HEAD" });

	if (response.ok) {
		return url;
	}
	return false;
};

/**
 * 上传文件到 WebDAV
 * @returns 文件上传后的 WebDAV URL
 * @remarks 可能抛出异常
 */
export const uploadToWebdav = async (
	fileUrl: string,
	options?: {
		/** 指定文件名，默认根据 content-type 自动生成 */
		filename?: string;
	},
) => {
	const { filename } = options ?? {};

	let buffer: ArrayBuffer;
	let contentType: string;
	let localPath: string | undefined;

	if (fileUrl.startsWith("file://")) {
		localPath = fileURLToPath(fileUrl);
		const fileBuffer = await readFile(localPath);
		buffer = fileBuffer.buffer.slice(
			fileBuffer.byteOffset,
			fileBuffer.byteOffset + fileBuffer.byteLength,
		);

		const ext = localPath.split(".").pop()?.toLowerCase() || "bin";
		contentType = extToMime[ext] || "application/octet-stream";
	} else {
		const response = await fetch(fileUrl);
		buffer = await response.arrayBuffer();
		contentType =
			response.headers.get("content-type") || "application/octet-stream";
	}

	const ext = mimeToExt[contentType] || "bin";
	const finalFilename = filename || `${Date.now()}.${ext}`;

	await fetch(`${WEBDAV_BASE}/${finalFilename}`, {
		method: "PUT",
		body: buffer,
		headers: {
			"Content-Type": contentType,
		},
	});

	if (localPath) {
		await unlink(localPath);
	}

	return `${WEBDAV_BASE}/${finalFilename}`;
};
