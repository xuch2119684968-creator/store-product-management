import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { backupUpload } from "../middleware/upload";
import { asyncHandler } from "../utils/http";

const router = Router();
router.use(requireAuth);

const date = z.string().datetime();
const price = z.union([z.string(), z.number()]).transform((value) => String(value));
const backupSchema = z.object({
  format: z.literal("store-product-management-backup"),
  version: z.literal(2),
  createdAt: date,
  data: z.object({
    users: z.array(z.object({ id: z.string().min(1), username: z.string().min(1), passwordHash: z.string().min(20), mustChangePassword: z.boolean().default(false), createdAt: date, updatedAt: date })).min(1),
    categories: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), icon: z.string(), remark: z.string(), sortOrder: z.number().int(), createdAt: date, updatedAt: date })),
    suppliers: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), contact: z.string(), phone: z.string(), address: z.string(), remark: z.string(), createdAt: date, updatedAt: date })),
    products: z.array(z.object({ id: z.string().min(1), code: z.string().min(1), barcode: z.string().nullable(), name: z.string().min(1), categoryId: z.string().min(1), imagePath: z.string().nullable(), specification: z.string(), color: z.string(), size: z.string(), purchasePrice: price, retailPrice: price, memberPrice: price, stock: z.number().int().min(0), lowStock: z.number().int().min(0), supplierId: z.string().nullable(), location: z.string(), remark: z.string(), status: z.enum(["ON_SALE", "OFF_SALE"]), createdAt: date, updatedAt: date })),
    inventoryRecords: z.array(z.object({ id: z.string().min(1), productId: z.string().min(1), operation: z.enum(["INBOUND", "OUTBOUND", "ADJUSTMENT", "STOCKTAKE", "IMPORT"]), changeQuantity: z.number().int(), beforeStock: z.number().int().min(0), afterStock: z.number().int().min(0), operatorId: z.string().nullable(), remark: z.string(), createdAt: date })),
    systemSettings: z.array(z.object({ id: z.string().min(1), key: z.string().min(1), value: z.string(), createdAt: date, updatedAt: date }))
  })
});

async function setLastBackup(value: string) {
  await prisma.systemSetting.upsert({ where: { key: "lastBackupAt" }, update: { value }, create: { key: "lastBackupAt", value } });
}

function assertRelations(data: z.infer<typeof backupSchema>["data"]) {
  const userIds = new Set(data.users.map((item) => item.id));
  const categoryIds = new Set(data.categories.map((item) => item.id));
  const supplierIds = new Set(data.suppliers.map((item) => item.id));
  const productIds = new Set(data.products.map((item) => item.id));
  if (productIds.size !== data.products.length || userIds.size !== data.users.length) throw new Error("备份中存在重复的主键，无法恢复。");
  for (const product of data.products) {
    if (!categoryIds.has(product.categoryId) || (product.supplierId && !supplierIds.has(product.supplierId))) throw new Error("备份中的商品关联数据不完整，无法恢复。");
  }
  for (const record of data.inventoryRecords) {
    if (!productIds.has(record.productId) || (record.operatorId && !userIds.has(record.operatorId))) throw new Error("备份中的库存记录关联数据不完整，无法恢复。");
    if (record.afterStock < 0 || record.beforeStock < 0) throw new Error("备份中的库存记录存在非法库存值。");
  }
}

router.get("/download", asyncHandler(async (_req, res) => {
  const [users, categories, suppliers, products, inventoryRecords, systemSettings] = await Promise.all([
    prisma.user.findMany(), prisma.category.findMany(), prisma.supplier.findMany(), prisma.product.findMany(), prisma.inventoryRecord.findMany(), prisma.systemSetting.findMany()
  ]);
  const now = new Date().toISOString();
  const payload = { format: "store-product-management-backup" as const, version: 2 as const, createdAt: now, data: { users, categories, suppliers, products, inventoryRecords, systemSettings } };
  await setLastBackup(now);
  res.setHeader("Content-Disposition", "attachment; filename=store-backup-" + now.replace(/[:.]/g, "-") + ".json");
  return res.type("application/json").send(JSON.stringify(payload));
}));

router.post("/restore", backupUpload.single("file"), async (req, res, next) => {
  try {
    if (req.get("X-Confirm-Restore") !== "true") return res.status(400).json({ message: "恢复数据前必须进行二次确认。" });
    if (!req.file) return res.status(400).json({ message: "请选择云端备份 JSON 文件。" });
    let raw: unknown;
    try {
      raw = JSON.parse(req.file.buffer.toString("utf8"));
    } catch {
      return res.status(400).json({ message: "备份文件不是有效的 JSON 格式。" });
    }
    const payload = backupSchema.parse(raw);
    assertRelations(payload.data);
    await prisma.$transaction(async (transaction) => {
      await transaction.inventoryRecord.deleteMany();
      await transaction.product.deleteMany();
      await transaction.category.deleteMany();
      await transaction.supplier.deleteMany();
      await transaction.systemSetting.deleteMany();
      await transaction.user.deleteMany();
      await transaction.user.createMany({ data: payload.data.users.map((item) => ({ ...item, createdAt: new Date(item.createdAt), updatedAt: new Date(item.updatedAt) })) });
      await transaction.category.createMany({ data: payload.data.categories.map((item) => ({ ...item, createdAt: new Date(item.createdAt), updatedAt: new Date(item.updatedAt) })) });
      await transaction.supplier.createMany({ data: payload.data.suppliers.map((item) => ({ ...item, createdAt: new Date(item.createdAt), updatedAt: new Date(item.updatedAt) })) });
      await transaction.product.createMany({ data: payload.data.products.map((item) => ({ ...item, createdAt: new Date(item.createdAt), updatedAt: new Date(item.updatedAt) })) });
      await transaction.inventoryRecord.createMany({ data: payload.data.inventoryRecords.map((item) => ({ ...item, createdAt: new Date(item.createdAt) })) });
      await transaction.systemSetting.createMany({ data: payload.data.systemSettings.map((item) => ({ ...item, createdAt: new Date(item.createdAt), updatedAt: new Date(item.updatedAt) })) });
    }, { timeout: 30000 });
    res.clearCookie("store_session", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    return res.json({ message: "云端数据已完整恢复。" });
  } catch (error) {
    return next(error);
  }
});

export default router;
