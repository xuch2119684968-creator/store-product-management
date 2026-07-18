import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/http";
import { serializeForApi } from "../utils/serialize";

const router = Router();
router.use(requireAuth);

router.post(
  "/products",
  asyncHandler(async (req, res) => {
    const input = z.object({ ids: z.array(z.string()).min(1) }).parse(req.body);
    const [products, settingsRows] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: input.ids } },
        include: { category: { select: { name: true } } }
      }),
      prisma.systemSetting.findMany({ where: { key: { in: ["storeName", "currency", "labelWidth", "labelHeight"] } } })
    ]);
    const settings = Object.fromEntries(settingsRows.map((item) => [item.key, item.value]));
    res.json({ products: serializeForApi(products), settings });
  })
);

export default router;
