import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/http";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
    res.json({ suppliers });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(1, "供应商名称不能为空。").max(100),
        contact: z.string().trim().max(50).optional().default(""),
        phone: z.string().trim().max(50).optional().default(""),
        address: z.string().trim().max(200).optional().default(""),
        remark: z.string().trim().max(200).optional().default("")
      })
      .parse(req.body);
    const supplier = await prisma.supplier.create({ data });
    res.status(201).json({ message: "供应商已新增。", supplier });
  })
);

export default router;
