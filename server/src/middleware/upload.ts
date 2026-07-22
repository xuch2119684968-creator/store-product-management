import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { config } from "../config";

const imageTypeByExtension = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);
const importExtensions = new Set([".csv", ".xlsx", ".xls"]);
const importMimeTypes = new Set([
  "text/csv", "application/csv", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"
]);
const backupExtensions = new Set([".json"]);
const backupMimeTypes = new Set(["application/json", "text/json", "application/octet-stream"]);
const imageTempRoot = path.resolve(config.imageTempDir);

fs.mkdirSync(imageTempRoot, { recursive: true, mode: 0o700 });

const imageDiskStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, imageTempRoot),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, crypto.randomUUID() + extension);
  }
});

export const imageUpload = multer({
  // 大图片落到临时磁盘后直接流式写入云端存储，避免 multer.memoryStorage 占满 Node 内存。
  storage: imageDiskStorage,
  limits: { fileSize: config.uploadMaxBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!extension || imageTypeByExtension.get(extension) !== file.mimetype) {
      callback(new Error("仅支持 JPG、JPEG、PNG 和 WebP 格式的商品图片。"));
      return;
    }
    callback(null, true);
  }
});

export const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.importMaxBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!importExtensions.has(extension) || !importMimeTypes.has(file.mimetype)) {
      callback(new Error("仅支持 CSV、XLSX 或 XLS 格式的导入文件。"));
      return;
    }
    callback(null, true);
  }
});

export const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.backupMaxBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!backupExtensions.has(extension) || !backupMimeTypes.has(file.mimetype)) {
      callback(new Error("仅支持系统导出的 .json 云端备份文件。"));
      return;
    }
    callback(null, true);
  }
});

function hasPrefix(buffer: Buffer, prefix: number[]) {
  return prefix.every((value, index) => buffer[index] === value);
}

function validImageContent(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return hasPrefix(buffer, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function isManagedImageTempFile(file: Express.Multer.File) {
  if (!file.path) return false;
  const candidate = path.resolve(file.path);
  return candidate.startsWith(imageTempRoot + path.sep);
}

export async function cleanupUploadedImage(file: Express.Multer.File | undefined) {
  if (!file || !isManagedImageTempFile(file)) return;
  await fs.promises.unlink(file.path).catch(() => undefined);
}

async function readImageHeader(file: Express.Multer.File) {
  const header = Buffer.alloc(12);
  const handle = await fs.promises.open(file.path, "r");
  try {
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return header.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** 仅信任二进制签名，不信任浏览器报送的 MIME 类型。 */
export async function verifyUploadedImage(req: Request, res: Response, next: NextFunction) {
  if (!req.file) return res.status(400).json({ message: "请选择要上传的图片。" });
  try {
    const header = await readImageHeader(req.file);
    if (!validImageContent(header, req.file.mimetype)) {
      await cleanupUploadedImage(req.file);
      return res.status(400).json({ message: "图片内容与文件格式不匹配，已拒绝上传。" });
    }
    return next();
  } catch {
    await cleanupUploadedImage(req.file);
    return res.status(400).json({ message: "图片读取失败，请重新选择后上传。" });
  }
}
