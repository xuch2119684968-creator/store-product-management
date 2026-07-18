import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";
import { requireAuth } from "../middleware/auth";
import { loginRateLimiter } from "../middleware/security";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/http";

const router = Router();

function tokenFor(user: { id: string; username: string }) {
  return jwt.sign({ id: user.id, username: user.username }, config.jwtSecret, {
    algorithm: "HS256",
    subject: user.id,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    expiresIn: "8h"
  });
}

function setSessionCookie(res: import("express").Response, user: { id: string; username: string }) {
  res.cookie(config.authCookieName, tokenFor(user), {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    maxAge: config.authCookieMaxAgeMs,
    path: "/"
  });
}

function clearSessionCookie(res: import("express").Response) {
  res.clearCookie(config.authCookieName, { httpOnly: true, secure: config.isProduction, sameSite: "lax", path: "/" });
}

router.post(
  "/login",
  loginRateLimiter,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        username: z.string().trim().min(1, "请输入用户名。").max(50, "用户名不能超过 50 个字符。"),
        password: z.string().min(1, "请输入密码。").max(256, "密码格式不正确。")
      })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: input.username } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      return res.status(401).json({ message: "用户名或密码错误。" });
    }
    setSessionCookie(res, user);
    return res.json({ user: { id: user.id, username: user.username, mustChangePassword: user.mustChangePassword } });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, username: true, createdAt: true, mustChangePassword: true }
    });
    if (!user) return res.status(401).json({ message: "账号不存在，请重新登录。" });
    return res.json({ user });
  })
);

router.patch(
  "/account",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        username: z.string().trim().min(3, "用户名至少 3 个字符。").max(50),
        currentPassword: z.string().min(1, "请输入当前密码。").max(256, "密码格式不正确。"),
        newPassword: z.string().min(6, "新密码至少 6 位。").max(256, "新密码不能超过 256 位。").optional().or(z.literal(""))
      })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      return res.status(400).json({ message: "当前密码不正确。" });
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        username: input.username,
        ...(input.newPassword ? { passwordHash: await bcrypt.hash(input.newPassword, 12), mustChangePassword: false } : {})
      },
      select: { id: true, username: true, mustChangePassword: true }
    });
    setSessionCookie(res, updated);
    return res.json({ message: input.newPassword ? "管理员密码已更新。" : "管理员账号已更新。", user: updated });
  })
);

router.post("/logout", requireAuth, (_req, res) => {
  clearSessionCookie(res);
  return res.json({ message: "已安全退出登录。" });
});

export default router;
