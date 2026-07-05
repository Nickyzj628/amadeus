import { readFile, unlink } from "node:fs/promises";
import { checkUrlType } from "./util.js";

export const WEBDAV_BASE = "https://nickyzj.run:2020/Amadeus";
export const WEBDAV_LOCAL_BASE = "E:/Storage/Amadeus";

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
 * @remarks 可能抛出异常
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
 * @param url 本地/网络地址
 * @returns 文件上传后的 WebDAV URL
 * @remarks 可能抛出异常
 */
export const uploadToWebdav = async (
	url: string,
	options?: {
		/** 指定文件名，默认根据 content-type 自动生成 */
		filename?: string;
		/**
		 * 上传后是否删除本地源文件
		 * @default false
		 */
		deleteAfterUpload?: boolean;
	},
) => {
	const urlType = checkUrlType(url);
	if (urlType !== "remote" && urlType !== "local") {
		throw new Error(`不支持的地址：${url}`);
	}

	const { filename, deleteAfterUpload } = options ?? {};

	// 下载
	let buffer: ArrayBuffer;
	let contentType: string;
	const fallbackContentType = "application/octet-stream";
	if (urlType === "remote") {
		const response = await fetch(url);

		buffer = await response.arrayBuffer();

		contentType = response.headers.get("content-type") || fallbackContentType;
	} else {
		const fileBuffer = await readFile(url);

		buffer = fileBuffer.buffer.slice(
			fileBuffer.byteOffset,
			fileBuffer.byteOffset + fileBuffer.byteLength,
		);

		const ext = url.split(".").pop()?.toLowerCase() || "bin";
		contentType = extToMime[ext] || fallbackContentType;
	}

	// 上传
	const ext = mimeToExt[contentType] || "bin";
	const _filename = filename || `${Date.now()}.${ext}`;
	await fetch(`${WEBDAV_BASE}/${_filename}`, {
		method: "PUT",
		body: buffer,
		headers: {
			"Content-Type": contentType,
		},
	});

	// 后处理
	if (deleteAfterUpload && urlType === "local") {
		await unlink(url);
	}

	return `${WEBDAV_BASE}/${_filename}`;
};
