import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config";

const extensionByMime = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

const r2Client = config.r2Configured
  ? new S3Client({
      region: "auto",
      endpoint: config.r2.endpoint,
      credentials: { accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey }
    })
  : null;

function localFilename(mimeType: string) {
  return crypto.randomUUID() + (extensionByMime.get(mimeType) || ".jpg");
}

function objectKey(mimeType: string) {
  const date = new Date();
  return "products/" + date.getUTCFullYear() + "/" + String(date.getUTCMonth() + 1).padStart(2, "0") + "/" + localFilename(mimeType);
}

export async function saveProductImage(file: Express.Multer.File) {
  const key = objectKey(file.mimetype);
  if (r2Client) {
    await r2Client.send(new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000, immutable"
    }));
    return config.r2.publicUrl + "/" + key.split("/").map(encodeURIComponent).join("/");
  }

  // 本地开发保留原有 uploads 行为；生产启动时会强制要求 R2 配置。
  await fs.mkdir(config.uploadsDir, { recursive: true });
  const filename = path.basename(key);
  await fs.writeFile(path.join(config.uploadsDir, filename), file.buffer, { flag: "wx" });
  return "/uploads/" + filename;
}

export async function deleteProductImage(imagePath: string | null | undefined) {
  if (!imagePath) return;
  const publicPrefix = config.r2.publicUrl ? config.r2.publicUrl + "/" : "";
  if (r2Client && publicPrefix && imagePath.startsWith(publicPrefix)) {
    const key = decodeURIComponent(imagePath.slice(publicPrefix.length));
    if (/^[a-zA-Z0-9/_\-.]+$/.test(key)) {
      await r2Client.send(new DeleteObjectCommand({ Bucket: config.r2.bucket, Key: key }));
    }
    return;
  }
  if (imagePath.startsWith("/uploads/")) {
    await fs.unlink(path.join(config.uploadsDir, path.basename(imagePath))).catch(() => undefined);
  }
}
