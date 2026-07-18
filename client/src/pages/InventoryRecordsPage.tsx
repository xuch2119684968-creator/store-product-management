import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Empty, Loading, PaginationBar } from "../components/UI";
import { api } from "../lib/api";
import { dateTime, operationText } from "../lib/format";
import { useToast } from "../context/ToastContext";
import type { InventoryRecord, Pagination } from "../types";

export function InventoryRecordsPage() {
  const toast = useToast();
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async (page = 1) => { setLoading(true); try { const result = await api<{ records: InventoryRecord[]; pagination: Pagination }>("/inventory/records?search=" + encodeURIComponent(search) + "&page=" + page + "&pageSize=20"); setRecords(result.records); setPagination(result.pagination); } catch (e) { toast.error(e instanceof Error ? e.message : "加载失败。"); } finally { setLoading(false); } };
  useEffect(() => { const timer = setTimeout(() => void load(1), 200); return () => clearTimeout(timer); }, [search]);
  return <div className="space-y-5"><div><h1 className="page-title">库存记录</h1><p className="page-subtitle">所有入库、出库、调整、盘点和导入操作均可追溯</p></div><section className="card p-4"><label className="relative block max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" placeholder="搜索商品名称、编号或条形码" /></label></section><section className="card">{loading ? <Loading /> : !records.length ? <Empty text="暂无库存记录" /> : <><div className="table-wrap"><table className="data-table"><thead><tr><th>操作时间</th><th>商品</th><th>类型</th><th>变化数量</th><th>操作前</th><th>操作后</th><th>操作人员</th><th>备注</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td className="whitespace-nowrap text-xs text-slate-500">{dateTime(record.createdAt)}</td><td><p className="font-medium">{record.product.name}</p><p className="text-xs text-slate-500">{record.product.code}</p></td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{operationText[record.operation]}</span></td><td className={record.changeQuantity > 0 ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>{record.changeQuantity > 0 ? "+" : ""}{record.changeQuantity}</td><td>{record.beforeStock}</td><td>{record.afterStock}</td><td>{record.operator?.username || "系统"}</td><td className="max-w-64 truncate text-slate-500">{record.remark || "—"}</td></tr>)}</tbody></table></div><PaginationBar {...pagination} onPage={(page) => void load(page)} /></>}</section></div>;
}
