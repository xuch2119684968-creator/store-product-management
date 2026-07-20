import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type AuthUser = { id: string; username: string; mustChangePassword: boolean };
type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const logout = async () => {
    await api<{ message: string }>("/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
  };
  useEffect(() => {
    api<{ user: AuthUser }>("/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    // 收到 401 只清除前端状态。若这里再请求 /auth/logout，退出接口本身的 401
    // 会再次触发该事件，形成无限请求循环并误触发全局限流，进而阻断正常登录。
    const onUnauthorized = () => { setUser(null); };
    window.addEventListener("store:unauthorized", onUnauthorized);
    return () => window.removeEventListener("store:unauthorized", onUnauthorized);
  }, []);
  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    logout,
    login: async (username, password) => {
      const result = await api<{ user: AuthUser }>("/auth/login", {
        method: "POST", body: JSON.stringify({ username, password })
      });
      setUser(result.user);
    }
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth 必须在 AuthProvider 中使用。");
  return context;
}
