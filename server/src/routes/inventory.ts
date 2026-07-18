import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, pagination } from "../utils/http";

const router = Router();
router.use(requireAuth);

const changeSchema = z.object({
  productId: z.string().min(1),
  operation: z.enum(["INBOUND", "OUTBOUND", "ADJUSTMENT", "STOCKTAKE"]),
  quantity: z.coerce.number().finite("数量格式不正确。").int().min(-1_000_000_000).max(1_000_000_000),
  actualStock: z.coerce.number().finite("实际库存格式不正确。").int().min(0).max(1_000_000_000).optional(),
  remark: z.string().trim().max(300).optional().default("")
});

router.post(
  "/change",
  asyncHandler(async (req, res) => {
    const input = changeSchema.parse(req.body);
    const result = await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findUnique({ where: { id: input.productId } });
      if (!product) throw new Error("商品不存在或已删除。");
      let changeQuantity = input.quantity;
      if (input.operation === "INBOUND") {
        if (input.quantity <= 0) throw new Error("入库数量必须大于 0。");
      } else if (input.operation === "OUTBOUND") {
        if (input.quantity <= 0) throw new Error("出库数量必须大于 0。");
        changeQuantity = -input.quantity;
      } else if (input.operation === "STOCKTAKE") {
        if (input.actualStock === undefined) throw new Error("盘点时必须填写实际库存。");
        changeQuantity = input.actualStock - product.stock;
      }
      const afterStock = product.stock + changeQuantity;
      if (afterStock < 0) throw new Error("库存不足，出库后库存不能为负数。");
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
    res.json({ message: "库存已更新。", ...result });
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
