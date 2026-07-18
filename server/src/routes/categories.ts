import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/http";

const router = Router();
const categorySchema = z.object({
  name: z.string().trim().min(1, "分类名称不能为空。").max(30),
  icon: z.string().trim().max(50).optional().default("Tag"),
  remark: z.string().trim().max(200).optional().default("")
});

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { products: true } } }
    });
    res.json({ categories });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = categorySchema.parse(req.body);
    const latest = await prisma.category.aggregate({ _max: { sortOrder: true } });
    const category = await prisma.category.create({
      data: { ...data, sortOrder: (latest._max.sortOrder || 0) + 1 }
    });
    res.status(201).json({ message: "分类已新增。", category });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = categorySchema.partial().parse(req.body);
    const category = await prisma.category.update({ where: { id: String(req.params.id) }, data });
    res.json({ message: "分类已更新。", category });
  })
);

router.put(
  "/reorder",
  asyncHandler(async (req, res) => {
    const input = z
      .object({ items: z.array(z.object({ id: z.string().min(1), sortOrder: z.number().int().min(0) })).max(200, "一次最多调整 200 个分类。") })
      .parse(req.body);
    await prisma.$transaction(
      input.items.map((item) =>
        prisma.category.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
      )
    );
    res.json({ message: "分类顺序已保存。" });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const categoryId = String(req.params.id);
    const count = await prisma.product.count({ where: { categoryId } });
    if (count > 0) {
      return res.status(409).json({ message: "该分类下还有商品，不能删除。请先移动或删除相关商品。" });
    }
    await prisma.category.delete({ where: { id: categoryId } });
    res.json({ message: "分类已删除。" });
  })
);

export default router;
