import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, pagination } from "../utils/http";
import { nullableText, productSchema } from "../utils/product";
import { deleteProductImage } from "../services/objectStorage";
import { serializeForApi } from "../utils/serialize";

const router = Router();
const productListQuery = z.object({
  search: z.string().trim().max(100, "搜索关键词不能超过 100 个字符。").optional(),
  categoryId: z.string().trim().max(100).optional(),
  status: z.enum(["ON_SALE", "OFF_SALE"]).optional(),
  stockStatus: z.enum(["OUT", "LOW", "NORMAL"]).optional(),
  sort: z.enum(["stock", "retailPrice"]).optional(),
  order: z.enum(["asc", "desc"]).optional()
});

function productInclude() {
  return {
    category: { select: { id: true, name: true, icon: true } },
    supplier: { select: { id: true, name: true } }
  } as const;
}

function productData(input: z.infer<typeof productSchema>) {
  return {
    ...input,
    barcode: nullableText(input.barcode),
    imagePath: nullableText(input.imagePath),
    supplierId: nullableText(input.supplierId)
  };
}

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = pagination(req.query);
    const query = productListQuery.parse(req.query);
    const search = query.search || "";
    const categoryId = query.categoryId || "";
    const status = query.status || "";
    const stockStatus = query.stockStatus || "";
    const sortField = query.sort === "stock" ? "stock" : "retailPrice";
    const sortOrder = query.order === "asc" ? "asc" : "desc";

    const where: Prisma.ProductWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { code: { contains: search } },
              { barcode: { contains: search } },
              { specification: { contains: search } }
            ]
          }
        : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(status === "ON_SALE" || status === "OFF_SALE" ? { status } : {}),
      ...(stockStatus === "OUT" ? { stock: { lte: 0 } } : {})
    };

    const needsCalculatedStockFilter = stockStatus === "LOW" || stockStatus === "NORMAL";
    const allOrPaged = await prisma.product.findMany({
      where,
      include: productInclude(),
      orderBy: { [sortField]: sortOrder },
      ...(needsCalculatedStockFilter ? {} : { skip, take: pageSize })
    });
    const filtered = stockStatus === "LOW"
      ? allOrPaged.filter((product) => product.stock > 0 && product.stock <= product.lowStock)
      : stockStatus === "NORMAL"
        ? allOrPaged.filter((product) => product.stock > product.lowStock)
        : allOrPaged;
    const count = needsCalculatedStockFilter ? filtered.length : await prisma.product.count({ where });
    const products = needsCalculatedStockFilter ? filtered.slice(skip, skip + pageSize) : filtered;
    res.json({
      products: serializeForApi(products),
      pagination: { page, pageSize, total: count }
    });
  })
);

router.get(
  "/lookup",
  asyncHandler(async (req, res) => {
    const keyword = z.string().trim().max(100, "搜索关键词不能超过 100 个字符。").optional().parse(req.query.q) || "";
    if (!keyword) return res.json({ products: [] });
    const products = await prisma.product.findMany({
      where: {
        status: "ON_SALE",
        OR: [
          { name: { contains: keyword } },
          { code: { contains: keyword } },
          { barcode: { equals: keyword } }
        ]
      },
      include: productInclude(),
      take: 30,
      orderBy: { updatedAt: "desc" }
    });
    res.json({ products: serializeForApi(products) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: String(req.params.id) },
      include: productInclude()
    });
    if (!product) return res.status(404).json({ message: "商品不存在或已删除。" });
    return res.json({ product: serializeForApi(product) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = productSchema.parse(req.body);
    const product = await prisma.product.create({
      data: productData(input),
      include: productInclude()
    });
    if (input.stock > 0) {
      await prisma.inventoryRecord.create({
        data: {
          productId: product.id,
          operation: "IMPORT",
          changeQuantity: input.stock,
          beforeStock: 0,
          afterStock: input.stock,
          operatorId: req.user!.id,
          remark: "新增商品初始库存"
        }
      });
    }
    res.status(201).json({ message: "商品已新增。", product: serializeForApi(product) });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = productSchema.parse(req.body);
    const current = await prisma.product.findUnique({ where: { id: String(req.params.id) } });
    if (!current) return res.status(404).json({ message: "商品不存在或已删除。" });
    if (input.stock !== current.stock) {
      return res.status(400).json({ message: "库存请通过“库存管理”页面调整，确保保留完整变动记录。" });
    }
    const product = await prisma.product.update({
      where: { id: String(req.params.id) },
      data: productData(input),
      include: productInclude()
    });
    res.json({ message: "商品信息已更新。", product: serializeForApi(product) });
  })
);

router.post(
  "/:id/copy",
  asyncHandler(async (req, res) => {
    const source = await prisma.product.findUnique({ where: { id: String(req.params.id) } });
    if (!source) return res.status(404).json({ message: "商品不存在或已删除。" });
    const baseCode = source.code + "-COPY";
    let suffix = 1;
    let code = baseCode + suffix;
    while (await prisma.product.findUnique({ where: { code } })) {
      suffix += 1;
      code = baseCode + suffix;
    }
    const product = await prisma.product.create({
      data: {
        ...source,
        id: undefined,
        code,
        barcode: null,
        name: source.name + "（副本）",
        stock: 0
      },
      include: productInclude()
    });
    res.status(201).json({ message: "商品已复制，请补充条形码和库存。", product: serializeForApi(product) });
  })
);

router.post(
  "/bulk",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        ids: z.array(z.string().min(1)).min(1, "请至少选择一个商品。").max(500, "一次最多操作 500 个商品。"),
        action: z.enum(["delete", "category", "status", "price"]),
        categoryId: z.string().optional(),
        status: z.enum(["ON_SALE", "OFF_SALE"]).optional(),
        retailPrice: z.coerce.number().min(0).optional()
      })
      .parse(req.body);
    const where = { id: { in: input.ids } };
    if (input.action === "delete") {
      await prisma.product.deleteMany({ where });
      return res.json({ message: "已删除选中的商品。" });
    }
    if (input.action === "category") {
      if (!input.categoryId) return res.status(400).json({ message: "请选择目标分类。" });
      await prisma.product.updateMany({ where, data: { categoryId: input.categoryId } });
      return res.json({ message: "商品分类已批量更新。" });
    }
    if (input.action === "status") {
      if (!input.status) return res.status(400).json({ message: "请选择商品状态。" });
      await prisma.product.updateMany({ where, data: { status: input.status } });
      return res.json({ message: "商品状态已批量更新。" });
    }
    if (input.retailPrice === undefined) return res.status(400).json({ message: "请输入新的零售价。" });
    await prisma.product.updateMany({ where, data: { retailPrice: input.retailPrice } });
    return res.json({ message: "商品零售价已批量更新。" });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: String(req.params.id) } });
    if (!product) return res.status(404).json({ message: "商品不存在或已删除。" });
    await prisma.product.delete({ where: { id: product.id } });
    await deleteProductImage(product.imagePath).catch(() => undefined);
    return res.json({ message: "商品已删除。" });
  })
);

export default router;
