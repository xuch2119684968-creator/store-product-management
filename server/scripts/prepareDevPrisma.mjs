/**
 * 根据 DATABASE_URL 为本地开发生成正确的 Prisma Client。
 * file: 使用历史 SQLite 数据库；postgresql: 使用正式 PostgreSQL 模型。
 * 不会创建、删除或初始化数据库。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(scriptDirectory, "..");
const projectRoot = path.resolve(serverDirectory, "..");
dotenv.config({ path: path.join(projectRoot, ".env") });

const databaseUrl = process.env.DATABASE_URL || "";
const useSqlite = databaseUrl.startsWith("file:");
const schemaPath = path.join(projectRoot, "prisma", useSqlite ? "schema.sqlite.prisma" : "schema.prisma");
const prismaCommand = path.join(serverDirectory, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
const generated = spawnSync(prismaCommand, ["generate", "--schema", schemaPath], {
  cwd: serverDirectory,
  env: process.env,
  stdio: "inherit"
});
if (generated.status !== 0) process.exit(generated.status || 1);

if (!useSqlite) process.exit(0);

const databaseReference = databaseUrl.slice("file:".length);
const databasePath = path.isAbsolute(databaseReference)
  ? databaseReference
  : path.resolve(projectRoot, "prisma", databaseReference);
if (!fs.existsSync(databasePath)) {
  throw new Error("未找到本地 SQLite 数据库，已停止启动以避免意外创建新数据库。");
}

const database = new DatabaseSync(databasePath);
try {
  const columns = database.prepare("PRAGMA table_info('User')").all();
  if (!columns.some((column) => column.name === "mustChangePassword")) {
    database.exec('ALTER TABLE "User" ADD COLUMN "mustChangePassword" INTEGER NOT NULL DEFAULT 1');
    console.log("已为本地管理员账户添加首次修改密码标记。");
  }
} finally {
  database.close();
}
