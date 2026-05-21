import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Loader2,
  Package,
  AlertCircle,
  Edit2,
  Trash2,
  X,
  Star,
  ImagePlus,
} from "lucide-react";

const MAX_IMAGES = 10;
import { useAsync } from "../hooks/useAsync";
import { productsApi, categoriesApi } from "../api/endpoints";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../utils/format";
import type { Product, Category } from "../types/api";

export default function ProductsPage() {
  const { tenant } = useAuth();
  const currency = tenant?.currency ?? "UZS";
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const [editing, setEditing] = useState<Product | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: search || undefined,
      categoryId: categoryFilter === "all" ? undefined : categoryFilter,
    }),
    [page, search, categoryFilter],
  );
  const { data, loading, error, refetch } = useAsync(() => productsApi.list(params), [
    page,
    search,
    categoryFilter,
  ]);
  const { data: categories, refetch: refetchCategories } = useAsync(() => categoriesApi.list(), []);

  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const cats = categories ?? [];

  const handleDelete = async (p: Product) => {
    if (!confirm(`"${p.name}" mahsulotini o'chirish?`)) return;
    await productsApi.delete(p.id);
    refetch();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Mahsulotlar</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total > 0 ? `${total} ta mahsulot` : "Katalog va omborlar"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategories(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white"
          >
            Kategoriyalar ({cats.length})
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium text-white"
          >
            <Plus className="w-4 h-4" />
            Yangi mahsulot
          </button>
        </div>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Mahsulot nomi yoki SKU..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </label>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50 min-w-[180px]"
        >
          <option value="all">Barcha kategoriyalar</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-slate-900 border border-slate-800 rounded-xl">
          <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
          <p className="text-sm text-slate-300">{error.message}</p>
          <button
            onClick={refetch}
            className="mt-3 px-3 py-1.5 text-xs bg-slate-800 rounded-lg text-slate-300"
          >
            Qaytadan urinish
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-slate-900 border border-slate-800 rounded-xl">
          <Package className="w-12 h-12 text-slate-700 mb-3" />
          <p className="text-base font-semibold text-white">
            {search ? "Mahsulot topilmadi" : "Hozircha mahsulotlar yo'q"}
          </p>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            "Yangi mahsulot" tugmasi orqali birinchi mahsulotingizni qo'shing. Mahsulot Vitrina'da
            ko'rinishi uchun "featured" bayrog'ini yoqing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              currency={currency}
              onEdit={() => setEditing(p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
            >
              Oldingi
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pageSize >= total}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
            >
              Keyingi
            </button>
          </div>
        </div>
      )}

      {(showAdd || editing) && (
        <ProductFormModal
          product={editing}
          categories={cats}
          currency={currency}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowAdd(false);
            setEditing(null);
            refetch();
          }}
        />
      )}

      {showCategories && (
        <CategoriesModal
          categories={cats}
          onClose={() => setShowCategories(false)}
          onChanged={() => {
            refetchCategories();
            refetch();
          }}
        />
      )}
    </>
  );
}

