import rateLimit from "express-rate-limit";

const rateLimitMessage = (message: string) => ({ message });

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (request) => request.path === "/health",
  message: rateLimitMessage("请求过于频繁，请稍后再试。")
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitMessage("登录尝试过于频繁，请 15 分钟后重试。")
});
