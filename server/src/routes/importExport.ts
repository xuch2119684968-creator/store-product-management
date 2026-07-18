import { Router } from "express";
import * as XLSX from "xlsx";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { fileUpload } from "../middleware/upload";
import { asyncHandler } from "../utils/http";

const router = Router();
router.use(requireAuth);

const columns = [
  "商品编号", "条形码", "商品名称", "分类", "规格", "颜色", "尺码", "进货价", "零售价",
  "会员价", "库存", "库存预警值", "供应商", "存放位置", "备注"
];

type ImportProduct = {
  row: number;
  code: string;
  barcode: string;
  name: string;
  category: string;
  specification: string;
  color: string;
  size: string;
  purchasePrice: number;
  retailPrice: number;
  memberPrice: number;
  stock: number;
  lowStock: number;
  supplier: string;
  location: string;
  remark: string;
  errors: string[];
};

function text(value: unknown) {
  return String(value ?? "").trim();
}
function number(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : Number.NaN;
}
function normalizeRows(rows: Record<string, unknown>[]) {
  return rows.map((raw, index): ImportProduct => {
    const item: ImportProduct = {
      row: index + 2,
      code: text(raw["商品编号"]),
      barcode: text(raw["条形码"]),
      name: text(raw["商品名称"]),
      category: text(raw["分类"]),
      specification: text(raw["规格"]),
      color: text(raw["颜色"]),
      size: text(raw["尺码"]),
      purchasePrice: number(raw["进货价"]),
      retailPrice: number(raw["零售价"]),
      memberPrice: number(raw["会员价"]),
      stock: number(raw["库存"]),
      lowStock: number(raw["库存预警值"]),
      supplier: text(raw["供应商"]),
      location: text(raw["存放位置"]),
      remark: text(raw["备注"]),
      errors: []
    };
    if (!item.code) item.errors.push("商品编号不能为空");
    if (!item.name) item.errors.push("商品名称不能为空");
    if (!item.category) item.errors.push("分类不能为空");
    if (![item.purchasePrice, item.retailPrice, item.memberPrice].every((value) => value >= 0)) {
      item.errors.push("价格必须是大于或等于 0 的数字");
    }
    if (![item.stock, item.lowStock].every((value) => Number.isInteger(value) && value >= 0)) {
      item.errors.push("库存和库存预警值必须是大于或等于 0 的整数");
    }
    return item;
  });
}

