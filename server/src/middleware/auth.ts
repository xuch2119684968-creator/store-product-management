import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  const cookies = Object.fromEntries((req.headers.cookie || "").split(";").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }));
  const token = cookies[config.authCookieName] || (authorization?.startsWith("Bearer ") ? authorization.slice(7) : "");
  if (!token) {
    return res.status(401).json({ message: "登录已失效，请重新登录。" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience
    });
    if (typeof payload === "string" || !payload.id || !payload.username) {
      return res.status(401).json({ message: "登录凭证无效，请重新登录。" });
    }
    req.user = payload as Request["user"];
    next();
  } catch {
    return res.status(401).json({ message: "登录已过期，请重新登录。" });
  }
}
