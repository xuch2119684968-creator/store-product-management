import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type LegacySnapshot = {
  users: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  suppliers: Record<string, unknown>[];
  products: Record<string, unknown>[];
  inventoryRecords: Record<string, unknown>[];
  systemSettings: Record<string, unknown>[];
};

const tables: Record<keyof LegacySnapshot, string> = {
  users: '"User"',
  categories: '"Category"',
  suppliers: '"Supplier"',
  products: '"Product"',
  inventoryRecords: '"InventoryRecord"',
  systemSettings: '"SystemSetting"'
};

export function defaultSqlitePath() {
  return path.resolve(process.cwd(), "../prisma/store.db");
}

export function readSqliteSnapshot(databaseFile = process.env.LOCAL_SQLITE_PATH || defaultSqlitePath()): LegacySnapshot {
  if (!fs.existsSync(databaseFile)) throw new Error("未找到本地 SQLite 数据库：" + databaseFile);
  const snapshot = {} as LegacySnapshot;
  for (const [key, table] of Object.entries(tables) as [keyof LegacySnapshot, string][]) {
    const result = execFileSync("sqlite3", ["-json", databaseFile, "SELECT * FROM " + table + ";"], { encoding: "utf8" });
    snapshot[key] = JSON.parse(result || "[]") as Record<string, unknown>[];
  }
  return snapshot;
}

export function snapshotSummary(snapshot: LegacySnapshot) {
  return {
    users: snapshot.users.length,
    categories: snapshot.categories.length,
    suppliers: snapshot.suppliers.length,
    products: snapshot.products.length,
    inventoryRecords: snapshot.inventoryRecords.length,
    systemSettings: snapshot.systemSettings.length,
    totalStock: snapshot.products.reduce((sum, item) => sum + Number(item.stock || 0), 0)
  };
}
