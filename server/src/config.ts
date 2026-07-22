import dotenv from "dotenv";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { getLanIps } from "./utils/network";

// 无论从项目根目录还是 server 目录启动，均读取项目根目录的 .env。
const projectRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(projectRoot, ".env") });

const environmentSchema = z.enum(["development", "test", "production"]).default("development");
const nodeEnv = environmentSchema.parse(process.env.NODE_ENV);
const isProduction = nodeEnv === "production";
const parseBytes = (value: string | undefined, fallbackMb: number) => {
  const parsed = Number(value || fallbackMb);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 200) throw new Error("上传大小环境变量必须是 0 到 200 之间的数字。");
  return Math.floor(parsed * 1024 * 1024);
};
const parseOrigins = (value: string | undefined) => (value || "").split(",").map((item) => item.trim()).filter(Boolean);
// 即使旧环境变量仍为 5MB，也将商品图片的最低可上传上限提升为 20MB；管理员可设置更高值（最多 200MB）。
const imageUploadMaxBytes = Math.max(parseBytes(process.env.UPLOAD_MAX_MB, 20), 20 * 1024 * 1024);

const port = Number(process.env.PORT || 3001);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("PORT 必须是 1 到 65535 之间的端口号。");

const jwtSecret = process.env.JWT_SECRET || "";
if (jwtSecret.length < 32) throw new Error("JWT_SECRET 未设置或长度不足 32 位，请检查环境变量。");

const databaseUrl = process.env.DATABASE_URL || "";
if (isProduction && !databaseUrl.startsWith("postgresql://")) {
  throw new Error("生产环境必须提供以 postgresql:// 开头的 DATABASE_URL。");
}

// Render 在运行期注入当前服务的真实 HTTPS 地址。服务名发生后缀变化时，
// 不能只依赖手工填写的 FRONTEND_URL，否则会导致同源前端请求被 CORS 拒绝。
const renderExternalUrl = (process.env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, "");
const frontendUrl = process.env.FRONTEND_URL || renderExternalUrl || (isProduction ? "" : "http://localhost:5173");
if (isProduction && !frontendUrl.startsWith("https://")) {
  throw new Error("生产环境必须设置 HTTPS FRONTEND_URL。");
}
if (renderExternalUrl && !renderExternalUrl.startsWith("https://")) {
  throw new Error("RENDER_EXTERNAL_URL 必须为 HTTPS 公网地址。");
}

const r2 = {
  endpoint: process.env.R2_ENDPOINT || "",
  bucket: process.env.R2_BUCKET || "",
  accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  publicUrl: (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "")
};
const r2Configured = Object.values(r2).every(Boolean);
if (r2Configured && !r2.publicUrl.startsWith("https://")) {
  throw new Error("R2_PUBLIC_URL 必须为 HTTPS 公网地址。");
}

// Cloudinary 免费计划可作为没有 R2 账单账户时的持久化图片存储替代方案。
// API Secret 仅保存在服务端环境变量，绝不下发到浏览器。
const cloudinary = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  apiKey: process.env.CLOUDINARY_API_KEY || "",
  apiSecret: process.env.CLOUDINARY_API_SECRET || ""
};
const cloudinaryConfigured = Object.values(cloudinary).every(Boolean);
const imageStorageProvider = r2Configured ? "r2" : cloudinaryConfigured ? "cloudinary" : "local";
if (isProduction && imageStorageProvider === "local") {
  throw new Error("生产环境必须完整设置 R2_* 或 CLOUDINARY_CLOUD_NAME、CLOUDINARY_API_KEY、CLOUDINARY_API_SECRET 之一，不能把商品图片保存到临时磁盘。");
}

const lanIps = getLanIps();
const localOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  ...lanIps.flatMap((ip) => ["http://" + ip + ":5173", "http://" + ip + ":4173"])
];
const configuredOrigins = parseOrigins(process.env.ALLOWED_ORIGINS);
const allowedOrigins = new Set(isProduction
  ? [frontendUrl, renderExternalUrl, ...configuredOrigins].filter(Boolean)
  : [frontendUrl, ...localOrigins, ...configuredOrigins]);

export const config = {
  projectRoot,
  nodeEnv,
  isProduction,
  serveStatic: isProduction || process.env.SERVE_STATIC === "true",
  port,
  host: process.env.HOST || "0.0.0.0",
  databaseUrl,
  frontendUrl,
  renderExternalUrl,
  apiBaseUrl: process.env.API_BASE_URL || (isProduction ? frontendUrl : "http://localhost:3001"),
  allowedOrigins,
  lanIps,
  jwtSecret,
  jwtIssuer: "store-product-management-system",
  jwtAudience: "store-product-management-client",
  authCookieName: "store_session",
  authCookieMaxAgeMs: 8 * 60 * 60 * 1000,
  // 图片先写入临时磁盘并流式上传到对象存储，不会把完整大图保留在 Node 内存中。
  uploadMaxBytes: imageUploadMaxBytes,
  importMaxBytes: parseBytes(process.env.IMPORT_MAX_MB, 10),
  backupMaxBytes: parseBytes(process.env.BACKUP_MAX_MB, 50),
  uploadsDir: path.join(projectRoot, "uploads"),
  imageTempDir: path.join(os.tmpdir(), "store-product-image-upload"),
  databaseFile: path.join(projectRoot, "prisma", "store.db"),
  backupsDir: path.join(projectRoot, "data", "backups"),
  r2,
  r2Configured,
  cloudinary,
  cloudinaryConfigured,
  imageStorageProvider
};
