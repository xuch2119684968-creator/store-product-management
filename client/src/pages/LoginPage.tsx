import { useState } from "react";
import { LockKeyhole, Store } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try { await login(username, password); navigate("/"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "登录失败。"); }
    finally { setSubmitting(false); }
  };
  return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-950 via-brand-700 to-sky-500 p-5"><section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9"><div className="mb-8 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg"><Store size={27} /></div><h1 className="text-2xl font-bold text-slate-900">商品管理系统</h1><p className="mt-2 text-sm text-slate-500">请使用管理员账号登录系统</p></div><form className="space-y-5" onSubmit={submit}><label className="block text-sm font-medium text-slate-700">用户名<input value={username} onChange={(e) => setUsername(e.target.value)} className="input mt-2" autoComplete="username" required /></label><label className="block text-sm font-medium text-slate-700">密码<input value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-2" type="password" autoComplete="current-password" required /></label><button disabled={submitting} className="btn-primary w-full py-3 disabled:opacity-60"><LockKeyhole size={18} />{submitting ? "正在登录…" : "登录系统"}</button></form><p className="mt-6 rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-500">首次登录后请立即在“系统设置”中修改默认密码。</p></section></main>;
}
