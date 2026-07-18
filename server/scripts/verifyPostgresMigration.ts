import { PrismaClient } from "@prisma/client";
import { readSqliteSnapshot, snapshotSummary } from "./sqliteSnapshot";

const prisma = new PrismaClient();
async function main() {
  const source = snapshotSummary(readSqliteSnapshot());
  const [users, categories, suppliers, products, inventoryRecords, systemSettings, stock] = await Promise.all([prisma.user.count(), prisma.category.count(), prisma.supplier.count(), prisma.product.count(), prisma.inventoryRecord.count(), prisma.systemSetting.count(), prisma.product.aggregate({ _sum: { stock: true } })]);
  const target = { users, categories, suppliers, products, inventoryRecords, systemSettings, totalStock: stock._sum.stock || 0 };
  console.log(JSON.stringify({ source, target, matched: JSON.stringify(source) === JSON.stringify(target) }, null, 2));
  if (JSON.stringify(source) !== JSON.stringify(target)) process.exitCode = 1;
}
main().catch((error) => { console.error("迁移校验失败：", error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
