import { Prisma } from "@prisma/client";

/** 将 Prisma Decimal 转为 JSON number，保持前端价格字段的既有 API 契约。 */
export function serializeForApi<T>(value: T): T {
  if (value instanceof Prisma.Decimal) return value.toNumber() as T;
  if (Array.isArray(value)) return value.map((item) => serializeForApi(item)) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serializeForApi(item)])) as T;
  }
  return value;
}
