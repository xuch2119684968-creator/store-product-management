export type Status = "ON_SALE" | "OFF_SALE";
export type InventoryOperation = "INBOUND" | "OUTBOUND" | "ADJUSTMENT" | "STOCKTAKE" | "IMPORT";

export interface Category {
  id: string;
  name: string;
  icon: string;
  remark: string;
  sortOrder: number;
  _count?: { products: number };
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  address: string;
  remark: string;
}

export interface Product {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  categoryId: string;
  category: Category;
  imagePath: string | null;
  specification: string;
  color: string;
  size: string;
  purchasePrice: number;
  retailPrice: number;
  memberPrice: number;
  stock: number;
  lowStock: number;
  supplierId: string | null;
  supplier: Supplier | null;
  location: string;
  remark: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryRecord {
  id: string;
  product: Pick<Product, "code" | "name" | "imagePath">;
  operation: InventoryOperation;
  changeQuantity: number;
  beforeStock: number;
  afterStock: number;
  operator: { username: string } | null;
  remark: string;
  createdAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface Settings {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  currency: string;
  labelWidth: string;
  labelHeight: string;
  defaultLowStock: string;
  lastBackupAt: string;
}

export interface AuthUser {
  id: string;
  username: string;
  mustChangePassword: boolean;
}
