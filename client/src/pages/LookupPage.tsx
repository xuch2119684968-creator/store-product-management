import { useEffect, useRef, useState } from "react";
import { Barcode, Search, X, ZoomIn } from "lucide-react";
import {
  Empty,
  Loading,
  Modal,
  Price,
  ProductImage,
  StockBadge,
} from "../components/UI";
import { api } from "../lib/api";
import { money } from "../lib/format";
import type { Product } from "../types";

export function LookupPage() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    const value = query.trim();
    if (!value) {
      setProducts([]);
      setSearched(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api<{ products: Product[] }>(
          "/products/lookup?q=" + encodeURIComponent(value),
        );
        setProducts(result.products);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="text-center">
        <h1 className="page-title">快速查价</h1>
        <p className="page-subtitle">
          输入商品名称、编号或条形码；扫码枪可直接输入后自动查询
        </p>
      </div>
      <div className="relative mx-auto max-w-3xl">
        <Search
          className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-600"
          size={26}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") inputRef.current?.blur();
          }}
          className="w-full rounded-2xl border-2 border-brand-200 bg-white py-5 pl-14 pr-14 text-lg shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          placeholder="输入商品名称、商品编号或条形码…"
        />
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          aria-label="清除搜索"
        >
          <X />
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
        <Barcode size={17} />
        支持扫码枪：将光标放在搜索框后直接扫码即可
      </div>
      {loading ? (
        <Loading text="正在查找商品…" />
      ) : searched && !products.length ? (
        <Empty text="未找到该商品，请检查名称、编号或条形码。" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => setDetail(product)}
              className="card flex overflow-hidden text-left hover:border-brand-300 hover:shadow-md"
            >
              <ProductImage product={product} className="h-32 w-28 flex-none" />
              <div className="min-w-0 flex-1 p-4">
                <p className="truncate font-bold">{product.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {product.code}
                  {product.specification ? " · " + product.specification : ""}
                </p>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">零售价</p>
                    <Price value={product.retailPrice} />
                  </div>
                  <StockBadge
                    stock={product.stock}
                    lowStock={product.lowStock}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {detail && (
        <Modal title="商品详情" onClose={() => setDetail(null)}>
          <div className="p-5">
            <div className="flex gap-5">
              {detail.imagePath ? (
                <button
                  type="button"
                  onClick={() => setPreviewImage(detail.imagePath)}
                  className="group relative h-32 w-32 flex-none overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  title="点击放大查看商品图片"
                >
                  <ProductImage
                    product={detail}
                    className="h-full w-full rounded-xl"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-slate-950/45 text-white opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                    <ZoomIn size={25} />
                  </span>
                </button>
              ) : (
                <ProductImage
                  product={detail}
                  className="h-32 w-32 flex-none rounded-xl"
                />
              )}
              <div className="min-w-0">
                <h2 className="text-xl font-bold">{detail.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {detail.code} · {detail.category.name}
                </p>
                <p className="mt-3 text-sm">
                  {detail.specification || "暂无规格"}{" "}
                  {detail.color && "· " + detail.color}{" "}
                  {detail.size && "· " + detail.size}
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-xs text-slate-500">批发价</p>
                <p className="mt-1 text-xl font-bold text-brand-600">
                  {money(detail.wholesalePrice)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">零售价</p>
                <p className="mt-1 text-xl font-bold text-rose-600">
                  {money(detail.retailPrice)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">当前库存</p>
                <StockBadge stock={detail.stock} lowStock={detail.lowStock} />
              </div>
              <div>
                <p className="text-xs text-slate-500">条形码</p>
                <p className="mt-1 text-sm font-mono">
                  {detail.barcode || "未设置"}
                </p>
              </div>
            </div>
            {detail.remark && (
              <p className="mt-4 text-sm text-slate-600">
                备注：{detail.remark}
              </p>
            )}
          </div>
        </Modal>
      )}
      {previewImage && (
        <Modal
          title="商品图片预览"
          onClose={() => setPreviewImage(null)}
          wide
        >
          <div className="bg-slate-950 p-3 sm:p-5">
            <img
              src={previewImage}
              alt="商品图片大图"
              className="mx-auto max-h-[calc(94vh-7rem)] max-w-full rounded-lg object-contain"
            />
          </div>
          <p className="px-5 py-3 text-center text-xs text-slate-500">
            点击遮罩或右上角关闭；手机可使用双指缩放查看细节。
          </p>
        </Modal>
      )}
    </div>
  );
}
