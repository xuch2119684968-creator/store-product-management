import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import { config } from "./config";
import { prisma } from "./lib/prisma";
import { apiRateLimiter } from "./middleware/security";
import authRoutes from "./routes/auth";
import backupRoutes from "./routes/backup";
import categoryRoutes from "./routes/categories";
import dashboardRoutes from "./routes/dashboard";
import importExportRoutes from "./routes/importExport";
import inventoryRoutes from "./routes/inventory";
import labelRoutes from "./routes/labels";
import productRoutes from "./routes/products";
import settingsRoutes from "./routes/settings";
import supplierRoutes from "./routes/suppliers";
import uploadRoutes from "./routes/uploads";

if (!config.isProduction) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.mkdirSync(config.backupsDir, { recursive: true });
}

const app = express();
app.disable("x-powered-by");
// Render 等平台通过受信任的第一层反向代理转发 HTTPS 和客户端 IP。
app.set("trust proxy", config.isProduction ? 1 : false);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: config.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
  referrerPolicy: { policy: "no-referrer" }
}));
app.use(cors({
  origin(origin, callback) {
    // 健康检查、Render 代理和服务器到服务器调用无 Origin，不属于浏览器跨域请求。
    if (!origin) return callback(null, true);
    if (config.allowedOrigins.has(origin)) return callback(null, true);
    const error = Object.assign(new Error("当前访问来源未被服务器允许。"), { code: "CORS_ORIGIN_DENIED" });
    return callback(error);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "X-Confirm-Restore"],
  maxAge: 600
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    // 只记录方法、路径、状态与耗时；绝不记录密码、Cookie、Token、请求体或查询字符串。
    console.log(JSON.stringify({ type: "request", method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - startedAt, ip: req.ip }));
  });
  next();
});

if (!config.isProduction) app.use("/uploads", express.static(config.uploadsDir, { fallthrough: false, maxAge: "7d" }));

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "ok", time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});
app.use("/api", apiRateLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/import-export", importExportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/labels", labelRoutes);

const clientDist = path.join(config.projectRoot, "client", "dist");
if (config.serveStatic && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    return res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((_req, res) => res.status(404).json({ message: "接口不存在。" }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) return res.status(400).json({ message: error.issues[0]?.message || "提交的数据格式不正确。" });
  if (error instanceof Error && /仅支持|图片内容|导入文件最多|备份文件/.test(error.message)) return res.status(400).json({ message: error.message });
  if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "CORS_ORIGIN_DENIED") {
    return res.status(403).json({ message: "当前访问来源未被服务器允许。" });
  }
  if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "上传文件超过系统允许的大小限制。" });
  }
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") return res.status(409).json({ message: "商品编号、条形码或名称已存在，请检查后重试。" });
    if (code === "P2025") return res.status(404).json({ message: "要操作的数据不存在或已被删除。" });
  }
  if (!config.isProduction) console.error("服务器未处理错误：", error);
  return res.status(500).json({ message: "服务器发生错误，请稍后重试。" });
});

app.listen(config.port, config.host, () => {
  console.log("商品管理服务已启动，监听 " + config.host + ":" + config.port);
  if (!config.isProduction) config.lanIps.forEach((ip) => console.log("局域网开发地址：http://" + ip + ":" + config.port));
});
