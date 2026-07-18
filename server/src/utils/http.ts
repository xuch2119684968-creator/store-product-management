import type { NextFunction, Request, Response } from "express";

export type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function pagination(query: Record<string, unknown>) {
  const positiveInteger = (value: unknown, fallback: number) => {
    if (typeof value !== "string" && typeof value !== "number") return fallback;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  // 限制深分页，避免恶意超大 offset 给 SQLite 带来不必要的扫描开销。
  const page = Math.min(100_000, positiveInteger(query.page, 1));
  const pageSize = Math.min(100, positiveInteger(query.pageSize, 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
}
