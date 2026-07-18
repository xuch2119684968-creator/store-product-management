import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Edit3, ImageUp, Plus, Search, Trash2 } from "lucide-react";
import { Empty, Loading, Modal, PaginationBar, Price, ProductImage, StockBadge } from "../components/UI";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import type { Category, Pagination, Product, Status, Supplier } from "../types";

type ProductForm = {
  code: string; barcode: string; name: string; categoryId: string; imagePath: string; specification: string; color: string; size: string;
  purchasePrice: number; retailPrice: number; memberPrice: number; stock: number; lowStock: number; supplierId: string; location: string; remark: string; status: Status;
};
const blank = (categoryId = ""): ProductForm => ({ code: "", barcode: "", name: "", categoryId, imagePath: "", specification: "", color: "", size: "", purchasePrice: 0, retailPrice: 0, memberPrice: 0, stock: 0, lowStock: 5, supplierId: "", location: "", remark: "", status: "ON_SALE" });

export function ProductsPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [sort, setSort] = useState("retailPrice");
  const [order, setOrder] = useState("desc");
  const [selected, setSelected] = useState<string[]>([]);
  const [form, setForm] = useState<ProductForm>(blank());
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkAction, setBulkAction] = useState("status");
  const [bulkValue, setBulkValue] = useState("");

  const loadOptions = useCallback(async () => {
    const [categoryResult, supplierResult] = await Promise.all([api<{ categories: Category[] }>("/categories"), api<{ suppliers: Supplier[] }>("/suppliers")]);
    setCategories(categoryResult.categories); setSuppliers(supplierResult.suppliers);
  }, []);
  const loadProducts = useCallback(async (page = pagination.page) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pagination.pageSize), sort, order });
      if (search.trim()) query.set("search", search.trim());
      if (categoryId) query.set("categoryId", categoryId);
      if (status) query.set("status", status);
      if (stockStatus) query.set("stockStatus", stockStatus);
      const result = await api<{ products: Product[]; pagination: Pagination }>("/products?" + query);
      setProducts(result.products); setPagination(result.pagination); setSelected([]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "商品加载失败。"); }
    finally { setLoading(false); }
  }, [search, categoryId, status, stockStatus, sort, order, pagination.pageSize, pagination.page, toast]);
  useEffect(() => { loadOptions().catch((error) => toast.error(error.message)); }, [loadOptions, toast]);
  useEffect(() => { const timer = setTimeout(() => void loadProducts(1), 220); return () => clearTimeout(timer); }, [search, categoryId, status, stockStatus, sort, order]);
  useEffect(() => { void loadProducts(pagination.page); }, []);

  const allSelected = products.length > 0 && selected.length === products.length;
  const change = (key: keyof ProductForm, value: string | number) => setForm((current) => ({ ...current, [key]: value }));
  const newProduct = () => { setEditing(null); setForm(blank(categories[0]?.id)); setShowForm(true); };
  const editProduct = (product: Product) => {
    setEditing(product);
    setForm({ code: product.code, barcode: product.barcode || "", name: product.name, categoryId: product.categoryId, imagePath: product.imagePath || "", specification: product.specification, color: product.color, size: product.size, purchasePrice: product.purchasePrice, retailPrice: product.retailPrice, memberPrice: product.memberPrice, stock: product.stock, lowStock: product.lowStock, supplierId: product.supplierId || "", location: product.location, remark: product.remark, status: product.status });
    setShowForm(true);
  };
  const upload = async (file?: File) => {
    if (!file) return;
    const body = new FormData(); body.append("image", file);
    try { const result = await api<{ imagePath: string }>("/uploads/image", { method: "POST", body }); change("imagePath", result.imagePath); toast.success("图片上传成功。"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "图片上传失败。"); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      const result = await api<{ message: string }>(editing ? "/products/" + editing.id : "/products", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      toast.success(result.message); setShowForm(false); await loadProducts();
    } catch (error) { toast.error(error instanceof Error ? error.message : "保存失败。"); }
    finally { setSaving(false); }
  };
  const remove = async (product: Product) => {
    if (!window.confirm("确定删除“" + product.name + "”吗？删除后无法恢复。")) return;
    try { const result = await api<{ message: string }>("/products/" + product.id, { method: "DELETE" }); toast.success(result.message); await loadProducts(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "删除失败。"); }
  };
  const copy = async (product: Product) => {
    try { const result = await api<{ message: string }>("/products/" + product.id + "/copy", { method: "POST" }); toast.success(result.message); await loadProducts(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "复制失败。"); }
  };
  const bulk = async () => {
    if (!selected.length) return;
    if (bulkAction === "delete" && !window.confirm("确定删除选中的 " + selected.length + " 件商品吗？")) return;
    const payload: Record<string, unknown> = { ids: selected, action: bulkAction };
    if (bulkAction === "category") payload.categoryId = bulkValue;
    if (bulkAction === "status") payload.status = bulkValue || "ON_SALE";
    if (bulkAction === "price") payload.retailPrice = Number(bulkValue);
    try { const result = await api<{ message: string }>("/products/bulk", { method: "POST", body: JSON.stringify(payload) }); toast.success(result.message); await loadProducts(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "批量操作失败。"); }
  };
  const lowCount = useMemo(() => products.filter((item) => item.stock <= item.lowStock).length, [products]);

  return <div className="space-y-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="page-title">商品管理</h1><p className="page-subtitle">管理商品、价格、图片、状态与库存预警</p></div><button className="btn-primary" onClick={newProduct}><Plus size={18} />新增商品</button></div><section className="card p-4"><div className="grid gap-3 lg:grid-cols-6"><label className="relative lg:col-span-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" placeholder="名称、编号、条形码或规格" /></label><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="select"><option value="">全部分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)} className="select"><option value="">全部状态</option><option value="ON_SALE">在售</option><option value="OFF_SALE">停售</option></select><select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)} className="select"><option value="">全部库存</option><option value="LOW">库存预警</option><option value="OUT">缺货</option><option value="NORMAL">库存正常</option></select><select value={sort + ":" + order} onChange={(e) => { const [nextSort, nextOrder] = e.target.value.split(":"); setSort(nextSort); setOrder(nextOrder); }} className="select"><option value="retailPrice:desc">价格从高到低</option><option value="retailPrice:asc">价格从低到高</option><option value="stock:desc">库存从高到低</option><option value="stock:asc">库存从低到高</option></select></div></section>{selected.length > 0 && <section className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm"><span className="font-semibold text-brand-700">已选 {selected.length} 件</span><select value={bulkAction} onChange={(e) => { setBulkAction(e.target.value); setBulkValue(""); }} className="select w-auto py-1.5"><option value="status">批量设置状态</option><option value="category">批量修改分类</option><option value="price">批量修改零售价</option><option value="delete">批量删除</option></select>{bulkAction === "status" && <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="select w-auto py-1.5"><option value="ON_SALE">上架（在售）</option><option value="OFF_SALE">停售</option></select>}{bulkAction === "category" && <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="select w-auto py-1.5"><option value="">选择分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}{bulkAction === "price" && <input className="input w-32 py-1.5" inputMode="decimal" type="number" min="0" placeholder="零售价" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />}<button className={bulkAction === "delete" ? "btn-danger" : "btn-primary"} onClick={bulk}>{bulkAction === "delete" ? "删除选中商品" : "确认批量操作"}</button></section>}<section className="card">{loading ? <Loading /> : products.length === 0 ? <Empty text="没有符合条件的商品" /> : <><div className="table-wrap"><table className="data-table"><thead><tr><th><input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? products.map((item) => item.id) : [])} /></th><th>商品</th><th>分类</th><th>售价</th><th>库存</th><th>状态</th><th>更新时间</th><th>操作</th></tr></thead><tbody>{products.map((product) => <tr key={product.id} className={product.stock <= product.lowStock ? "bg-amber-50/40" : ""}><td><input type="checkbox" checked={selected.includes(product.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} /></td><td><div className="flex items-center gap-3"><ProductImage product={product} className="h-10 w-10 rounded-lg" /><div className="min-w-0"><p className="max-w-48 truncate font-semibold">{product.name}</p><p className="mt-0.5 text-xs text-slate-500">{product.code}{product.barcode ? " · " + product.barcode : ""}</p></div></div></td><td>{product.category.name}</td><td><Price value={product.retailPrice} /></td><td><StockBadge stock={product.stock} lowStock={product.lowStock} /></td><td><span className={"rounded-full px-2 py-1 text-xs font-medium " + (product.status === "ON_SALE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{product.status === "ON_SALE" ? "在售" : "停售"}</span></td><td className="whitespace-nowrap text-xs text-slate-500">{new Date(product.updatedAt).toLocaleDateString("zh-CN")}</td><td><div className="flex gap-1"><button className="btn-secondary !p-2" title="编辑" onClick={() => editProduct(product)}><Edit3 size={15} /></button><button className="btn-secondary !p-2" title="复制商品" onClick={() => copy(product)}><Copy size={15} /></button><button className="btn-danger !p-2" title="删除商品" onClick={() => remove(product)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div><PaginationBar {...pagination} onPage={(page) => void loadProducts(page)} /><div className="px-4 pb-3 text-xs text-slate-400">本页 {products.length} 件商品，其中 {lowCount} 件达到库存预警。</div></>}</section>{showForm && <Modal title={editing ? "编辑商品" : "新增商品"} onClose={() => setShowForm(false)} wide><form onSubmit={save} className="p-5"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Field label="商品编号 *"><input required className="input" value={form.code} onChange={(e) => change("code", e.target.value)} /></Field><Field label="条形码"><input className="input" value={form.barcode} onChange={(e) => change("barcode", e.target.value)} /></Field><Field label="商品名称 *"><input required className="input" value={form.name} onChange={(e) => change("name", e.target.value)} /></Field><Field label="分类 *"><select required className="select" value={form.categoryId} onChange={(e) => change("categoryId", e.target.value)}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="商品状态"><select className="select" value={form.status} onChange={(e) => change("status", e.target.value as Status)}><option value="ON_SALE">在售</option><option value="OFF_SALE">停售</option></select></Field><Field label="商品规格"><input className="input" value={form.specification} onChange={(e) => change("specification", e.target.value)} /></Field><Field label="颜色"><input className="input" value={form.color} onChange={(e) => change("color", e.target.value)} /></Field><Field label="尺码"><input className="input" value={form.size} onChange={(e) => change("size", e.target.value)} /></Field><Field label="进货价"><input className="input" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(e) => change("purchasePrice", Number(e.target.value))} /></Field><Field label="零售价 *"><input className="input" type="number" min="0" step="0.01" value={form.retailPrice} onChange={(e) => change("retailPrice", Number(e.target.value))} /></Field><Field label="会员价"><input className="input" type="number" min="0" step="0.01" value={form.memberPrice} onChange={(e) => change("memberPrice", Number(e.target.value))} /></Field><Field label="当前库存"><input className="input disabled:bg-slate-100" type="number" min="0" value={form.stock} disabled={Boolean(editing)} onChange={(e) => change("stock", Number(e.target.value))} /><p className="mt-1 text-xs text-slate-400">{editing ? "编辑商品时请通过库存管理调整库存。" : "新增商品将自动生成入库记录。"}</p></Field><Field label="库存预警值"><input className="input" type="number" min="0" value={form.lowStock} onChange={(e) => change("lowStock", Number(e.target.value))} /></Field><Field label="供应商"><select className="select" value={form.supplierId} onChange={(e) => change("supplierId", e.target.value)}><option value="">未设置</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="存放位置"><input className="input" value={form.location} onChange={(e) => change("location", e.target.value)} /></Field><Field label="商品图片"><div className="flex items-center gap-3"><label className="btn-secondary cursor-pointer"><ImageUp size={16} />上传<input className="hidden" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(e) => void upload(e.target.files?.[0])} /></label>{form.imagePath && <img src={form.imagePath} className="h-9 w-9 rounded object-cover" />}</div></Field><Field label="备注" full><textarea className="input min-h-20" value={form.remark} onChange={(e) => change("remark", e.target.value)} /></Field></div><div className="mt-6 flex justify-end gap-3 border-t pt-5"><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>取消</button><button disabled={saving} className="btn-primary">{saving ? "正在保存…" : "保存商品"}</button></div></form></Modal>}</div>;
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={full ? "md:col-span-2 xl:col-span-3" : ""}><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}