function workbookRows(file: Express.Multer.File) {
  const extension = file.originalname.split(".").pop()?.toLowerCase();
  const workbook = XLSX.read(file.buffer, { type: "buffer", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet || !["csv", "xlsx", "xls"].includes(extension || "")) {
    throw new Error("仅支持 CSV、XLSX 或 XLS 格式文件。");
  }
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
  if (range && (range.e.r + 1 > 2001 || range.e.c + 1 > columns.length + 5)) {
    throw new Error("导入文件最多 2000 条数据，且字段数量不能超过模板范围。");
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

router.get("/template", (_req, res) => {
  const sheet = XLSX.utils.aoa_to_sheet([columns]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "商品导入模板");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", "attachment; filename=product-import-template.xlsx");
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(buffer);
});

router.post("/preview", fileUpload.single("file"), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "请选择导入文件。" });
    const rows = normalizeRows(workbookRows(req.file));
    return res.json({
      rows,
      total: rows.length,
      valid: rows.filter((item) => item.errors.length === 0).length,
      invalid: rows.filter((item) => item.errors.length > 0).length
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/commit",
  asyncHandler(async (req, res) => {
    const rows = z.array(z.record(z.any())).max(2000, "一次最多导入 2000 条商品。").parse(req.body.rows);
    const data = rows.map((raw, index): ImportProduct => {
      const item: ImportProduct = {
        row: Number(raw.row) || index + 2,
        code: text(raw.code),
        barcode: text(raw.barcode),
        name: text(raw.name),
        category: text(raw.category),
        specification: text(raw.specification),
        color: text(raw.color),
        size: text(raw.size),
        purchasePrice: number(raw.purchasePrice),
        retailPrice: number(raw.retailPrice),
        memberPrice: number(raw.memberPrice),
        stock: number(raw.stock),
        lowStock: number(raw.lowStock),
        supplier: text(raw.supplier),
        location: text(raw.location),
        remark: text(raw.remark),
        errors: []
      };
      if (!item.code) item.errors.push("商品编号不能为空");
      if (!item.name) item.errors.push("商品名称不能为空");
      if (!item.category) item.errors.push("分类不能为空");
      if (![item.purchasePrice, item.retailPrice, item.memberPrice].every((value) => value >= 0)) item.errors.push("价格必须是大于或等于 0 的数字");
      if (![item.stock, item.lowStock].every((value) => Number.isInteger(value) && value >= 0)) item.errors.push("库存和库存预警值必须是大于或等于 0 的整数");
      return item;
    });
    const categories = new Map((await prisma.category.findMany()).map((item) => [item.name, item.id]));
    const suppliers = new Map((await prisma.supplier.findMany()).map((item) => [item.name, item.id]));
    const existingCodes = new Set((await prisma.product.findMany({ select: { code: true } })).map((item) => item.code));
    const existingBarcodes = new Set((await prisma.product.findMany({ where: { barcode: { not: null } }, select: { barcode: true } })).map((item) => item.barcode!));
    const failures: { row: number; reason: string }[] = [];
    let imported = 0;

    for (const item of data) {
      const errors = [...item.errors];
      const categoryId = categories.get(item.category);
      if (!categoryId) errors.push("分类不存在，请先在分类管理中新增");
      if (existingCodes.has(item.code)) errors.push("商品编号已存在");
      if (item.barcode && existingBarcodes.has(item.barcode)) errors.push("条形码已存在");
      if (errors.length) {
        failures.push({ row: item.row, reason: errors.join("；") });
        continue;
      }
      let supplierId: string | null = null;
      if (item.supplier) {
        supplierId = suppliers.get(item.supplier) || null;
        if (!supplierId) {
          const supplier = await prisma.supplier.create({ data: { name: item.supplier } });
          supplierId = supplier.id;
          suppliers.set(item.supplier, supplier.id);
        }
      }
      const product = await prisma.product.create({
        data: {
          code: item.code, barcode: item.barcode || null, name: item.name, categoryId: categoryId!,
          specification: item.specification, color: item.color, size: item.size,
          purchasePrice: item.purchasePrice, retailPrice: item.retailPrice, memberPrice: item.memberPrice,
          stock: item.stock, lowStock: item.lowStock, supplierId, location: item.location, remark: item.remark
        }
      });
      if (item.stock > 0) {
        await prisma.inventoryRecord.create({
          data: {
            productId: product.id, operation: "IMPORT", changeQuantity: item.stock,
            beforeStock: 0, afterStock: item.stock, operatorId: req.user!.id, remark: "批量导入初始库存"
          }
        });
      }
      existingCodes.add(item.code);
      if (item.barcode) existingBarcodes.add(item.barcode);
      imported += 1;
    }
    res.json({ message: "导入处理完成。", imported, failures });
  })
);

router.get(
  "/products",
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      include: { category: true, supplier: true },
      orderBy: { code: "asc" }
    });
    const rows = products.map((item) => ({
      "商品编号": item.code, "条形码": item.barcode || "", "商品名称": item.name, "分类": item.category.name,
      "规格": item.specification, "颜色": item.color, "尺码": item.size, "进货价": Number(item.purchasePrice),
      "零售价": Number(item.retailPrice), "会员价": Number(item.memberPrice), "库存": item.stock, "库存预警值": item.lowStock,
      "供应商": item.supplier?.name || "", "存放位置": item.location, "备注": item.remark,
      "商品状态": item.status === "ON_SALE" ? "在售" : "停售"
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "商品数据");
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=products.xlsx");
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(buffer);
  })
);

router.get(
  "/inventory-records",
  asyncHandler(async (_req, res) => {
    const records = await prisma.inventoryRecord.findMany({
      include: { product: true, operator: true },
      orderBy: { createdAt: "desc" }
    });
    const rows = records.map((item) => ({
      "操作时间": item.createdAt.toLocaleString("zh-CN"),
      "商品编号": item.product.code,
      "商品名称": item.product.name,
      "操作类型": { INBOUND: "入库", OUTBOUND: "出库", ADJUSTMENT: "调整", STOCKTAKE: "盘点", IMPORT: "导入" }[item.operation],
      "变化数量": item.changeQuantity,
      "操作前库存": item.beforeStock,
      "操作后库存": item.afterStock,
      "操作人员": item.operator?.username || "系统",
      "备注": item.remark
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "库存记录");
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=inventory-records.xlsx");
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(buffer);
  })
);

export default router;
