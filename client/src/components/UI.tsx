import { AlertTriangle, Loader2, PackageOpen, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { money } from "../lib/format";
import type { Product } from "../types";

export function Loading({ text = "正在加载数据…" }: { text?: string }) {
  return <div className="flex min-h-52 items-center justify-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={20} />{text}</div>;
}

export function Empty({ text = "暂无数据" }: { text?: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-slate-400"><PackageOpen size={42} strokeWidth={1.3} /><span>{text}</span></div>;
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-5" onMouseDown={onClose}>
      <section className={"max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl " + (wide ? "sm:max-w-5xl" : "sm:max-w-2xl")} onMouseDown={(event) => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></header>
        {children}
      </section>
    </div>
  );
}

export function ProductImage({ product, className = "" }: { product: Pick<Product, "name" | "imagePath">; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (product.imagePath && !failed) return <img src={product.imagePath} alt={product.name} className={"object-cover " + className} onError={() => setFailed(true)} />;
  return <div className={"flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50 text-2xl " + className}>🛍️</div>;
}

export function StockBadge({ stock, lowStock }: { stock: number; lowStock: number }) {
  const low = stock <= lowStock;
  return <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold " + (low ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700")}>{low && <AlertTriangle size={13} />}{stock}{low ? "（预警）" : ""}</span>;
}

export function Price({ value, currency = "R$" }: { value: number; currency?: string }) {
  return <span className="font-bold text-rose-600">{money(value, currency)}</span>;
}

export function PaginationBar({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-slate-500"><span>共 {total} 条，第 {page}/{pages} 页</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => onPage(page - 1)} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40">上一页</button><button disabled={page >= pages} onClick={() => onPage(page + 1)} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40">下一页</button></div></div>;
}
