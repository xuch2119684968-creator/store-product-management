import type { ProductStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = z.string().trim().max(500).optional().or(z.literal(""));

export const productSchema = z.object({
  code: z.string().trim().min(1, "商品编号不能为空。").max(50),
  barcode: z.string().trim().max(100).optional().or(z.literal("")),
  name: z.string().trim().min(1, "商品名称不能为空。").max(100),
  categoryId: z.string().min(1, "请选择商品分类。"),
  imagePath: optionalText,
  specification: optionalText,
  color: z.string().trim().max(50).optional().or(z.literal("")),
  size: z.string().trim().max(50).optional().or(z.literal("")),
  purchasePrice: z.coerce.number().finite("进货价格式不正确。").min(0, "进货价不能小于 0。").max(1_000_000_000),
  retailPrice: z.coerce.number().finite("零售价格式不正确。").min(0, "零售价不能小于 0。").max(1_000_000_000),
  memberPrice: z.coerce.number().finite("会员价格式不正确。").min(0, "会员价不能小于 0。").max(1_000_000_000),
  stock: z.coerce.number().finite("库存格式不正确。").int().min(0, "库存不能小于 0。").max(1_000_000_000),
  lowStock: z.coerce.number().finite("库存预警值格式不正确。").int().min(0, "库存预警值不能小于 0。").max(1_000_000_000),
  supplierId: z.string().optional().nullable(),
  location: z.string().trim().max(100).optional().or(z.literal("")),
  remark: optionalText,
  status: z.enum(["ON_SALE", "OFF_SALE"]).default("ON_SALE")
});

export function nullableText(value?: string | null) {
  const result = String(value || "").trim();
  return result || null;
}

export function displayStatus(status: ProductStatus) {
  return status === "ON_SALE" ? "在售" : "停售";
}
