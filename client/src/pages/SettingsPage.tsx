import { useEffect, useState } from "react";
import { DatabaseBackup, Download, Save, ShieldCheck, Store, Upload } from "lucide-react";
import { Loading } from "../components/UI";
import { api, download } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import type { Settings } from "../types";

const defaults: Settings = { storeName: "我的店铺", storePhone: "", storeAddress: "", currency: "R$", labelWidth: "60", labelHeight: "40", defaultLowStock: "5", lastBackupAt: "" };

export function SettingsPage() {
  const toast = useToast();
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState({ username: user?.username || "", currentPassword: "", newPassword: "" });

  useEffect(() => {
    api<{ settings: Partial<Settings> }>("/settings")
      .then((result) => setSettings({ ...defaults, ...result.settings }))
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api<{ message: string }>("/settings", { method: "PUT", body: JSON.stringify({ settings }) });
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  };

  const saveAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await api<{ message: string }>("/auth/account", { method: "PATCH", body: JSON.stringify(account) });
      toast.success(result.message + " 请使用新凭证重新登录。");
      await logout();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "账号更新失败。");
    }
  };

  const restore = async (file?: File) => {
    if (!file) return;
    if (!window.confirm("恢复会覆盖当前云端数据。系统会先校验备份并在数据库事务中执行，确认继续吗？")) return;
    const body = new FormData();
    body.append("file", file);
    try {
      const result = await api<{ message: string }>("/backup/restore", { method: "POST", body, headers: { "X-Confirm-Restore": "true" } });
      toast.success(result.message + " 请重新登录。");
      await logout();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "恢复失败。");
    }
  };

  if (loading) return <Loading />;
  return <div className="mx-auto max-w-5xl space-y-5">
    <div><h1 className="page-title">系统设置</h1><p className="page-subtitle">管理门店资料、货币、价签、预警、管理员账号和云端备份</p></div>
    {user?.mustChangePassword && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">为了账户安全，首次登录必须填写当前密码并设置新密码，然后保存管理员账号。</div>}
    <form onSubmit={saveSettings} className="card p-5"><div className="flex items-center gap-3 border-b pb-4"><span className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><Store /></span><div><h2 className="font-bold">门店与业务设置</h2><p className="text-sm text-slate-500">用于价签和价格显示</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="店铺名称"><input className="input" value={settings.storeName} onChange={(e) => setSettings({ ...settings, storeName: e.target.value })} /></Field><Field label="店铺联系电话"><input className="input" value={settings.storePhone} onChange={(e) => setSettings({ ...settings, storePhone: e.target.value })} /></Field><Field label="店铺地址" full><input className="input" value={settings.storeAddress} onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })} /></Field><Field label="默认货币符号"><input className="input" value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} placeholder="R$" /></Field><Field label="默认库存预警值"><input type="number" min="0" className="input" value={settings.defaultLowStock} onChange={(e) => setSettings({ ...settings, defaultLowStock: e.target.value })} /></Field><Field label="价签宽度（mm）"><input type="number" min="30" className="input" value={settings.labelWidth} onChange={(e) => setSettings({ ...settings, labelWidth: e.target.value })} /></Field><Field label="价签高度（mm）"><input type="number" min="20" className="input" value={settings.labelHeight} onChange={(e) => setSettings({ ...settings, labelHeight: e.target.value })} /></Field></div><div className="mt-5 flex justify-end border-t pt-4"><button disabled={saving} className="btn-primary"><Save size={17} />{saving ? "正在保存…" : "保存系统设置"}</button></div></form>
    <section className="card p-5"><div className="flex items-center gap-3 border-b pb-4"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-600"><ShieldCheck /></span><div><h2 className="font-bold">管理员账号设置</h2><p className="text-sm text-slate-500">修改密码需要验证旧密码，并会刷新安全登录会话</p></div></div><form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={saveAccount}><Field label="新用户名"><input required minLength={3} className="input" value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} /></Field><Field label="当前密码"><input required type="password" className="input" value={account.currentPassword} onChange={(e) => setAccount({ ...account, currentPassword: e.target.value })} /></Field><Field label="新密码（首次登录必须填写）"><input required={Boolean(user?.mustChangePassword)} type="password" minLength={6} className="input" value={account.newPassword} onChange={(e) => setAccount({ ...account, newPassword: e.target.value })} /></Field><div className="flex items-end"><button className="btn-primary"><Save size={17} />保存管理员账号</button></div></form></section>
    <section className="card p-5"><div className="flex items-center gap-3 border-b pb-4"><span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600"><DatabaseBackup /></span><div><h2 className="font-bold">云端数据备份与恢复</h2><p className="text-sm text-slate-500">下载完整逻辑备份；云数据库另有平台时间点恢复</p></div></div><div className="mt-5 flex flex-col justify-between gap-4 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center"><div><p className="font-medium">最近一次备份</p><p className="mt-1 text-sm text-slate-500">{settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString("zh-CN") : "尚未备份"}</p></div><div className="flex flex-wrap gap-3"><button type="button" className="btn-primary" onClick={() => void download("/backup/download", "store-backup.json")}><Download size={17} />下载完整备份</button><label className="btn-secondary cursor-pointer"><Upload size={17} />从备份恢复<input className="hidden" type="file" accept=".json" onChange={(e) => void restore(e.target.files?.[0])} /></label></div></div><p className="mt-3 text-xs leading-5 text-slate-500">恢复前必须确认；服务器会先校验备份格式，并在数据库事务中完成恢复，失败时不会写入半份数据。</p></section>
    <p className="text-center text-xs text-slate-400">商品管理系统 v2.0 · 云端正式版</p>
  </div>;
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={full ? "md:col-span-2" : ""}><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}
