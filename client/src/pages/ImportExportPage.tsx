import { useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Loading } from "../components/UI";
import { api, download } from "../lib/api";
import { useToast } from "../context/ToastContext";

type PreviewRow = { row: number; code: string; name: string; category: string; stock: number; retailPrice: number; errors: string[] } & Record<string, unknown>;

export function ImportExportPage() {
  const toast = useToast();
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [fileName, setFileName] = useState("");
  const preview = async (file?: File) => {
    if (!file) return;
    setPreviewing(true); setRows([]); setFileName(file.name);
    const body = new FormData(); body.append("file", file);
    try {
      const result = await api<{ rows: PreviewRow[]; total: number; valid: number; invalid: number }>("/import-export/preview", { method: "POST", body });
      setRows(result.rows);
      toast.success("已读取 " + result.total + " 行：有效 " + result.valid + " 行，无效 " + result.invalid + " 行。");
    } catch (e) { toast.error(e instanceof Error ? e.message : "预览失败。"); }
    finally { setPreviewing(false); }
  };
  const commit = async () => {
    if (!rows.length) return;
    setCommitting(true);
    try {
      const result = await api<{ message: string; imported: number; failures: { row: number; reason: string }[] }>("/import-export/commit", { method: "POST", body: JSON.stringify({ rows }) });
      toast.success(result.message + " 成功导入 " + result.imported + " 条。" + (result.failures.length ? " 另有 " + result.failures.length + " 条失败。" : ""));
      setRows([]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "导入失败。"); }
    finally { setCommitting(false); }
  };
  const valid = rows.filter((item) => !item.errors.length).length;
  return <div className="space-y-5"><div><h1 className="page-title">数据导入导出</h1><p className="page-subtitle">支持 CSV / Excel 批量导入，导入前会检查每一行数据</p></div><div className="grid gap-5 lg:grid-cols-2"><section className="card p-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-brand-50 p-3 text-brand-600"><Upload /></span><div><h2 className="font-bold">批量导入商品</h2><p className="mt-1 text-sm text-slate-500">CSV、XLSX、XLS，单次最多 2000 条</p></div></div><div className="mt-5 flex flex-wrap gap-3"><label className="btn-primary cursor-pointer"><FileSpreadsheet size={17} />选择文件并预览<input className="hidden" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => void preview(e.target.files?.[0])} /></label><button className="btn-secondary" onClick={() => void download("/import-export/template", "商品导入模板.xlsx")}><Download size={17} />下载标准模板</button></div><p className="mt-4 text-xs leading-5 text-slate-500">必填字段：商品编号、商品名称、分类、进货价、零售价、会员价、库存、库存预警值。分类需要先在“分类管理”中创建。</p></section><section className="card p-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><Download /></span><div><h2 className="font-bold">导出业务数据</h2><p className="mt-1 text-sm text-slate-500">导出为 Excel 文件，便于备份和分析</p></div></div><div className="mt-5 flex flex-wrap gap-3"><button className="btn-secondary" onClick={() => void download("/import-export/products", "商品数据.xlsx")}><FileSpreadsheet size={17} />导出全部商品</button><button className="btn-secondary" onClick={() => void download("/import-export/inventory-records", "库存记录.xlsx")}><FileSpreadsheet size={17} />导出库存记录</button></div></section></div>{previewing ? <Loading text="正在解析导入文件…" /> : rows.length > 0 && <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="font-bold">导入预览：{fileName}</h2><p className="mt-1 text-sm text-slate-500">共 {rows.length} 行，可导入 {valid} 行；错误行会被跳过并不会影响其他数据。</p></div><button disabled={!valid || committing} onClick={() => void commit()} className="btn-primary disabled:opacity-50">{committing ? "正在导入…" : "确认导入有效数据"}</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>行号</th><th>商品编号</th><th>商品名称</th><th>分类</th><th>零售价</th><th>库存</th><th>校验结果</th></tr></thead><tbody>{rows.slice(0, 100).map((row) => <tr key={row.row} className={row.errors.length ? "bg-rose-50/50" : ""}><td>{row.row}</td><td>{row.code}</td><td>{row.name}</td><td>{row.category}</td><td>{row.retailPrice}</td><td>{row.stock}</td><td>{row.errors.length ? <span className="text-rose-600">{row.errors.join("；")}</span> : <span className="text-emerald-600">可导入</span>}</td></tr>)}</tbody></table></div>{rows.length > 100 && <p className="border-t p-4 text-sm text-slate-500">为便于浏览，仅显示前 100 行预览；导入会处理全部 {rows.length} 行。</p>}</section>}</div>;
}
