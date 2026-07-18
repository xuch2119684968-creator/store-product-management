import fs from "node:fs/promises";
import path from "node:path";
import { readSqliteSnapshot, snapshotSummary } from "./sqliteSnapshot";

async function main() {
  const snapshot = readSqliteSnapshot();
  const root = path.resolve(process.cwd(), "..");
  const exportsDir = path.join(root, "data", "exports");
  await fs.mkdir(exportsDir, { recursive: true });
  const filename = "sqlite-export-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
  await fs.writeFile(path.join(exportsDir, filename), JSON.stringify({ format: "store-sqlite-export", version: 1, createdAt: new Date().toISOString(), data: snapshot }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ file: path.join("data", "exports", filename), ...snapshotSummary(snapshot) }, null, 2));
}

main().catch((error) => { console.error("SQLite 导出失败：", error instanceof Error ? error.message : error); process.exit(1); });
