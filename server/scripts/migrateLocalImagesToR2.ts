import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { config } from "../src/config";
import { saveProductImage } from "../src/services/objectStorage";

const prisma = new PrismaClient();
const mimeByExtension: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

async function main() {
  const localFiles = await fs.readdir(config.uploadsDir).catch(() => []);
  const imageFiles = localFiles.filter((file) => Boolean(mimeByExtension[path.extname(file).toLowerCase()]));
  if (!imageFiles.length) {
    console.log(JSON.stringify({ found: 0, migrated: 0, failures: [] }, null, 2));
    return;
  }
  if (config.imageStorageProvider === "local") throw new Error("检测到本地商品图片，请先完整设置 R2_* 或 CLOUDINARY_* 图片存储环境变量后再迁移。");
  const products = await prisma.product.findMany({ where: { imagePath: { startsWith: "/uploads/" } }, select: { id: true, imagePath: true } });
  let migrated = 0;
  const failures: string[] = [];
  for (const product of products) {
    const original = product.imagePath!;
    const filename = path.basename(original);
    const extension = path.extname(filename).toLowerCase();
    const mimetype = mimeByExtension[extension];
    if (!mimetype) { failures.push(product.id + "：不支持的图片扩展名"); continue; }
    try {
      const buffer = await fs.readFile(path.join(config.uploadsDir, filename));
      const imagePath = await saveProductImage({ buffer, mimetype } as Express.Multer.File);
      await prisma.product.update({ where: { id: product.id }, data: { imagePath } });
      migrated += 1;
    } catch (error) {
      failures.push(product.id + "：" + (error instanceof Error ? error.message : "上传失败"));
    }
  }
  console.log(JSON.stringify({ found: products.length, migrated, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => { console.error("本地图片迁移失败：", error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
