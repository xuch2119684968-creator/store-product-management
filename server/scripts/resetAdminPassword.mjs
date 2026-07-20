import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });

const args = process.argv.slice(2);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const username = valueFor("--username")?.trim();
const password = valueFor("--password");

if (!username || !password || !args.includes("--confirm")) {
  console.error("用法：node scripts/resetAdminPassword.mjs --username <用户名> --password <临时密码> --confirm");
  process.exit(1);
}

if (password.length < 8) {
  console.error("临时密码至少需要 8 个字符。");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error("未找到指定管理员账号；未修改任何数据。");
    process.exitCode = 1;
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        mustChangePassword: true
      }
    });
    console.log(`已重置管理员“${user.username}”的密码；下次登录后必须修改密码。`);
  }
} finally {
  await prisma.$disconnect();
}
