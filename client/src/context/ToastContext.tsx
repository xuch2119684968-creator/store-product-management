import { createContext, useContext, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type ToastContextValue = { success: (message: string) => void; error: (message: string) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const show = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  };
  return (
    <ToastContext.Provider value={{ success: (message) => show(message, "success"), error: (message) => show(message, "error") }}>
      {children}
      {toast && (
        <div className={"fixed bottom-5 right-5 z-[100] flex max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl " + (toast.type === "success" ? "bg-emerald-600" : "bg-rose-600")}>
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast 必须在 ToastProvider 中使用。");
  return context;
}
