import dotenv from "dotenv";
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

const port = Number(process.env.PORT || 3001);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("PORT 必须是 1 到 65535 之间的端口号。");

const jwtSecret = process.env.JWT_SECRET || "";
if (jwtSecret.length < 32) throw new Error("JWT_SECRET 未设置或长度不足 32 位，请检查环境变量。");

const databaseUrl = process.env.DATABASE_URL || "";
if (isProduction && !databaseUrl.startsWith("postgresql://")) {
  throw new Error("生产环境必须提供以 postgresql:// 开头的 DATABASE_URL。");
}

const frontendUrl = process.env.FRONTEND_URL || (isProduction ? "" : "http://localhost:5173");
if (isProduction && !frontendUrl.startsWith("https://")) {
  throw new Error("生产环境必须设置 HTTPS FRONTEND_URL。");
}

const r2 = {
  endpoint: process.env.R2_ENDPOINT || "",
  bucket: process.env.R2_BUCKET || "",
  accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  publicUrl: (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "")
};
const r2Configured = Object.values(r2).every(Boolean);
if (isProduction && !r2Configured) {
  throw new Error("生产环境必须完整设置 R2_ENDPOINT、R2_BUCKET、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY 和 R2_PUBLIC_URL。");
}
if (r2Configured && !r2.publicUrl.startsWith("https://")) {
  throw new Error("R2_PUBLIC_URL 必须为 HTTPS 公网地址。");
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
  ? [frontendUrl, ...configuredOrigins]
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
  apiBaseUrl: process.env.API_BASE_URL || (isProduction ? frontendUrl : "http://localhost:3001"),
  allowedOrigins,
  lanIps,
  jwtSecret,
  jwtIssuer: "store-product-management-system",
  jwtAudience: "store-product-management-client",
  authCookieName: "store_session",
  authCookieMaxAgeMs: 8 * 60 * 60 * 1000,
  uploadMaxBytes: parseBytes(process.env.UPLOAD_MAX_MB, 5),
  importMaxBytes: parseBytes(process.env.IMPORT_MAX_MB, 10),
  backupMaxBytes: parseBytes(process.env.BACKUP_MAX_MB, 50),
  uploadsDir: path.join(projectRoot, "uploads"),
  databaseFile: path.join(projectRoot, "prisma", "store.db"),
  backupsDir: path.join(projectRoot, "data", "backups"),
  r2,
  r2Configured
};
