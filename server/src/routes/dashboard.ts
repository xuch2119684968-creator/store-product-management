import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/http";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const [
      totalProducts,
      onSaleProducts,
      offSaleProducts,
      categoryCount,
      stockSummary,
      lowStockProducts,
      todayNewProducts,
      recentRecords,
      categories
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: "ON_SALE" } }),
      prisma.product.count({ where: { status: "OFF_SALE" } }),
      prisma.category.count(),
      prisma.product.aggregate({ _sum: { stock: true } }),
      prisma.product.findMany({
        where: { stock: { lte: 0 } },
        orderBy: { stock: "asc" },
        take: 10,
        include: { category: true }
      }),
      prisma.product.count({ where: { createdAt: { gte: today } } }),
      prisma.inventoryRecord.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { product: { select: { code: true, name: true } }, operator: { select: { username: true } } }
      }),
      prisma.category.findMany({
        orderBy: { sortOrder: "asc" },
        include: { products: { select: { stock: true } } }
      })
    ]);

    const allProducts = await prisma.product.findMany({
      include: { category: { select: { name: true } } }
    });
    const lowStockItems = allProducts
      .filter((item) => item.stock <= item.lowStock);
    const lowStockRanking = lowStockItems
      .sort((a, b) => a.stock - b.stock || a.lowStock - b.lowStock)
      .slice(0, 10);
    const lowStock = lowStockItems.length;
    const categoryStats = categories.map((category) => ({
      name: category.name,
      productCount: category.products.length,
      stock: category.products.reduce((sum, product) => sum + product.stock, 0)
    }));
    const records = await prisma.inventoryRecord.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, changeQuantity: true }
    });
    const trend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      const onDay = records.filter((record) => record.createdAt.toISOString().slice(0, 10) === key);
      return {
        date: key.slice(5),
        入库: onDay.filter((item) => item.changeQuantity > 0).reduce((sum, item) => sum + item.changeQuantity, 0),
        出库: Math.abs(onDay.filter((item) => item.changeQuantity < 0).reduce((sum, item) => sum + item.changeQuantity, 0))
      };
    });

    res.json({
      summary: {
        totalProducts,
        onSaleProducts,
        offSaleProducts,
        categoryCount,
        totalStock: stockSummary._sum.stock || 0,
        lowStock,
        todayNewProducts
      },
      categoryStats,
      lowStockRanking,
      trend,
      recentRecords
    });
  })
);

export default router;
