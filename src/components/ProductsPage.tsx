import { useMemo, useState } from "react";
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
} from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { productsApi, categoriesApi } from "../api/endpoints";
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
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [active, setActive] = useState(product?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        imageUrl: imageUrl || null,
        featured,
        active,
      };
      if (product) {
        await productsApi.update(product.id, data);
      } else {
        await productsApi.create(data);
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

          <Field label="Rasm URL (https://...)">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="input"
            />
            {imageUrl && (
              <div className="mt-2 w-32 h-32 rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                <img
                  src={imageUrl}
                  alt="preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </Field>

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
  const [saving, setSaving] = useState(false);

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
      });
      setNewName("");
      setNewSlug("");
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
          <button
            type="submit"
            disabled={saving || !newName.trim()}
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
                className="flex items-center justify-between px-3 py-2 hover:bg-slate-800 rounded-lg"
              >
                <div>
                  <p className="text-sm text-white">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.slug}</p>
                </div>
                <button
                  onClick={() => handleDelete(c)}
                  className="p-1.5 rounded text-slate-500 hover:text-red-400"
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
