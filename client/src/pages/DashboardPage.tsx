import { useEffect, useState } from "react";
import { AlertTriangle, Box, Boxes, ChartNoAxesCombined, FolderTree, PackageCheck, PackageX, PlusCircle, Warehouse } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { Loading, Empty, StockBadge } from "../components/UI";
import { api } from "../lib/api";
import { dateTime, operationText } from "../lib/format";
import type { InventoryRecord, Product } from "../types";

type Dashboard = {
  summary: { totalProducts: number; onSaleProducts: number; offSaleProducts: number; categoryCount: number; totalStock: number; lowStock: number; todayNewProducts: number };
  categoryStats: { name: string; productCount: number; stock: number }[];
  lowStockRanking: (Product & { category: { name: string } })[];
  trend: { date: string; 入库: number; 出库: number }[];
  recentRecords: InventoryRecord[];
};

const cards = [
  ["商品总数", "totalProducts", Box, "/products", "text-brand-600 bg-brand-50"],
  ["在售商品", "onSaleProducts", PackageCheck, "/products?status=ON_SALE", "text-emerald-600 bg-emerald-50"],
  ["停售商品", "offSaleProducts", PackageX, "/products?status=OFF_SALE", "text-slate-600 bg-slate-100"],
  ["商品分类", "categoryCount", FolderTree, "/categories", "text-violet-600 bg-violet-50"],
  ["当前库存", "totalStock", Warehouse, "/products", "text-cyan-600 bg-cyan-50"],
  ["库存不足", "lowStock", AlertTriangle, "/products?stockStatus=LOW", "text-amber-600 bg-amber-50"],
  ["今日新增", "todayNewProducts", PlusCircle, "/products", "text-pink-600 bg-pink-50"]
] as const;

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Dashboard>("/dashboard").then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <div className="card p-6 text-rose-600">{error}</div>;
  if (!data) return <Loading />;
  return <div className="space-y-6"><div><h1 className="page-title">首页仪表盘</h1><p className="page-subtitle">一眼查看商品、库存与近期业务动态</p></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">{cards.map(([label, key, Icon, link, color]) => <Link key={key} to={link} className="card p-4 hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between"><span className={"rounded-xl p-2.5 " + color}><Icon size={20} /></span><ChartNoAxesCombined size={16} className="text-slate-300" /></div><p className="mt-4 text-2xl font-bold text-slate-900">{data.summary[key]}</p><p className="mt-1 text-xs font-medium text-slate-500">{label}</p></Link>)}</div><div className="grid gap-6 xl:grid-cols-2"><section className="card p-5"><h2 className="mb-4 font-bold">各分类商品与库存</h2><div className="h-72">{data.categoryStats.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.categoryStats}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Legend /><Bar dataKey="productCount" name="商品数量" fill="#1d68d9" radius={[5, 5, 0, 0]} /><Bar dataKey="stock" name="库存数量" fill="#14b8a6" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty />}</div></section><section className="card p-5"><h2 className="mb-4 font-bold">最近七天入库 / 出库趋势</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Bar dataKey="入库" fill="#10b981" radius={[5, 5, 0, 0]} /><Bar dataKey="出库" fill="#f97316" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></section></div><div className="grid gap-6 xl:grid-cols-2"><section className="card"><div className="flex items-center justify-between border-b p-5"><h2 className="font-bold">库存不足商品</h2><Link className="text-sm font-medium text-brand-600" to="/products?stockStatus=LOW">查看全部</Link></div>{data.lowStockRanking.length ? <div className="divide-y">{data.lowStockRanking.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 px-5 py-3"><div><p className="font-medium">{product.name}</p><p className="mt-0.5 text-xs text-slate-500">{product.code} · {product.category.name}</p></div><StockBadge stock={product.stock} lowStock={product.lowStock} /></div>)}</div> : <Empty text="暂无库存预警商品" />}</section><section className="card"><div className="border-b p-5"><h2 className="font-bold">最近库存变动</h2></div>{data.recentRecords.length ? <div className="divide-y">{data.recentRecords.map((record) => <div key={record.id} className="flex items-center justify-between gap-3 px-5 py-3"><div><p className="font-medium">{record.product.name} <span className={record.changeQuantity > 0 ? "text-emerald-600" : "text-rose-600"}>{record.changeQuantity > 0 ? "+" : ""}{record.changeQuantity}</span></p><p className="mt-0.5 text-xs text-slate-500">{operationText[record.operation]} · {record.operator?.username || "系统"} · {dateTime(record.createdAt)}</p></div><span className="text-xs text-slate-500">库存 {record.afterStock}</span></div>)}</div> : <Empty text="暂无库存变动记录" />}</section></div></div>;
}
