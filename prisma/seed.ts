import "dotenv/config";
import bcrypt from "bcryptjs";
import { InventoryOperation, PrismaClient, ProductStatus } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  ["袜子", "Socks", "日常袜、运动袜、保暖袜"],
  ["手套", "Hand", "保暖手套、劳保手套"],
  ["帽子", "Hat", "遮阳帽、保暖帽"],
  ["内衣", "Shirt", "文胸、打底内衣"],
  ["内裤", "CircleDot", "男女内裤"],
  ["背心", "Vest", "打底背心、运动背心"],
  ["瑜伽服", "Dumbbell", "瑜伽及运动服"],
  ["裤袜", "Footprints", "丝袜、连裤袜"],
  ["保暖衣", "Shirt", "秋衣、加绒上衣"],
  ["保暖裤", "PanelBottom", "秋裤、保暖裤"],
  ["其他", "Package", "其他未分类商品"]
] as const;

const productSeeds = [
  ["WZ-001", "789100000001", "纯棉中筒袜", "袜子", "3双装", "白色", "均码", 8.5, 19.9, 17.9, 58, 12, "A区-01", "精梳棉，日常通勤款"],
  ["WZ-002", "789100000002", "加厚毛圈运动袜", "袜子", "2双装", "黑色", "均码", 11.2, 25.9, 23.5, 18, 10, "A区-01", "秋冬运动保暖"],
  ["WZ-003", "789100000003", "儿童彩棉袜", "袜子", "5双装", "混色", "S码", 13.5, 29.9, 26.9, 8, 10, "A区-02", "适合3-6岁儿童"],
  ["ST-001", "789100000004", "触屏防风手套", "手套", "一副装", "深灰", "均码", 16.5, 39.9, 35.9, 21, 8, "A区-03", "食指触屏，骑行可用"],
  ["ST-002", "789100000005", "儿童加绒手套", "手套", "一副装", "粉色", "S码", 10.8, 25.9, 22.9, 7, 8, "A区-03", "内里短绒"],
  ["MZ-001", "789100000006", "休闲棒球帽", "帽子", "可调节", "藏青", "均码", 17.0, 42.9, 38.9, 35, 8, "B区-01", "纯棉水洗面料"],
  ["MZ-002", "789100000007", "羊毛贝雷帽", "帽子", "可调节", "驼色", "均码", 24.0, 59.9, 53.9, 9, 6, "B区-01", "秋冬复古款"],
  ["NY-001", "789100000008", "无痕女士内衣", "内衣", "单件", "肤色", "75B", 28.0, 69.9, 62.9, 16, 6, "B区-02", "无钢圈薄杯"],
  ["NY-002", "789100000009", "运动聚拢内衣", "内衣", "单件", "黑色", "M码", 35.0, 89.9, 79.9, 13, 5, "B区-02", "中强度支撑"],
  ["NK-001", "789100000010", "男士纯棉平角内裤", "内裤", "2条装", "混色", "L码", 15.5, 36.9, 32.9, 42, 10, "B区-03", "95%棉，透气舒适"],
  ["NK-002", "789100000011", "女士冰丝无痕内裤", "内裤", "3条装", "混色", "M码", 17.0, 39.9, 35.9, 29, 10, "B区-03", "轻薄无痕"],
  ["BX-001", "789100000012", "基础纯棉背心", "背心", "单件", "白色", "L码", 14.0, 32.9, 29.9, 24, 8, "C区-01", "圆领打底款"],
  ["BX-002", "789100000013", "女士螺纹吊带背心", "背心", "单件", "米白", "M码", 16.0, 39.9, 35.9, 6, 8, "C区-01", "弹力螺纹面料"],
  ["YJ-001", "789100000014", "高腰瑜伽裤", "瑜伽服", "单件", "黑色", "M码", 44.0, 109.9, 98.9, 17, 5, "C区-02", "高弹收腹，不透"],
  ["YJ-002", "789100000015", "速干瑜伽上衣", "瑜伽服", "单件", "藕粉", "S码", 37.0, 89.9, 79.9, 11, 5, "C区-02", "修身短款"],
  ["KW-001", "789100000016", "春秋连裤袜", "裤袜", "单条", "肤色", "均码", 8.0, 22.9, 19.9, 45, 12, "C区-03", "80D微压"],
  ["KW-002", "789100000017", "加绒打底裤袜", "裤袜", "单条", "黑色", "均码", 19.0, 49.9, 44.9, 5, 8, "C区-03", "秋冬加绒显瘦"],
  ["BNY-001", "789100000018", "女士德绒保暖衣", "保暖衣", "单件", "豆沙粉", "M码", 38.0, 89.9, 79.9, 20, 6, "D区-01", "双面磨毛"],
  ["BNY-002", "789100000019", "男士加绒保暖衣", "保暖衣", "单件", "深灰", "L码", 42.0, 99.9, 89.9, 14, 6, "D区-01", "圆领加绒"],
  ["BNK-001", "789100000020", "女士德绒保暖裤", "保暖裤", "单件", "豆沙粉", "M码", 35.0, 85.9, 75.9, 22, 6, "D区-02", "高腰贴身"],
  ["BNK-002", "789100000021", "男士加厚保暖裤", "保暖裤", "单件", "深灰", "L码", 39.0, 95.9, 85.9, 4, 6, "D区-02", "松紧腰绒里"],
  ["WZ-004", "789100000022", "女士隐形船袜", "袜子", "3双装", "肤色", "均码", 9.5, 21.9, 19.9, 60, 15, "A区-02", "硅胶防滑后跟"],
  ["ST-003", "789100000023", "防滑劳保手套", "手套", "一副装", "灰色", "均码", 7.5, 16.9, 14.9, 31, 10, "A区-03", "耐磨掌心"],
  ["MZ-003", "789100000024", "空顶遮阳帽", "帽子", "可调节", "米色", "均码", 13.0, 32.9, 29.9, 19, 8, "B区-01", "夏季透气"],
  ["NY-003", "789100000025", "哺乳舒适内衣", "内衣", "单件", "浅粉", "80B", 33.0, 78.9, 69.9, 7, 5, "B区-02", "前开扣设计"],
  ["NK-003", "789100000026", "高腰收腹内裤", "内裤", "单条", "黑色", "L码", 13.0, 29.9, 26.9, 15, 8, "B区-03", "弹力包腹"],
  ["BX-003", "789100000027", "男士速干运动背心", "背心", "单件", "宝蓝", "XL码", 21.0, 49.9, 44.9, 12, 5, "C区-01", "跑步健身适用"],
  ["YJ-003", "789100000028", "长袖瑜伽套装", "瑜伽服", "两件套", "浅灰", "M码", 65.0, 159.9, 145.9, 9, 4, "C区-02", "上衣长裤套装"],
  ["KW-003", "789100000029", "儿童舞蹈裤袜", "裤袜", "单条", "粉色", "S码", 10.5, 26.9, 23.9, 3, 8, "C区-03", "柔软弹力"],
  ["QT-001", "789100000030", "衣物防潮收纳袋", "其他", "5只装", "透明", "中号", 7.0, 18.9, 16.9, 27, 8, "D区-03", "换季收纳防尘"]
] as const;

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", passwordHash, mustChangePassword: true }
  });

  for (const [index, [name, icon, remark]] of categories.entries()) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, icon, remark, sortOrder: index + 1 }
    });
  }

  const defaultSupplier = await prisma.supplier.upsert({
    where: { name: "默认供应商" },
    update: {},
    create: { name: "默认供应商", contact: "采购负责人", phone: "", remark: "系统初始化供应商" }
  });

  const categoryRows = await prisma.category.findMany();
  const categoryMap = new Map(categoryRows.map((item) => [item.name, item.id]));

  for (const item of productSeeds) {
    const [code, barcode, name, categoryName, specification, color, size, purchasePrice, retailPrice, memberPrice, stock, lowStock, location, remark] = item;
    await prisma.product.upsert({
      where: { code },
      update: {},
      create: {
        code,
        barcode,
        name,
        categoryId: categoryMap.get(categoryName)!,
        specification,
        color,
        size,
        purchasePrice,
        retailPrice,
        memberPrice,
        stock,
        lowStock,
        supplierId: defaultSupplier.id,
        location,
        remark,
        status: ProductStatus.ON_SALE
      }
    });
  }

  const settings = {
    storeName: "我的店铺",
    storePhone: "",
    storeAddress: "",
    currency: "R$",
    labelWidth: "60",
    labelHeight: "40",
    defaultLowStock: "5",
    lastBackupAt: ""
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value }
    });
  }

  if ((await prisma.inventoryRecord.count()) === 0) {
    const products = await prisma.product.findMany({ take: 8, orderBy: { code: "asc" } });
    for (const [index, product] of products.entries()) {
      const quantity = index % 2 === 0 ? 5 : -2;
      const beforeStock = Math.max(0, product.stock - quantity);
      await prisma.inventoryRecord.create({
        data: {
          productId: product.id,
          operation: quantity > 0 ? InventoryOperation.INBOUND : InventoryOperation.OUTBOUND,
          changeQuantity: quantity,
          beforeStock,
          afterStock: product.stock,
          operatorId: admin.id,
          remark: "系统初始化示例记录",
          createdAt: new Date(Date.now() - index * 86400000)
        }
      });
    }
  }
}

main()
  .then(() => console.log("初始化数据完成。"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