function ProductCard({
  product,
  currency,
  onEdit,
  onDelete,
}: {
  product: Product;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors group">
      <div className="w-full aspect-video bg-slate-800 rounded-lg flex items-center justify-center mb-3 overflow-hidden relative">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <Package className="w-8 h-8 text-slate-600" />
        )}
        {product.featured && (
          <span className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 backdrop-blur text-amber-300 text-[10px] font-medium">
            <Star className="w-3 h-3 fill-amber-300" />
            Vitrina
          </span>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md bg-slate-900/80 backdrop-blur text-slate-300 hover:text-white"
            title="Tahrirlash"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md bg-slate-900/80 backdrop-blur text-slate-300 hover:text-red-400"
            title="O'chirish"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 uppercase tracking-wider">{product.sku}</p>
      <p className="text-sm font-semibold text-white truncate mt-0.5">{product.name}</p>
      <p className="text-xs text-slate-500 mt-1">{product.category?.name ?? "Kategoriyasiz"}</p>
      <div className="flex items-center justify-between mt-3">
        <div>
          <span className="text-base font-bold text-white">
            {formatCurrency(Number(product.price), product.currency || currency)}
          </span>
          {product.oldPrice && Number(product.oldPrice) > Number(product.price) && (
            <span className="block text-xs text-slate-500 line-through">
              {formatCurrency(Number(product.oldPrice), currency)}
            </span>
          )}
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-md ${
            product.stock > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          }`}
        >
          Ombor: {product.stock}
        </span>
      </div>
    </div>
  );
}

function ProductFormModal({
  product,
  categories,
  currency,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sku, setSku] = useState(product?.sku ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [oldPrice, setOldPrice] = useState(product?.oldPrice ? String(product.oldPrice) : "");
  const [stock, setStock] = useState(String(product?.stock ?? "0"));
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  // Bitta galereya — birinchi rasm avtomatik asosiy (cover). Edit rejimida
  // mavjud imageUrl va images[] birlashtirilib, takrorlanishlar olib tashlanadi.
  const [images, setImages] = useState<string[]>(() => {
    if (!product) return [];
    const combined = [product.imageUrl, ...(product.images ?? [])].filter(Boolean) as string[];
    return Array.from(new Set(combined)).slice(0, MAX_IMAGES);
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [comboAddons, setComboAddons] = useState<Array<{ addonProductId: string; discountPct: number; defaultSelected: boolean; position: number; productName?: string; productImage?: string | null; productPrice?: string | number }>>([]);
  const [comboPickerOpen, setComboPickerOpen] = useState(false);
  const [productsCatalog, setProductsCatalog] = useState<Array<{ id: string; name: string; sku: string; price: string | number; imageUrl: string | null }>>([]);

  // Edit rejimida mavjud combo'larni yuklash
  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    api<{ addons: Array<{ id: string; addonProductId: string; position: number; discountPct: number; defaultSelected: boolean; product: { id: string; name: string; sku: string; price: string | number; imageUrl: string | null } }> }>(
      `/products/${product.id}/addons`,
    )
      .then((res) => {
        if (cancelled) return;
        setComboAddons(
          res.addons.map((a) => ({
            addonProductId: a.addonProductId,
            discountPct: a.discountPct,
            defaultSelected: a.defaultSelected,
            position: a.position,
            productName: a.product.name,
            productImage: a.product.imageUrl,
            productPrice: a.product.price,
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  // Combo picker ochilganda mahsulotlar ro'yxatini yuklash
  useEffect(() => {
    if (!comboPickerOpen || productsCatalog.length > 0) return;
    api<{ items: Array<{ id: string; name: string; sku: string; price: string | number; imageUrl: string | null }> }>(
      "/products",
      { query: { pageSize: 200 } },
    )
      .then((res) => setProductsCatalog(res.items))
      .catch(() => undefined);
  }, [comboPickerOpen, productsCatalog.length]);
  const [uploading, setUploading] = useState(false);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [active, setActive] = useState(product?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadSingle = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const token = localStorage.getItem("shopflow.token");
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Yuklash xatosi" }));
      throw new Error((err as { error?: string }).error || "Yuklash xatosi");
    }
    const { url } = (await res.json()) as { url: string };
    return url;
  };

  const addImages = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const remaining = MAX_IMAGES - images.length;
      const toUpload = fileArr.slice(0, remaining);
      const urls: string[] = [];
      for (const file of toUpload) {
        urls.push(await uploadSingle(file));
      }
      setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rasm yuklanmadi");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const makeCover = (idx: number) => {
    if (idx === 0) return;
    setImages((prev) => {
      const next = prev.slice();
      const [picked] = next.splice(idx, 1);
      next.unshift(picked);
      return next;
    });
  };

  const reorderImage = (from: number, to: number) => {
    if (from === to) return;
    setImages((prev) => {
      const next = prev.slice();
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = {
        sku,
        name,
        description: description || undefined,
        price: Number(price),
        oldPrice: oldPrice ? Number(oldPrice) : null,
        stock: Number(stock) || 0,
        currency,
        categoryId: categoryId || null,
        // Birinchi rasm — asosiy (cover), qolganlari galereya
        imageUrl: images[0] ?? null,
        images: images.slice(1),
        featured,
        active,
      };
      let savedProductId = product?.id;
      if (product) {
        await productsApi.update(product.id, data);
      } else {
        const created = await productsApi.create(data);
        savedProductId = created.id;
      }

      // Combo addons saqlash
      if (savedProductId) {
        await api(`/products/${savedProductId}/addons`, {
          method: "PUT",
          body: {
            addons: comboAddons.map((a, i) => ({
              addonProductId: a.addonProductId,
              position: a.position ?? i,
              discountPct: a.discountPct,
              defaultSelected: a.defaultSelected,
            })),
          },
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xato");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-lg font-bold text-white">
            {product ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="SKU (kod) *">
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="IPH-15-PRO"
                className="input"
              />
            </Field>
            <Field label="Kategoriya">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input"
              >
                <option value="">— tanlanmagan —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Mahsulot nomi *">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="iPhone 15 Pro Max 256GB"
              className="input"
            />
          </Field>

          <Field label="Tavsif">
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mahsulot haqida qisqacha..."
              className="input resize-none"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label={`Narx (${currency}) *`}>
              <input
                type="number"
                required
                min="0"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="14500000"
                className="input"
              />
            </Field>
            <Field label={`Eski narx (chegirma uchun)`}>
              <input
                type="number"
                min="0"
                step="any"
                value={oldPrice}
                onChange={(e) => setOldPrice(e.target.value)}
                placeholder="15200000"
                className="input"
              />
            </Field>
            <Field label="Omborda">
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <ImageGallery
            images={images}
            uploading={uploading}
            dragIdx={dragIdx}
            dragOverIdx={dragOverIdx}
            onAdd={addImages}
            onRemove={removeImage}
            onMakeCover={makeCover}
            onReorder={reorderImage}
            onDragStart={setDragIdx}
            onDragOver={setDragOverIdx}
            onDragEnd={() => {
              setDragIdx(null);
              setDragOverIdx(null);
            }}
          />

          {/* Combo / qo'shimcha mahsulotlar (Amazon-style) */}
          <Field label={`🎁 Combo qo'shimchalari (${comboAddons.length}) — Mini App'da "Bularni ham qo'shing"`}>
            {comboAddons.length > 0 && (
              <div className="space-y-2 mb-2">
                {comboAddons.map((addon, i) => (
                  <div key={addon.addonProductId} className="flex items-center gap-2 bg-slate-800/50 border border-slate-800 rounded-lg p-2">
                    {addon.productImage ? (
                      <img src={addon.productImage} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4 text-slate-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">{addon.productName}</div>
                      <div className="text-[10px] text-slate-500">{Number(addon.productPrice ?? 0).toLocaleString("uz-UZ")} so'm</div>
                    </div>
                    <label className="flex items-center gap-1 text-[10px] text-slate-400">
                      <input
                        type="number"
                        value={addon.discountPct}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          setComboAddons((prev) => prev.map((a, j) => j === i ? { ...a, discountPct: v } : a));
                        }}
                        min={0}
                        max={100}
                        className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white text-center"
                      />
                      <span>%</span>
                    </label>
                    <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addon.defaultSelected}
                        onChange={(e) => {
                          const ck = e.target.checked;
                          setComboAddons((prev) => prev.map((a, j) => j === i ? { ...a, defaultSelected: ck } : a));
                        }}
                        className="w-3 h-3"
                      />
                      <span>default</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setComboAddons((prev) => prev.filter((_, j) => j !== i))}
                      className="text-slate-500 hover:text-rose-400 p-1"
                      aria-label="O'chirish"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setComboPickerOpen(true)}
              className="w-full py-2 border-2 border-dashed border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-lg text-xs text-slate-400 hover:text-emerald-300 transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Qo'shimcha mahsulot qo'shish
            </button>
            <p className="text-[10px] text-slate-500 mt-1.5">
              Mijoz Mini App'da bu mahsulotni ochganda "Bularni ham qo'shing" bo'limi ko'rinadi.
              `default` belgisi — checkbox boshlang'ich tanlangan bo'ladi. `%` — combo bilan birga olganda chegirma.
            </p>
          </Field>

          {/* Combo picker modal */}
          {comboPickerOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4" onClick={() => setComboPickerOpen(false)}>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Mahsulot qo'shish</h3>
                  <button type="button" onClick={() => setComboPickerOpen(false)} className="p-1 text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-2 space-y-1">
                  {productsCatalog.filter((p) => p.id !== product?.id && !comboAddons.find((a) => a.addonProductId === p.id)).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setComboAddons((prev) => [...prev, {
                          addonProductId: p.id,
                          discountPct: 0,
                          defaultSelected: false,
                          position: prev.length,
                          productName: p.name,
                          productImage: p.imageUrl,
                          productPrice: p.price,
                        }]);
                        setComboPickerOpen(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800/60 text-left"
                    >
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="w-9 h-9 rounded object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-slate-800 flex items-center justify-center">
                          <Package className="w-4 h-4 text-slate-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-500">{p.sku} · {Number(p.price).toLocaleString("uz-UZ")} so'm</div>
                      </div>
                      <Plus className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-300">
                ⭐ Vitrina'da ko'rsatish (asosiy sahifada)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-300">Sotuvda</span>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end p-5 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-sm font-medium text-white"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {product ? "Saqlash" : "Yaratish"}
          </button>
        </div>

        <style>{`
          .input {
            width: 100%;
            padding: 0.625rem 0.75rem;
            background: rgb(30 41 59);
            border: 1px solid rgb(51 65 85);
            border-radius: 0.5rem;
            color: white;
            font-size: 0.875rem;
            outline: none;
            transition: border-color 0.15s;
          }
          .input:focus {
            border-color: rgb(16 185 129);
          }
        `}</style>
      </form>
    </div>
  );
}

function CategoriesModal({
  categories,
  onClose,
  onChanged,
}: {
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = localStorage.getItem("shopflow.token");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Yuklash xatosi");
      }
      const { url } = (await res.json()) as { url: string };
      setNewImageUrl(url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Rasm yuklanmadi");
    } finally {
      setUploading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await categoriesApi.create({
        name: newName.trim(),
        slug:
          newSlug.trim() ||
          newName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        imageUrl: newImageUrl || null,
      });
      setNewName("");
      setNewSlug("");
      setNewImageUrl("");
      setUploadError(null);
      onChanged();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Category) => {
    if (!confirm(`"${c.name}" kategoriyani o'chirish?`)) return;
    await categoriesApi.delete(c.id);
    onChanged();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">Kategoriyalar</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAdd} className="p-5 border-b border-slate-800 space-y-2">
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Yangi kategoriya nomi"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="slug (ixtiyoriy) — telefonlar"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
          />
          <label
            className={`flex items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              uploading
                ? "border-emerald-500/50 bg-emerald-500/5"
                : newImageUrl
                  ? "border-slate-700"
                  : "border-slate-700 hover:border-slate-500 bg-slate-800/30"
            }`}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = "";
              }}
            />
            {uploading ? (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Yuklanmoqda...
              </div>
            ) : newImageUrl ? (
              <div className="flex items-center gap-2">
                <img src={newImageUrl} alt="preview" className="w-12 h-12 rounded object-cover" />
                <span className="text-xs text-slate-400">Rasmni o'zgartirish</span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Rasm yuklash (ixtiyoriy)</span>
            )}
          </label>
          {newImageUrl && !uploading && (
            <button
              type="button"
              onClick={() => setNewImageUrl("")}
              className="text-[11px] text-red-400 hover:text-red-300"
            >
              Rasmni olib tashlash
            </button>
          )}
          {uploadError && <p className="text-[11px] text-red-400">{uploadError}</p>}
          <button
            type="submit"
            disabled={saving || uploading || !newName.trim()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-sm font-medium text-white"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <Plus className="w-3.5 h-3.5" />
            Qo'shish
          </button>
        </form>

        <div className="p-3">
          {categories.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Hali kategoriya yo'q</p>
          ) : (
            categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-lg"
              >
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-slate-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 truncate">{c.slug}</p>
                </div>
                <button
                  onClick={() => handleDelete(c)}
                  className="p-1.5 rounded text-slate-500 hover:text-red-400 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

interface ImageGalleryProps {
  images: string[];
  uploading: boolean;
  dragIdx: number | null;
  dragOverIdx: number | null;
  onAdd: (files: FileList | File[]) => void;
  onRemove: (idx: number) => void;
  onMakeCover: (idx: number) => void;
  onReorder: (from: number, to: number) => void;
  onDragStart: (idx: number | null) => void;
  onDragOver: (idx: number | null) => void;
  onDragEnd: () => void;
}

function ImageGallery({
  images,
  uploading,
  dragIdx,
  dragOverIdx,
  onAdd,
  onRemove,
  onMakeCover,
  onReorder,
  onDragStart,
  onDragOver,
  onDragEnd,
}: ImageGalleryProps) {
  const [dropZoneActive, setDropZoneActive] = useState(false);
  const slotsLeft = MAX_IMAGES - images.length;
  const canAdd = slotsLeft > 0 && !uploading;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropZoneActive(false);
    // Faqat fayllar bo'lsa (ichki drag-reorder emas)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAdd(e.dataTransfer.files);
    }
  };

  // Bo'sh holat — katta drop zone
  if (images.length === 0) {
    return (
      <Field label="Mahsulot rasmlari">
        <label
          onDragEnter={(e) => {
            e.preventDefault();
            if (canAdd) setDropZoneActive(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDropZoneActive(false)}
          onDrop={handleFileDrop}
          className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            uploading
              ? "border-emerald-500/50 bg-emerald-500/5"
              : dropZoneActive
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-slate-700 hover:border-slate-500 bg-slate-800/30"
          }`}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) onAdd(e.target.files);
              e.target.value = "";
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              <span className="text-xs text-emerald-400">Yuklanmoqda...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ImagePlus className="w-10 h-10 text-slate-500" />
              <span className="text-sm font-medium text-slate-300">
                Rasmlarni bu yerga sudrab tashlang yoki tanlang
              </span>
              <span className="text-[11px] text-slate-500">
                Birinchi rasm — asosiy · 10 tagacha · JPEG, PNG, WebP, GIF · 8MB gacha
              </span>
            </div>
          )}
        </label>
      </Field>
    );
  }

  // Rasmlar bor — galereya
  return (
    <Field label={`Mahsulot rasmlari (${images.length}/${MAX_IMAGES})`}>
      <div className="grid grid-cols-4 gap-2">
        {images.map((url, i) => {
          const isCover = i === 0;
          const isDragSource = dragIdx === i;
          const isDragTarget = dragOverIdx === i && dragIdx !== i;
          return (
            <div
              key={`${url}-${i}`}
              draggable={!uploading}
              onDragStart={() => onDragStart(i)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIdx !== null) onDragOver(i);
              }}
              onDragLeave={() => {
                if (dragOverIdx === i) onDragOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Ichki drag-reorder
                if (dragIdx !== null) {
                  onReorder(dragIdx, i);
                  onDragEnd();
                  return;
                }
                // Tashqi fayl
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  onAdd(e.dataTransfer.files);
                }
              }}
              onDragEnd={onDragEnd}
              className={`relative group ${isCover ? "col-span-2 row-span-2 aspect-[4/3]" : "aspect-square"} bg-slate-800 rounded-lg overflow-hidden cursor-move transition-all ${
                isDragSource ? "opacity-40" : ""
              } ${isDragTarget ? "ring-2 ring-emerald-500" : ""}`}
            >
              <img src={url} alt={isCover ? "Asosiy rasm" : `${i + 1}-rasm`} className="w-full h-full object-cover pointer-events-none" />

              {/* Asosiy belgisi */}
              {isCover && (
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded shadow-lg">
                  ASOSIY
                </div>
              )}

              {/* Tartib raqami (cover'dan tashqari) */}
              {!isCover && (
                <div className="absolute top-1 left-1 w-5 h-5 bg-black/70 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                  {i + 1}
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none">
                <div className="flex gap-1.5 pointer-events-auto">
                  {!isCover && (
                    <button
                      type="button"
                      onClick={() => onMakeCover(i)}
                      className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 rounded text-[10px] font-medium text-white shadow"
                      title="Asosiy qilish"
                    >
                      <Star className="w-3 h-3 inline mr-0.5" />
                      Asosiy
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="w-7 h-7 bg-rose-500 hover:bg-rose-600 rounded flex items-center justify-center text-white shadow"
                    title="O'chirish"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Yana qo'shish kartochkasi */}
        {canAdd && (
          <label
            onDragEnter={(e) => {
              e.preventDefault();
              setDropZoneActive(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDropZoneActive(false)}
            onDrop={handleFileDrop}
            className={`aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              dropZoneActive
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-slate-700 hover:border-slate-500 bg-slate-800/30"
            }`}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) onAdd(e.target.files);
                e.target.value = "";
              }}
            />
            <ImagePlus className="w-5 h-5 text-slate-500 mb-1" />
            <span className="text-[10px] text-slate-500">Yana {slotsLeft} ta</span>
          </label>
        )}

        {/* Yuklash holatida overlay */}
        {uploading && (
          <div className="aspect-square flex items-center justify-center border-2 border-dashed border-emerald-500/50 rounded-lg bg-emerald-500/5">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 mt-2">
        💡 <span className="text-slate-400">Birinchi rasm — asosiy</span> · rasmni sudrab tartibini o'zgartiring · hover qilib ⭐ "Asosiy" yoki 🗑 "O'chirish" tanlang
      </p>
    </Field>
  );
}
