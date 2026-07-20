import rateLimit from "express-rate-limit";

const rateLimitMessage = (message: string) => ({ message });

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // 登录有独立、更严格的 5 次 / 15 分钟限流。它不应被一般 API 限流的
  // 历史请求计数连带阻塞，否则用户即使输入正确密码也会收到 429。
  skip: (request) => request.path === "/health" || request.path === "/auth/login",
  message: rateLimitMessage("请求过于频繁，请稍后再试。")
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitMessage("登录尝试过于频繁，请 15 分钟后重试。")
});
