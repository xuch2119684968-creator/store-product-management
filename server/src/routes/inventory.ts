import { Router, type Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, pagination } from "../utils/http";

const router = Router();
router.use(requireAuth);

const inventoryOperationSchema = z.enum(["INBOUND", "OUTBOUND", "ADJUSTMENT", "STOCKTAKE"]);
const quantitySchema = z.coerce.number().finite("数量格式不正确。").int().min(-1_000_000_000).max(1_000_000_000);
const remarkSchema = z.string().trim().max(300).optional().default("");
const changeSchema = z.object({
  productId: z.string().min(1),
  operation: inventoryOperationSchema,
  quantity: quantitySchema,
  actualStock: z.coerce.number().finite("实际库存格式不正确。").int().min(0).max(1_000_000_000).optional(),
  remark: remarkSchema
});
const batchChangeSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1, "请至少选择一件商品。").max(100, "一次最多批量修改 100 件商品。"),
  operation: z.enum(["INBOUND", "OUTBOUND", "ADJUSTMENT"]),
  quantity: quantitySchema,
  remark: remarkSchema
});

class InventoryOperationError extends Error {}
class InventoryNotFoundError extends Error {}

function getChangeQuantity(input: { operation: z.infer<typeof inventoryOperationSchema>; quantity: number; actualStock?: number }, currentStock: number) {
  if (input.operation === "INBOUND") {
    if (input.quantity <= 0) throw new InventoryOperationError("入库数量必须大于 0。");
    return input.quantity;
  }
  if (input.operation === "OUTBOUND") {
    if (input.quantity <= 0) throw new InventoryOperationError("出库数量必须大于 0。");
    return -input.quantity;
  }
  if (input.operation === "STOCKTAKE") {
    if (input.actualStock === undefined) throw new InventoryOperationError("盘点时必须填写实际库存。");
    return input.actualStock - currentStock;
  }
  if (input.quantity === 0) throw new InventoryOperationError("调整数量不能为 0。");
  return input.quantity;
}

function sendInventoryError(error: unknown, res: Response) {
  if (error instanceof InventoryNotFoundError) {
    res.status(404).json({ message: error.message });
    return true;
  }
  if (error instanceof InventoryOperationError) {
    res.status(400).json({ message: error.message });
    return true;
  }
  return false;
}

router.post(
  "/change",
  asyncHandler(async (req, res) => {
    const input = changeSchema.parse(req.body);
    try {
      const result = await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${input.productId} FOR UPDATE`);
        const product = await transaction.product.findUnique({ where: { id: input.productId } });
        if (!product) throw new InventoryNotFoundError("商品不存在或已删除。");
        const changeQuantity = getChangeQuantity(input, product.stock);
        const afterStock = product.stock + changeQuantity;
        if (afterStock < 0) throw new InventoryOperationError("库存不足，出库后库存不能为负数。");
        const updated = await transaction.product.update({
          where: { id: product.id },
          data: { stock: afterStock },
          include: { category: true }
        });
        const record = await transaction.inventoryRecord.create({
          data: {
            productId: product.id,
            operation: input.operation,
            changeQuantity,
            beforeStock: product.stock,
            afterStock,
            operatorId: req.user!.id,
            remark: input.remark
          },
          include: { product: { select: { code: true, name: true } }, operator: { select: { username: true } } }
        });
        return { product: updated, record };
      });
      return res.json({ message: "库存已更新。", ...result });
    } catch (error) {
      if (sendInventoryError(error, res)) return;
      throw error;
    }
  })
);

router.post(
  "/batch-change",
  asyncHandler(async (req, res) => {
    const input = batchChangeSchema.parse(req.body);
    const productIds = [...new Set(input.productIds)];
    try {
      const result = await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Product" WHERE "id" IN (${Prisma.join(productIds)}) FOR UPDATE`);
        const products = await transaction.product.findMany({ where: { id: { in: productIds } } });
        if (products.length !== productIds.length) throw new InventoryNotFoundError("部分选中的商品不存在或已被删除，请刷新后重试。");
        const changes = products.map((product) => {
          const changeQuantity = getChangeQuantity({ operation: input.operation, quantity: input.quantity }, product.stock);
          const afterStock = product.stock + changeQuantity;
          if (afterStock < 0) throw new InventoryOperationError("商品“" + product.name + "”库存不足，无法完成本次批量操作。");
          return { product, changeQuantity, afterStock };
        });
        await Promise.all(changes.map(({ product, afterStock }) => transaction.product.update({ where: { id: product.id }, data: { stock: afterStock } })));
        await transaction.inventoryRecord.createMany({
          data: changes.map(({ product, changeQuantity, afterStock }) => ({
            productId: product.id,
            operation: input.operation,
            changeQuantity,
            beforeStock: product.stock,
            afterStock,
            operatorId: req.user!.id,
            remark: input.remark
          }))
        });
        return { changedCount: changes.length };
      });
      return res.json({ message: "已批量更新 " + result.changedCount + " 件商品库存。", ...result });
    } catch (error) {
      if (sendInventoryError(error, res)) return;
      throw error;
    }
  })
);

router.get(
  "/records",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = pagination(req.query);
    const keyword = z.string().trim().max(100, "搜索关键词不能超过 100 个字符。").optional().parse(req.query.search) || "";
    const where = keyword
      ? {
          product: {
            OR: [{ name: { contains: keyword } }, { code: { contains: keyword } }, { barcode: { contains: keyword } }]
          }
        }
      : {};
    const [records, total] = await Promise.all([
      prisma.inventoryRecord.findMany({
        where,
        include: {
          product: { select: { code: true, name: true, imagePath: true } },
          operator: { select: { username: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      prisma.inventoryRecord.count({ where })
    ]);
    res.json({ records, pagination: { page, pageSize, total } });
  })
);

export default router;
