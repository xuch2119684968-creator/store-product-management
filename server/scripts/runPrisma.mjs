import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
// 本地命令从项目根目录读取 .env；Render 等生产环境直接使用平台注入的环境变量。
dotenv.config({ path: path.resolve(scriptDir, "../../.env"), override: false });

const prismaCli = path.resolve(scriptDir, "../node_modules/prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2), "--schema", path.resolve(scriptDir, "../../prisma/schema.prisma")], {
  stdio: "inherit",
  env: process.env
});

process.exit(result.status ?? 1);
