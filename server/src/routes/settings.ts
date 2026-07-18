import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/http";

const router = Router();
router.use(requireAuth);

const allowedKeys = new Set([
  "storeName",
  "storePhone",
  "storeAddress",
  "currency",
  "labelWidth",
  "labelHeight",
  "defaultLowStock",
  "lastBackupAt"
]);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.systemSetting.findMany();
    const settings = Object.fromEntries(rows.map((item) => [item.key, item.value]));
    res.json({ settings, version: "1.0.0" });
  })
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const input = z.record(z.string(), z.string().max(500)).parse(req.body.settings);
    const entries = Object.entries(input).filter(([key]) => allowedKeys.has(key));
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
      )
    );
    res.json({ message: "系统设置已保存。" });
  })
);

export default router;
