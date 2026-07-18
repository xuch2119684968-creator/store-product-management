import { useState } from "react";
import { BarChart3, Boxes, ClipboardList, FolderTree, Home, Import, LogOut, Menu, PackageSearch, Printer, ScanLine, Settings, X } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  ["/", "首页", Home],
  ["/lookup", "快速查价", ScanLine],
  ["/products", "商品管理", Boxes],
  ["/categories", "分类管理", FolderTree],
  ["/inventory", "库存管理", PackageSearch],
  ["/inventory-records", "库存记录", ClipboardList],
  ["/labels", "价签打印", Printer],
  ["/import-export", "数据导入导出", Import],
  ["/settings", "系统设置", Settings]
] as const;

export function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const exit = () => { logout(); navigate("/login"); };
  const navigation = <nav className="space-y-1 px-3">{navItems.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)} className={({ isActive }) => "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition " + (isActive ? "bg-brand-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white")}><Icon size={19} />{label}</NavLink>)}</nav>;
  return (
    <div className="min-h-screen bg-slate-50">
      {open && <button className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" aria-label="关闭菜单" onClick={() => setOpen(false)} />}
      <aside className={"no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 transition-transform lg:translate-x-0 " + (open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-18 items-center justify-between px-5 py-4"><div><p className="text-base font-bold text-white">商品管理系统</p><p className="mt-0.5 text-xs text-slate-400">线下门店内部使用</p></div><button className="text-slate-400 lg:hidden" onClick={() => setOpen(false)}><X /></button></div>
        <div className="flex-1 overflow-y-auto py-2">{navigation}</div>
        <div className="border-t border-slate-800 p-3"><div className="mb-2 px-3 text-xs text-slate-400">当前用户：{user?.username}</div><button onClick={exit} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 hover:bg-rose-500/15 hover:text-rose-300"><LogOut size={19} />退出登录</button></div>
      </aside>
      <main className="min-h-screen lg:pl-64"><header className="no-print sticky top-0 z-20 flex h-16 items-center border-b bg-white/90 px-4 backdrop-blur sm:px-6"><button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}><Menu /></button><div className="ml-auto flex items-center gap-2 text-sm text-slate-500"><BarChart3 size={17} className="text-brand-600" />商品、库存与价签一体管理</div></header><div className="mx-auto max-w-[1600px] p-4 sm:p-6"><Outlet /></div></main>
    </div>
  );
}
