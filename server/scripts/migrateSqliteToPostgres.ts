import fs from "node:fs/promises";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { readSqliteSnapshot, snapshotSummary } from "./sqliteSnapshot";

const prisma = new PrismaClient();
const string = (value: unknown) => String(value ?? "");
const nullable = (value: unknown) => value === null || value === undefined || value === "" ? null : String(value);
const date = (value: unknown) => new Date(String(value));
const bool = (value: unknown) => value === true || value === 1 || value === "1";

async function main() {
  const snapshot = readSqliteSnapshot();
  const localSummary = snapshotSummary(snapshot);
  if (!snapshot.users.length || !snapshot.categories.length) throw new Error("SQLite 数据不完整：必须至少包含管理员和商品分类。");
  const current = await Promise.all([prisma.user.count(), prisma.category.count(), prisma.product.count(), prisma.inventoryRecord.count()]);
  if (current.some(Boolean) && process.env.MIGRATION_ALLOW_NON_EMPTY !== "true") {
    throw new Error("目标 PostgreSQL 不是空库。请新建空数据库，或人工确认后设置 MIGRATION_ALLOW_NON_EMPTY=true。");
  }

  const root = path.resolve(process.cwd(), "..");
  const backupDir = path.join(root, "data", "backups", "pre-postgres-migration");
  await fs.mkdir(backupDir, { recursive: true });
  await fs.copyFile(process.env.LOCAL_SQLITE_PATH || path.join(root, "prisma", "store.db"), path.join(backupDir, "store-" + new Date().toISOString().replace(/[:.]/g, "-") + ".db"));

  await prisma.$transaction(async (tx) => {
    if (process.env.MIGRATION_ALLOW_NON_EMPTY === "true") {
      await tx.inventoryRecord.deleteMany(); await tx.product.deleteMany(); await tx.category.deleteMany(); await tx.supplier.deleteMany(); await tx.systemSetting.deleteMany(); await tx.user.deleteMany();
    }
    await tx.user.createMany({ data: snapshot.users.map((item) => ({ id: string(item.id), username: string(item.username), passwordHash: string(item.passwordHash), mustChangePassword: bool(item.mustChangePassword) || string(item.username) === "admin", createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) })) });
    await tx.category.createMany({ data: snapshot.categories.map((item) => ({ id: string(item.id), name: string(item.name), icon: string(item.icon || "Tag"), remark: string(item.remark), sortOrder: Number(item.sortOrder || 0), createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) })) });
    await tx.supplier.createMany({ data: snapshot.suppliers.map((item) => ({ id: string(item.id), name: string(item.name), contact: string(item.contact), phone: string(item.phone), address: string(item.address), remark: string(item.remark), createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) })) });
    await tx.product.createMany({ data: snapshot.products.map((item) => ({ id: string(item.id), code: string(item.code), barcode: nullable(item.barcode), name: string(item.name), categoryId: string(item.categoryId), imagePath: nullable(item.imagePath), specification: string(item.specification), color: string(item.color), size: string(item.size), purchasePrice: new Prisma.Decimal(String(item.purchasePrice ?? 0)), retailPrice: new Prisma.Decimal(String(item.retailPrice ?? 0)), memberPrice: new Prisma.Decimal(String(item.memberPrice ?? 0)), stock: Number(item.stock || 0), lowStock: Number(item.lowStock || 0), supplierId: nullable(item.supplierId), location: string(item.location), remark: string(item.remark), status: string(item.status) === "OFF_SALE" ? "OFF_SALE" : "ON_SALE", createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) })) });
    await tx.inventoryRecord.createMany({ data: snapshot.inventoryRecords.map((item) => ({ id: string(item.id), productId: string(item.productId), operation: string(item.operation) as "INBOUND" | "OUTBOUND" | "ADJUSTMENT" | "STOCKTAKE" | "IMPORT", changeQuantity: Number(item.changeQuantity || 0), beforeStock: Number(item.beforeStock || 0), afterStock: Number(item.afterStock || 0), operatorId: nullable(item.operatorId), remark: string(item.remark), createdAt: date(item.createdAt) })) });
    await tx.systemSetting.createMany({ data: snapshot.systemSettings.map((item) => ({ id: string(item.id), key: string(item.key), value: string(item.value), createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) })) });
    const [users, categories, suppliers, products, inventoryRecords, systemSettings, stock] = await Promise.all([tx.user.count(), tx.category.count(), tx.supplier.count(), tx.product.count(), tx.inventoryRecord.count(), tx.systemSetting.count(), tx.product.aggregate({ _sum: { stock: true } })]);
    const targetInTransaction = { users, categories, suppliers, products, inventoryRecords, systemSettings, totalStock: stock._sum.stock || 0 };
    if (JSON.stringify(localSummary) !== JSON.stringify(targetInTransaction)) throw new Error("迁移数据校验不一致，已自动回滚 PostgreSQL 写入。");
  }, { timeout: 30000 });

  const [users, categories, suppliers, products, inventoryRecords, systemSettings, stock] = await Promise.all([prisma.user.count(), prisma.category.count(), prisma.supplier.count(), prisma.product.count(), prisma.inventoryRecord.count(), prisma.systemSetting.count(), prisma.product.aggregate({ _sum: { stock: true } })]);
  const targetSummary = { users, categories, suppliers, products, inventoryRecords, systemSettings, totalStock: stock._sum.stock || 0 };
  if (JSON.stringify(localSummary) !== JSON.stringify(targetSummary)) throw new Error("迁移后的数量或总库存校验不一致，请运行 db:verify-migration 进一步检查。");
  console.log(JSON.stringify({ message: "SQLite 数据已安全导入 PostgreSQL。", localSummary, targetSummary }, null, 2));
}

main().catch((error) => { console.error("PostgreSQL 迁移失败：", error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
