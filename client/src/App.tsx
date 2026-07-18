import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import { Loading } from "./components/UI";
import { CategoriesPage } from "./pages/CategoriesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ImportExportPage } from "./pages/ImportExportPage";
import { InventoryPage } from "./pages/InventoryPage";
import { InventoryRecordsPage } from "./pages/InventoryRecordsPage";
import { LabelsPage } from "./pages/LabelsPage";
import { LoginPage } from "./pages/LoginPage";
import { LookupPage } from "./pages/LookupPage";
import { ProductsPage } from "./pages/ProductsPage";
import { SettingsPage } from "./pages/SettingsPage";

function Protected() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading text="正在验证登录状态…" />;
  if (user?.mustChangePassword && location.pathname !== "/settings") return <Navigate to="/settings" replace />;
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

export function App() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route element={<Protected />}><Route path="/" element={<DashboardPage />} /><Route path="/lookup" element={<LookupPage />} /><Route path="/products" element={<ProductsPage />} /><Route path="/categories" element={<CategoriesPage />} /><Route path="/inventory" element={<InventoryPage />} /><Route path="/inventory-records" element={<InventoryRecordsPage />} /><Route path="/labels" element={<LabelsPage />} /><Route path="/import-export" element={<ImportExportPage />} /><Route path="/settings" element={<SettingsPage />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
