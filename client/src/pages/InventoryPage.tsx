import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Search, SlidersHorizontal } from "lucide-react";
import { Empty, Loading, Modal, ProductImage, StockBadge } from "../components/UI";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import type { Product } from "../types";

type Operation = "INBOUND" | "OUTBOUND" | "ADJUSTMENT" | "STOCKTAKE";

export function InventoryPage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [operation, setOperation] = useState<Operation>("INBOUND");
  const [quantity, setQuantity] = useState(1);
  const [actualStock, setActualStock] = useState(0);
  const [remark, setRemark] = useState("");
  useEffect(() => {
    if (!query.trim()) { setProducts([]); return; }
    const timer = setTimeout(async () => { setLoading(true); try { const result = await api<{ products: Product[] }>("/products/lookup?q=" + encodeURIComponent(query)); setProducts(result.products); } catch (e) { toast.error(e instanceof Error ? e.message : "查询失败。"); } finally { setLoading(false); } }, 180);
    return () => clearTimeout(timer);
  }, [query]);
  const open = (product: Product) => { setSelected(product); setQuantity(1); setActualStock(product.stock); setRemark(""); setOperation("INBOUND"); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    try {
      const result = await api<{ message: string; product: Product }>("/inventory/change", { method: "POST", body: JSON.stringify({ productId: selected.id, operation, quantity, actualStock, remark }) });
      toast.success(result.message); setSelected(null); setQuery(""); setProducts([]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "库存更新失败。"); }
  };
  const icon = operation === "INBOUND" ? <ArrowDownToLine className="text-emerald-600" /> : operation === "OUTBOUND" ? <ArrowUpFromLine className="text-rose-600" /> : <SlidersHorizontal className="text-brand-600" />;
  return <div className="mx-auto max-w-5xl space-y-5"><div><h1 className="page-title">库存管理</h1><p className="page-subtitle">通过入库、出库、调整和盘点维护准确库存；每次操作都会保留记录</p></div><section className="card p-5"><label className="relative block"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input autoFocus className="input py-4 pl-11 text-base" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索商品名称、编号或条形码，选择后进行库存操作" /></label><p className="mt-3 text-xs text-slate-500">支持扫码枪直接输入条形码。库存不能调整为负数。</p></section>{loading ? <Loading text="正在查找商品…" /> : query && !products.length ? <Empty text="未找到商品" /> : <div className="grid gap-3 md:grid-cols-2">{products.map((product) => <button onClick={() => open(product)} key={product.id} className="card flex items-center gap-4 p-4 text-left hover:border-brand-300 hover:shadow-sm"><ProductImage product={product} className="h-16 w-16 rounded-xl" /><div className="min-w-0 flex-1"><p className="truncate font-bold">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.code} · {product.specification || "无规格"}</p><div className="mt-2"><StockBadge stock={product.stock} lowStock={product.lowStock} /></div></div></button>)}</div>}{selected && <Modal title="库存操作" onClose={() => setSelected(null)}><form onSubmit={save} className="space-y-5 p-5"><div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><ProductImage product={selected} className="h-14 w-14 rounded-lg" /><div><p className="font-bold">{selected.name}</p><p className="text-sm text-slate-500">{selected.code} · 当前库存 {selected.stock}</p></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([["INBOUND", "入库", ArrowDownToLine], ["OUTBOUND", "出库", ArrowUpFromLine], ["ADJUSTMENT", "调整", SlidersHorizontal], ["STOCKTAKE", "盘点", ClipboardCheck]] as const).map(([value, label, Icon]) => <button type="button" key={value} onClick={() => setOperation(value)} className={"flex flex-col items-center gap-1 rounded-xl border p-3 text-sm font-medium " + (operation === value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600")}><Icon size={19} />{label}</button>)}</div><div className="rounded-xl border border-slate-200 p-4">{icon}<p className="mt-2 font-medium">{operation === "INBOUND" ? "商品入库" : operation === "OUTBOUND" ? "商品出库" : operation === "STOCKTAKE" ? "库存盘点" : "库存调整"}</p><p className="mt-1 text-sm text-slate-500">{operation === "STOCKTAKE" ? "填写盘点后的实际库存，系统将自动计算差异。" : operation === "ADJUSTMENT" ? "正数增加库存，负数减少库存。" : operation === "INBOUND" ? "填写本次入库数量。" : "填写本次出库数量，不能超过现有库存。"}</p></div>{operation === "STOCKTAKE" ? <label><span className="mb-1.5 block text-sm font-medium">实际库存 *</span><input className="input" type="number" min="0" value={actualStock} onChange={(e) => setActualStock(Number(e.target.value))} /></label> : <label><span className="mb-1.5 block text-sm font-medium">{operation === "ADJUSTMENT" ? "调整数量（可填负数）" : "数量 *"}</span><input className="input" type="number" min={operation === "ADJUSTMENT" ? undefined : 1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></label>}<label><span className="mb-1.5 block text-sm font-medium">备注</span><textarea className="input min-h-20" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="例如：供应商到货、门店销售、盘点差异原因" /></label><div className="flex justify-end gap-3 border-t pt-4"><button className="btn-secondary" type="button" onClick={() => setSelected(null)}>取消</button><button className="btn-primary">确认保存</button></div></form></Modal>}</div>;
}
