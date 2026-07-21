import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { deleteProductImage, saveProductImage } from "../src/services/objectStorage";

const prisma = new PrismaClient();
const supportedMimes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};
const defaultSourceDirectory = "/Users/mac/Desktop/商品分类";
const sourceDirectory = path.resolve(process.env.PRODUCT_PHOTO_IMPORT_DIR || defaultSourceDirectory);
const apply = process.argv.includes("--apply");
const batchArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const batchLimit = batchArgument ? Number(batchArgument.slice("--limit=".length)) : undefined;

type SourceImage = {
  absolutePath: string;
  relativePath: string;
  categoryName: string;
  mimeType: string;
  code: string;
};

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const children = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return entry.isFile() ? [entryPath] : [];
  }));
  return children.flat();
}

function sourceCode(relativePath: string) {
  const suffix = crypto.createHash("sha256").update(relativePath).digest("hex").slice(0, 14).toUpperCase();
  return "IMG-" + suffix;
}

function createBackupPayload(data: {
  users: unknown[];
  categories: unknown[];
  suppliers: unknown[];
  products: unknown[];
  inventoryRecords: unknown[];
  systemSettings: unknown[];
}) {
  return {
    format: "store-product-management-backup",
    version: 2,
    createdAt: new Date().toISOString(),
    data
  };
}

async function backupCurrentCloudData() {
  const [users, categories, suppliers, products, inventoryRecords, systemSettings] = await Promise.all([
    prisma.user.findMany(),
    prisma.category.findMany(),
    prisma.supplier.findMany(),
    prisma.product.findMany(),
    prisma.inventoryRecord.findMany(),
    prisma.systemSetting.findMany()
  ]);
  const backupDirectory = path.resolve(process.cwd(), "../data/backups");
  await fs.mkdir(backupDirectory, { recursive: true });
  const filename = "pre-desktop-photo-import-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
  const backupPath = path.join(backupDirectory, filename);
  await fs.writeFile(backupPath, JSON.stringify(createBackupPayload({ users, categories, suppliers, products, inventoryRecords, systemSettings }), null, 2), "utf8");
  return { backupPath, products: products.length, categories: categories.length };
}

async function collectSourceImages(): Promise<SourceImage[]> {
  const files = await walk(sourceDirectory);
  const images = files.flatMap((absolutePath) => {
    const extension = path.extname(absolutePath).toLowerCase();
    const mimeType = supportedMimes[extension];
    if (!mimeType) return [];
    const relativePath = path.relative(sourceDirectory, absolutePath);
    const [categoryName] = relativePath.split(path.sep);
    if (!categoryName || categoryName === ".") return [];
    return [{ absolutePath, relativePath, categoryName, mimeType, code: sourceCode(relativePath) }];
  });
  return images.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "zh-CN"));
}

async function main() {
  if (batchLimit !== undefined && (!Number.isSafeInteger(batchLimit) || batchLimit < 1 || batchLimit > 100)) {
    throw new Error("--limit 必须是 1 到 100 之间的整数。");
  }
  const sourceStat = await fs.stat(sourceDirectory).catch(() => null);
  if (!sourceStat?.isDirectory()) throw new Error("未找到照片目录：" + sourceDirectory);
  const images = await collectSourceImages();
  if (!images.length) throw new Error("照片目录中没有可导入的 JPG、JPEG、PNG 或 WebP 图片。");

  const sizes = await Promise.all(images.map(async (image) => ({ image, size: (await fs.stat(image.absolutePath)).size })));
  const oversized = sizes.filter(({ size }) => size > 5 * 1024 * 1024);
  if (oversized.length) throw new Error("发现 " + oversized.length + " 张超过 5MB 的图片，已停止导入以保护系统数据。");

  const sourceCategories = [...new Set(images.map((image) => image.categoryName))];
  const existingProducts = await prisma.product.findMany({
    where: { code: { in: images.map((image) => image.code) } },
    select: { code: true }
  });
  const existingCodes = new Set(existingProducts.map((product) => product.code));
  const pendingImages = images.filter((image) => !existingCodes.has(image.code));
  const importImages = batchLimit ? pendingImages.slice(0, batchLimit) : pendingImages;
  const result = {
    sourceDirectory,
    found: images.length,
    categories: sourceCategories,
    alreadyImported: existingCodes.size,
    remaining: pendingImages.length,
    wouldImport: importImages.length,
    batchLimit: batchLimit || null
  };
  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", ...result }, null, 2));
    return;
  }

  if (!importImages.length) {
    console.log(JSON.stringify({ mode: "apply", ...result, message: "没有需要导入的新图片。" }, null, 2));
    return;
  }

  const backup = await backupCurrentCloudData();
  const existingCategories = await prisma.category.findMany({ select: { id: true, name: true, sortOrder: true } });
  const categoryByName = new Map(existingCategories.map((category) => [category.name, category]));
  let nextSortOrder = Math.max(-1, ...existingCategories.map((category) => category.sortOrder)) + 1;
  let createdCategories = 0;
  for (const name of sourceCategories) {
    if (categoryByName.has(name)) continue;
    const category = await prisma.category.create({
      data: {
        name,
        icon: "Image",
        remark: "从桌面“商品分类”图片文件夹导入",
        sortOrder: nextSortOrder++
      }
    });
    categoryByName.set(name, category);
    createdCategories += 1;
  }

  const serialByCategory = new Map<string, number>();
  let imported = 0;
  let skipped = 0;
  const failures: Array<{ file: string; reason: string }> = [];
  for (const image of importImages) {
    const serial = (serialByCategory.get(image.categoryName) || 0) + 1;
    serialByCategory.set(image.categoryName, serial);
    const category = categoryByName.get(image.categoryName);
    if (!category) {
      failures.push({ file: image.relativePath, reason: "无法匹配商品分类。" });
      continue;
    }
    let imagePath: string | undefined;
    try {
      const buffer = await fs.readFile(image.absolutePath);
      imagePath = await saveProductImage({
        buffer,
        mimetype: image.mimeType,
        originalname: path.basename(image.absolutePath),
        size: buffer.length
      } as Express.Multer.File);
      await prisma.product.create({
        data: {
          code: image.code,
          name: image.categoryName + " 图片 " + String(serial).padStart(3, "0") + "（待补充）",
          categoryId: category.id,
          imagePath,
          purchasePrice: 0,
          retailPrice: 0,
          memberPrice: 0,
          stock: 0,
          lowStock: 0,
          remark: "从桌面“商品分类”照片导入；请补充商品名称、价格、库存和规格。来源：" + image.relativePath,
          status: "OFF_SALE"
        }
      });
      imported += 1;
      if (imported % 10 === 0 || imported === result.wouldImport) console.log("本批已导入 " + imported + "/" + result.wouldImport + " 张图片。");
    } catch (error) {
      if (imagePath) await deleteProductImage(imagePath).catch(() => undefined);
      failures.push({ file: image.relativePath, reason: error instanceof Error ? error.message : "图片上传或商品创建失败。" });
    }
  }
  console.log(JSON.stringify({
    mode: "apply",
    ...result,
    backupPath: backup.backupPath,
    before: { products: backup.products, categories: backup.categories },
    createdCategories,
    imported,
    skipped,
    failures
  }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("桌面商品图片导入失败：", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
