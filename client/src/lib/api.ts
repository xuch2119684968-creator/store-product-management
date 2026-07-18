const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const crossOriginApi = /^https?:\/\//.test(API_BASE);

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(API_BASE + path, { ...init, headers, credentials: crossOriginApi ? "include" : "same-origin" });
  if (response.status === 401) {
    window.dispatchEvent(new Event("store:unauthorized"));
  }
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new ApiError(body?.message || "请求失败，请稍后重试。", response.status);
  return body as T;
}

export async function download(path: string, filename: string) {
  const response = await fetch(API_BASE + path, { credentials: crossOriginApi ? "include" : "same-origin" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.message || "下载失败。", response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
