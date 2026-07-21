import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  ListChecks,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Empty,
  Loading,
  Modal,
  ProductImage,
  StockBadge,
} from "../components/UI";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import type { Product } from "../types";

type Operation = "INBOUND" | "OUTBOUND" | "ADJUSTMENT" | "STOCKTAKE";
type BatchOperation = Exclude<Operation, "STOCKTAKE">;

const batchOperationOptions: Array<{
  value: BatchOperation;
  label: string;
  Icon: typeof ArrowDownToLine;
}> = [
  { value: "INBOUND", label: "批量入库", Icon: ArrowDownToLine },
  { value: "OUTBOUND", label: "批量出库", Icon: ArrowUpFromLine },
  { value: "ADJUSTMENT", label: "批量调整", Icon: SlidersHorizontal },
];

function operationLabel(operation: BatchOperation) {
  return operation === "INBOUND"
    ? "入库"
    : operation === "OUTBOUND"
      ? "出库"
      : "调整";
}

export function InventoryPage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatch, setShowBatch] = useState(false);
  const [batchOperation, setBatchOperation] =
    useState<BatchOperation>("INBOUND");
  const [batchQuantity, setBatchQuantity] = useState(1);
  const [batchRemark, setBatchRemark] = useState("");
  const [batchSaving, setBatchSaving] = useState(false);
  const [operation, setOperation] = useState<Operation>("INBOUND");
  const [quantity, setQuantity] = useState(1);
  const [actualStock, setActualStock] = useState(0);
  const [remark, setRemark] = useState("");
  useEffect(() => {
    if (!query.trim()) {
      setProducts([]);
      setSelectedIds([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api<{ products: Product[] }>(
          "/products?" +
            new URLSearchParams({
              search: query,
              page: "1",
              pageSize: "50",
              sort: "retailPrice",
              order: "desc",
            }),
        );
        setProducts(result.products);
        setSelectedIds([]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "查询失败。");
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);
  const open = (product: Product) => {
    setSelected(product);
    setQuantity(1);
    setActualStock(product.stock);
    setRemark("");
    setOperation("INBOUND");
  };
  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.includes(product.id)),
    [products, selectedIds],
  );
  const allSelected = products.length > 0 && selectedIds.length === products.length;
  const toggleProduct = (productId: string) => {
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  };
  const openBatch = () => {
    if (!selectedIds.length) return;
    setBatchOperation("INBOUND");
    setBatchQuantity(1);
    setBatchRemark("");
    setShowBatch(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    try {
      const result = await api<{ message: string; product: Product }>(
        "/inventory/change",
        {
          method: "POST",
          body: JSON.stringify({
            productId: selected.id,
            operation,
            quantity,
            actualStock,
            remark,
          }),
        },
      );
      toast.success(result.message);
      setSelected(null);
      setQuery("");
      setProducts([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "库存更新失败。");
    }
  };
  const saveBatch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedIds.length) return;
    const action = operationLabel(batchOperation);
    if (
      !window.confirm(
        "确定对选中的 " + selectedIds.length + " 件商品批量" + action + "吗？",
      )
    )
      return;
    setBatchSaving(true);
    try {
      const result = await api<{ message: string; changedCount: number }>(
        "/inventory/batch-change",
        {
          method: "POST",
          body: JSON.stringify({
            productIds: selectedIds,
            operation: batchOperation,
            quantity: batchQuantity,
            remark: batchRemark,
          }),
        },
      );
      toast.success(result.message);
      setShowBatch(false);
      setSelectedIds([]);
      setQuery("");
      setProducts([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "批量库存更新失败。");
    } finally {
      setBatchSaving(false);
    }
  };
  const icon =
    operation === "INBOUND" ? (
      <ArrowDownToLine className="text-emerald-600" />
    ) : operation === "OUTBOUND" ? (
      <ArrowUpFromLine className="text-rose-600" />
    ) : (
      <SlidersHorizontal className="text-brand-600" />
    );
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="page-title">库存管理</h1>
        <p className="page-subtitle">
          通过入库、出库、调整和盘点维护准确库存；每次操作都会保留记录
        </p>
      </div>
      <section className="card p-5">
        <label className="relative block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            className="input py-4 pl-11 text-base"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索商品名称、编号或条形码，选择后进行库存操作"
          />
        </label>
        <p className="mt-3 text-xs text-slate-500">
          支持扫码枪直接输入条形码。可勾选多个商品统一修改库存；库存不能调整为负数。
        </p>
      </section>
      {selectedIds.length > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
          <span className="font-semibold text-brand-700">
            已选 {selectedIds.length} 件商品
          </span>
          <span className="text-slate-500">将对每件商品应用相同的数量</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSelectedIds([])}
            >
              <X size={16} />
              清除选择
            </button>
            <button type="button" className="btn-primary" onClick={openBatch}>
              <ListChecks size={17} />
              批量修改库存
            </button>
          </div>
        </section>
      )}
      {loading ? (
        <Loading text="正在查找商品…" />
      ) : query && !products.length ? (
        <Empty text="未找到商品" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {products.length > 0 && (
            <label className="col-span-full flex cursor-pointer items-center gap-2 px-1 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) =>
                  setSelectedIds(
                    event.target.checked
                      ? products.map((product) => product.id)
                      : [],
                  )
                }
              />
              全选本次搜索结果（{products.length} 件）
            </label>
          )}
          {products.map((product) => (
            <div
              key={product.id}
              className={
                "card flex items-center gap-3 p-3 " +
                (selectedIds.includes(product.id)
                  ? "border-brand-400 bg-brand-50/40"
                  : "")
              }
            >
              <label className="flex cursor-pointer items-center self-stretch px-1">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(product.id)}
                  onChange={() => toggleProduct(product.id)}
                  aria-label={"选择商品：" + product.name}
                />
              </label>
              <button
                type="button"
                onClick={() => open(product)}
                className="flex min-w-0 flex-1 items-center gap-4 text-left hover:text-brand-700"
                title="单个库存操作"
              >
                <ProductImage
                  product={product}
                  className="h-16 w-16 flex-none rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{product.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {product.code} · {product.specification || "无规格"}
                  </p>
                  <div className="mt-2">
                    <StockBadge
                      stock={product.stock}
                      lowStock={product.lowStock}
                    />
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
      {selected && (
        <Modal title="库存操作" onClose={() => setSelected(null)}>
          <form onSubmit={save} className="space-y-5 p-5">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <ProductImage
                product={selected}
                className="h-14 w-14 rounded-lg"
              />
              <div>
                <p className="font-bold">{selected.name}</p>
                <p className="text-sm text-slate-500">
                  {selected.code} · 当前库存 {selected.stock}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["INBOUND", "入库", ArrowDownToLine],
                  ["OUTBOUND", "出库", ArrowUpFromLine],
                  ["ADJUSTMENT", "调整", SlidersHorizontal],
                  ["STOCKTAKE", "盘点", ClipboardCheck],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setOperation(value)}
                  className={
                    "flex flex-col items-center gap-1 rounded-xl border p-3 text-sm font-medium " +
                    (operation === value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600")
                  }
                >
                  <Icon size={19} />
                  {label}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              {icon}
              <p className="mt-2 font-medium">
                {operation === "INBOUND"
                  ? "商品入库"
                  : operation === "OUTBOUND"
                    ? "商品出库"
                    : operation === "STOCKTAKE"
                      ? "库存盘点"
                      : "库存调整"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {operation === "STOCKTAKE"
                  ? "填写盘点后的实际库存，系统将自动计算差异。"
                  : operation === "ADJUSTMENT"
                    ? "正数增加库存，负数减少库存。"
                    : operation === "INBOUND"
                      ? "填写本次入库数量。"
                      : "填写本次出库数量，不能超过现有库存。"}
              </p>
            </div>
            {operation === "STOCKTAKE" ? (
              <label>
                <span className="mb-1.5 block text-sm font-medium">
                  实际库存 *
                </span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={actualStock}
                  onChange={(e) => setActualStock(Number(e.target.value))}
                />
              </label>
            ) : (
              <label>
                <span className="mb-1.5 block text-sm font-medium">
                  {operation === "ADJUSTMENT"
                    ? "调整数量（可填负数）"
                    : "数量 *"}
                </span>
                <input
                  className="input"
                  type="number"
                  min={operation === "ADJUSTMENT" ? undefined : 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </label>
            )}
            <label>
              <span className="mb-1.5 block text-sm font-medium">备注</span>
              <textarea
                className="input min-h-20"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="例如：供应商到货、门店销售、盘点差异原因"
              />
            </label>
            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setSelected(null)}
              >
                取消
              </button>
              <button className="btn-primary">确认保存</button>
            </div>
          </form>
        </Modal>
      )}
      {showBatch && (
        <Modal title="批量修改库存" onClose={() => setShowBatch(false)}>
          <form onSubmit={saveBatch} className="space-y-5 p-5">
            <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
              <div className="flex items-center gap-2 font-bold">
                <ListChecks size={18} />
                已选择 {selectedProducts.length} 件商品
              </div>
              <p className="mt-1 text-brand-700">
                本次会为每件商品应用相同数量，并分别生成库存变动记录。
              </p>
              <p className="mt-2 truncate text-xs text-brand-600">
                {selectedProducts.slice(0, 3).map((product) => product.name).join("、")}
                {selectedProducts.length > 3 ? " 等" : ""}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {batchOperationOptions.map(({ value, label, Icon }) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setBatchOperation(value)}
                  className={
                    "flex flex-col items-center gap-1 rounded-xl border p-3 text-sm font-medium " +
                    (batchOperation === value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600")
                  }
                >
                  <Icon size={19} />
                  {label}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 p-4 text-sm">
              <p className="font-medium">
                {batchOperation === "INBOUND"
                  ? "每件商品增加相同库存数量"
                  : batchOperation === "OUTBOUND"
                    ? "每件商品减少相同库存数量"
                    : "每件商品按相同数量增加或减少库存"}
              </p>
              <p className="mt-1 text-slate-500">
                {batchOperation === "OUTBOUND"
                  ? "系统会先检查所有商品库存；任意一件库存不足时，整批操作不会执行。"
                  : "盘点需要分别填写每件商品的实际库存，请使用单个库存操作。"}
              </p>
            </div>
            <label>
              <span className="mb-1.5 block text-sm font-medium">
                {batchOperation === "ADJUSTMENT"
                  ? "统一调整数量（可填负数）"
                  : "每件商品数量 *"}
              </span>
              <input
                required
                className="input"
                type="number"
                min={batchOperation === "ADJUSTMENT" ? undefined : 1}
                value={batchQuantity}
                onChange={(event) => setBatchQuantity(Number(event.target.value))}
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium">备注</span>
              <textarea
                className="input min-h-20"
                value={batchRemark}
                onChange={(event) => setBatchRemark(event.target.value)}
                placeholder="例如：供应商统一到货、门店统一调拨"
              />
            </label>
            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setShowBatch(false)}
              >
                取消
              </button>
              <button disabled={batchSaving} className="btn-primary">
                {batchSaving
                  ? "正在批量保存…"
                  : "确认批量" + operationLabel(batchOperation)}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
