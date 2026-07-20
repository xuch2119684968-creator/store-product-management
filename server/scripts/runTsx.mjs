import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
// 维护脚本需同时支持本机根目录 .env 与云平台注入的环境变量。
dotenv.config({ path: path.resolve(scriptDir, "../../.env"), override: false });

const tsxCli = path.resolve(scriptDir, "../node_modules/tsx/dist/cli.mjs");
const result = spawnSync(process.execPath, [tsxCli, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env
});

process.exit(result.status ?? 1);
