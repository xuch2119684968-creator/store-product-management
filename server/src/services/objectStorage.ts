import crypto from "node:crypto";
import { constants, createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v2 as cloudinary } from "cloudinary";
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

if (config.cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true
  });
}

function localFilename(mimeType: string) {
  return crypto.randomUUID() + (extensionByMime.get(mimeType) || ".jpg");
}

function objectKey(mimeType: string) {
  const date = new Date();
  return "products/" + date.getUTCFullYear() + "/" + String(date.getUTCMonth() + 1).padStart(2, "0") + "/" + localFilename(mimeType);
}

function cloudinaryPublicId() {
  const date = new Date();
  return "products/" + date.getUTCFullYear() + "/" + String(date.getUTCMonth() + 1).padStart(2, "0") + "/" + crypto.randomUUID();
}

function cloudinaryIdFromUrl(imagePath: string) {
  try {
    const url = new URL(imagePath);
    if (url.hostname !== "res.cloudinary.com") return null;
    const prefix = "/" + config.cloudinary.cloudName + "/image/upload/";
    if (!url.pathname.startsWith(prefix)) return null;
    const objectPath = decodeURIComponent(url.pathname.slice(prefix.length)).replace(/^v\d+\//, "");
    const publicId = objectPath.replace(/\.[a-z0-9]+$/i, "");
    return /^products\/\d{4}\/\d{2}\/[a-f0-9-]{36}$/i.test(publicId) ? publicId : null;
  } catch {
    return null;
  }
}

async function uploadToCloudinary(file: Express.Multer.File) {
  const publicId = cloudinaryPublicId();
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
        invalidate: true,
        use_filename: false,
        unique_filename: false
      },
      (error, result) => {
        if (error || !result?.secure_url) return reject(error || new Error("图片存储服务未返回有效地址。"));
        resolve(result.secure_url);
      }
    );
    if (file.path) {
      const source = createReadStream(file.path);
      source.once("error", reject);
      source.pipe(stream);
      return;
    }
    stream.end(file.buffer);
  });
}

export async function saveProductImage(file: Express.Multer.File) {
  const key = objectKey(file.mimetype);
  if (r2Client) {
    await r2Client.send(new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
      Body: file.path ? createReadStream(file.path) : file.buffer,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000, immutable"
    }));
    return config.r2.publicUrl + "/" + key.split("/").map(encodeURIComponent).join("/");
  }

  if (config.imageStorageProvider === "cloudinary") return uploadToCloudinary(file);

  // 本地开发保留原有 uploads 行为；生产启动时会强制要求配置持久化图片存储。
  await fs.mkdir(config.uploadsDir, { recursive: true });
  const filename = path.basename(key);
  const destination = path.join(config.uploadsDir, filename);
  if (file.path) await fs.copyFile(file.path, destination, constants.COPYFILE_EXCL);
  else await fs.writeFile(destination, file.buffer, { flag: "wx" });
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
  if (config.imageStorageProvider === "cloudinary") {
    const publicId = cloudinaryIdFromUrl(imagePath);
    if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
    return;
  }
  if (imagePath.startsWith("/uploads/")) {
    await fs.unlink(path.join(config.uploadsDir, path.basename(imagePath))).catch(() => undefined);
  }
}
