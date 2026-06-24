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
  CheckCircle2,
  Check,
  CheckSquare,
  Tag,
  Eye,
  EyeOff,
  Upload,
  PackagePlus,
} from "lucide-react";
import ProductImportModal from "./ProductImportModal";
import { Skeleton } from "./ui/Skeleton";
import { useAppToast } from "./ui/Toast";

const MAX_IMAGES = 10;
import { useQueryAsync } from "../hooks/useQueryAsync";
import { productsApi, categoriesApi } from "../api/endpoints";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../utils/format";
import type { Product, Category } from "../types/api";
import { useT } from "../i18n";

// "50000" → "50,000". Bo'sh / noto'g'ri input → "".
function formatGrouped(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

// "50,000" yoki "50 000" → "50000" (faqat raqamlar).
function unformatGrouped(formatted: string): string {
  return String(formatted).replace(/\D/g, "");
}

export default function ProductsPage() {
  const { tenant } = useAuth();
  const { t } = useT();
  const toast = useAppToast();
  const currency = tenant?.currency ?? "UZS";
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const [editing, setEditing] = useState<Product | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [restocking, setRestocking] = useState<Product | null>(null);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: search || undefined,
      categoryId: categoryFilter === "all" ? undefined : categoryFilter,
    }),
    [page, search, categoryFilter],
  );
  const { data, loading, error, refetch } = useQueryAsync(["products", "list", params], () => productsApi.list(params));
  const { data: categories, refetch: refetchCategories } = useQueryAsync(["categories", "list"], () => categoriesApi.list());

  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const cats = categories ?? [];

  const handleDelete = async (p: Product) => {
    if (!confirm(t("products.deleteConfirm", { name: p.name }))) return;
    await productsApi.delete(p.id);
    refetch();
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelected((prev) => {
      const allOnPage = products.every((p) => prev.has(p.id));
      if (allOnPage) {
        const next = new Set(prev);
        for (const p of products) next.delete(p.id);
        return next;
      }
      const next = new Set(prev);
      for (const p of products) next.add(p.id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  type BulkAction = "delete" | "setCategory" | "setActive" | "setFeatured";
  interface BulkBody {
    ids: string[];
    action: BulkAction;
    value?: boolean;
    categoryId?: string | null;
  }
  const runBulk = async (body: BulkBody) => {
    setBulkBusy(true);
    try {
      const res = await api<{ affected: number; summary: string }>("/products/bulk", {
        method: "POST",
        body,
      });
      clearSelection();
      refetch();
      toast.success(res.summary || `${res.affected} ta yangilandi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk operatsiya muvaffaqiyatsiz");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} ta mahsulotni butunlay o'chirish?`)) return;
    runBulk({ ids: Array.from(selected), action: "delete" });
  };
  const handleBulkActive = (value: boolean) =>
    runBulk({ ids: Array.from(selected), action: "setActive", value });
  const handleBulkFeatured = (value: boolean) =>
    runBulk({ ids: Array.from(selected), action: "setFeatured", value });
  const handleBulkCategory = (categoryId: string | null) => {
    setBulkCategoryOpen(false);
    runBulk({ ids: Array.from(selected), action: "setCategory", categoryId });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-forest-800">{t("products.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total > 0 ? t("products.count", { count: total }) : t("products.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-lg text-sm text-forest-800 whitespace-nowrap"
            title={t("products.import")}
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{t("products.import")}</span>
          </button>
          <button
            onClick={() => setShowCategories(true)}
            className="px-3 py-2 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-lg text-sm text-forest-800 whitespace-nowrap"
          >
            <span className="hidden sm:inline">{t("products.categories")} </span>({cats.length})
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-leaf-400 hover:bg-leaf-500 rounded-lg text-sm font-medium text-forest-800 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("products.newProduct")}</span>
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
            placeholder={t("products.searchPlaceholder")}
            className="w-full bg-white border border-cream-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
          />
        </label>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 bg-white border border-cream-300 rounded-lg text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60 min-w-[180px]"
        >
          <option value="all">{t("products.allCategories")}</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-cream-300 rounded-xl p-4">
              <Skeleton className="w-full aspect-video mb-3" />
              <Skeleton className="h-2.5 w-16 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-3 w-24 mb-3" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white border border-cream-300 rounded-xl">
          <AlertCircle className="w-10 h-10 text-rose-600 mb-2" />
          <p className="text-sm text-slate-700">{error.message}</p>
          <button
            onClick={refetch}
            className="mt-3 px-3 py-1.5 text-xs bg-cream-100 rounded-lg text-slate-700"
          >
            {t("orders.retry")}
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white border border-cream-300 rounded-xl">
          <Package className="w-12 h-12 text-cream-300 mb-3" />
          <p className="text-base font-semibold text-forest-800">
            {search ? t("products.empty.search") : t("products.empty.none")}
          </p>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            {t("products.empty.hint")}
          </p>
        </div>
      ) : (
        <>
        {/* Bulk action toolbar — tanlangan mahsulotlar bo'lsa ko'rinadi */}
        {selected.size > 0 && (
          <div className="sticky top-0 z-30 mb-3 bg-leaf-100 border border-leaf-400/50 rounded-xl px-3 py-2.5 flex items-center gap-2 flex-wrap backdrop-blur">
            <span className="text-sm font-medium text-forest-700">
              {t("products.bulk.selected", { count: selected.size })}
            </span>
            <button
              onClick={selectAllOnPage}
              className="text-xs text-forest-700 hover:text-forest-700 underline"
            >
              {products.every((p) => selected.has(p.id)) ? t("products.bulk.deselectPage") : t("products.bulk.selectAllPage")}
            </button>
            <div className="flex-1" />
            <button
              onClick={() => handleBulkFeatured(true)}
              disabled={bulkBusy}
              className="px-2.5 py-1 bg-cream-100 hover:bg-amber-200 hover:text-amber-600 disabled:opacity-50 rounded-md text-xs text-forest-700 flex items-center gap-1"
              title={t("products.bulk.showcaseTitle")}
            >
              <Star className="w-3 h-3" />
              {t("products.bulk.showcase")}
            </button>
            <button
              onClick={() => handleBulkActive(true)}
              disabled={bulkBusy}
              className="px-2.5 py-1 bg-cream-100 hover:bg-leaf-200 hover:text-forest-700 disabled:opacity-50 rounded-md text-xs text-forest-700 flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              {t("products.bulk.enable")}
            </button>
            <button
              onClick={() => handleBulkActive(false)}
              disabled={bulkBusy}
              className="px-2.5 py-1 bg-cream-100 hover:bg-cream-200 disabled:opacity-50 rounded-md text-xs text-forest-700 flex items-center gap-1"
            >
              <EyeOff className="w-3 h-3" />
              {t("products.bulk.disable")}
            </button>
            <div className="relative">
              <button
                onClick={() => setBulkCategoryOpen(!bulkCategoryOpen)}
                disabled={bulkBusy}
                className="px-2.5 py-1 bg-cream-100 hover:bg-cream-200 disabled:opacity-50 rounded-md text-xs text-forest-700 flex items-center gap-1"
              >
                <Tag className="w-3 h-3" />
                {t("products.bulk.category")}
              </button>
              {bulkCategoryOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setBulkCategoryOpen(false)} />
                  <div className="absolute top-full right-0 mt-1 z-30 bg-cream-100 border border-cream-300 rounded-lg shadow-xl py-1 min-w-[180px] max-h-60 overflow-y-auto">
                    <button
                      onClick={() => handleBulkCategory(null)}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-cream-200"
                    >
                      {t("products.bulk.noCategory")}
                    </button>
                    {cats.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleBulkCategory(c.id)}
                        className="w-full text-left px-3 py-1.5 text-xs text-forest-800 hover:bg-cream-200"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={handleBulkDelete}
              disabled={bulkBusy}
              className="px-2.5 py-1 bg-rose-200 hover:bg-rose-200 text-rose-600 disabled:opacity-50 rounded-md text-xs flex items-center gap-1"
            >
              {bulkBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {t("products.bulk.delete")}
            </button>
            <button
              onClick={clearSelection}
              className="ml-1 p-1 text-forest-700 hover:text-forest-700"
              aria-label={t("products.bulk.clearSelection")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              currency={currency}
              selected={selected.has(p.id)}
              onToggleSelect={() => toggleSelected(p.id)}
              onEdit={() => setEditing(p)}
              onDelete={() => handleDelete(p)}
              onRestock={() => setRestocking(p)}
            />
          ))}
        </div>
        </>
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
              className="px-3 py-1 rounded-lg bg-cream-100 hover:bg-cream-200 disabled:opacity-30"
            >
              {t("orders.prev")}
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pageSize >= total}
              className="px-3 py-1 rounded-lg bg-cream-100 hover:bg-cream-200 disabled:opacity-30"
            >
              {t("orders.next")}
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

      {showImport && (
        <ProductImportModal
          categories={cats}
          onClose={() => setShowImport(false)}
          onDone={() => refetch()}
        />
      )}

      {restocking && (
        <RestockModal
          product={restocking}
          onClose={() => setRestocking(null)}
          onDone={() => {
            setRestocking(null);
            refetch();
          }}
        />
      )}
    </>
  );
}

function RestockModal({
  product,
  onClose,
  onDone,
}: {
  product: Product;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useAppToast();
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      toast.error("Miqdor 1 dan katta bo'lishi kerak");
      return;
    }
    setBusy(true);
    try {
      const res = await productsApi.restock(product.id, {
        quantity: qty,
        note: note.trim() || undefined,
      });
      toast.success(`+${res.added} qo'shildi. Yangi stok: ${res.stock}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stok qo'shilmadi");
    } finally {
      setBusy(false);
    }
  };

  const newStock = parseInt(quantity, 10) > 0 ? product.stock + parseInt(quantity, 10) : product.stock;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <motion.form
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-cream-300 rounded-2xl p-5 max-w-md w-full"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-cream-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-forest-800 truncate">{product.name}</h3>
            <p className="text-xs text-slate-500 truncate">{product.sku}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-cream-100" aria-label="Yopish">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-cream-100/60 mb-4">
          <div className="text-center flex-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Hozir</p>
            <p className="text-xl font-bold text-forest-800">{product.stock}</p>
          </div>
          <div className="text-center px-3">
            <p className="text-xs text-slate-500">+{parseInt(quantity, 10) > 0 ? parseInt(quantity, 10) : 0}</p>
            <PackagePlus className="w-5 h-5 text-leaf-500 mx-auto" />
          </div>
          <div className="text-center flex-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Yangi</p>
            <p className={`text-xl font-bold ${newStock > product.stock ? "text-leaf-500" : "text-forest-800"}`}>
              {newStock}
            </p>
          </div>
        </div>

        <label className="block mb-3">
          <span className="text-xs text-slate-500 mb-1.5 block">Qo'shimcha miqdor</span>
          <input
            type="number"
            min="1"
            required
            autoFocus
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Masalan: 50"
            className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-lg font-semibold text-forest-800 focus:outline-none focus:border-leaf-500/60"
          />
        </label>

        <label className="block mb-4">
          <span className="text-xs text-slate-500 mb-1.5 block">Izoh (ixtiyoriy)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Masalan: Yetkazib beruvchi X, partiya №123"
            maxLength={500}
            className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60"
          />
          <p className="text-[10px] text-slate-400 mt-1">Audit log'da yodda qolar — qaerdan kelganini yozib qo'ying.</p>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm bg-cream-100 hover:bg-cream-200 text-slate-700"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={busy || !quantity}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 text-forest-800 font-medium"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
            Stok qo'shish
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function ProductCard({
  product,
  currency,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  onRestock,
}: {
  product: Product;
  currency: string;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestock: () => void;
}) {
  const { t } = useT();
  const lowStock = product.stock <= 5;
  return (
    <div className={`bg-white border rounded-xl p-4 transition-colors group ${
      selected ? "border-emerald-500/60 ring-2 ring-emerald-500/20" : "border-cream-300 hover:border-cream-300"
    }`}>
      <div className="w-full aspect-video bg-cream-100 rounded-lg flex items-center justify-center mb-3 overflow-hidden relative">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <Package className="w-8 h-8 text-slate-400" />
        )}
        {/* Tanlash chexbox — hover'da yoki tanlangan bo'lsa ko'rinadi */}
        <button
          onClick={onToggleSelect}
          className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center transition-all ${
            selected
              ? "bg-leaf-400 text-forest-800"
              : "bg-white/80 backdrop-blur text-slate-500 opacity-0 group-hover:opacity-100"
          }`}
          aria-label={selected ? t("products.card.deselect") : t("products.card.select")}
        >
          {selected ? <Check className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
        </button>
        {product.featured && (
          <span className="absolute top-2 left-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-200 backdrop-blur text-amber-600 text-[10px] font-medium">
            <Star className="w-3 h-3 fill-amber-300" />
            {t("products.card.featured")}
          </span>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRestock}
            className="p-1.5 rounded-md bg-white/80 backdrop-blur text-slate-700 hover:text-forest-900"
            title="Stok qo'shish"
          >
            <PackagePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md bg-white/80 backdrop-blur text-slate-700 hover:text-forest-900"
            title={t("products.card.edit")}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md bg-white/80 backdrop-blur text-slate-700 hover:text-rose-600"
            title={t("products.card.delete")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 uppercase tracking-wider">{product.sku}</p>
      <p className="text-sm font-semibold text-forest-800 truncate mt-0.5">{product.name}</p>
      <p className="text-xs text-slate-500 mt-1">{product.category?.name ?? t("products.card.uncategorized")}</p>
      <div className="flex items-center justify-between mt-3">
        <div>
          <span className="text-base font-bold text-forest-800">
            {formatCurrency(Number(product.price), product.currency || currency)}
          </span>
          {product.oldPrice && Number(product.oldPrice) > Number(product.price) && (
            <span className="block text-xs text-slate-500 line-through">
              {formatCurrency(Number(product.oldPrice), currency)}
            </span>
          )}
        </div>
        {lowStock ? (
          <button
            onClick={onRestock}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium transition-colors ${
              product.stock === 0
                ? "bg-rose-100 text-rose-600 hover:bg-rose-200"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            }`}
            title="Stok qo'shish"
          >
            <PackagePlus className="w-3 h-3" />
            {t("products.card.stock", { n: product.stock })}
          </button>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-md bg-leaf-100 text-forest-700">
            {t("products.card.stock", { n: product.stock })}
          </span>
        )}
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
  const { t } = useT();
  const [sku, setSku] = useState(product?.sku ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  // Narxlar va omborda — vergul bilan formatlangan ko'rinishda saqlanadi
  // ("14,500,000"). Submit oldidan unformatGrouped bilan toza raqamga aylanadi.
  const [price, setPrice] = useState(product?.price ? formatGrouped(String(product.price)) : "");
  const [oldPrice, setOldPrice] = useState(product?.oldPrice ? formatGrouped(String(product.oldPrice)) : "");
  const [stock, setStock] = useState(product?.stock != null ? formatGrouped(String(product.stock)) : "0");
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
  const [success, setSuccess] = useState<string | null>(null);
  const [imageToast, setImageToast] = useState<string | null>(null);

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
      const skipped = fileArr.length - toUpload.length;
      setImageToast(
        skipped > 0
          ? `${toUpload.length} ta rasm yuklandi · ${skipped} ta o'tkazib yuborildi (limit ${MAX_IMAGES})`
          : toUpload.length === 1
            ? "Rasm yuklandi"
            : `${toUpload.length} ta rasm yuklandi`,
      );
      setTimeout(() => setImageToast(null), 2500);
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
        // Vergulli formatdan toza raqamga
        price: Number(unformatGrouped(price)),
        oldPrice: oldPrice ? Number(unformatGrouped(oldPrice)) : null,
        stock: Number(unformatGrouped(stock)) || 0,
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

      // Combo addons saqlash — faqat ulanma bo'lsa
      if (savedProductId && comboAddons.length > 0) {
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
      // Success state — 1.2 soniya ko'rsatib, keyin yopiladi
      setSuccess(product ? "O'zgarishlar saqlandi" : "Mahsulot yaratildi");
      setTimeout(() => onSaved(), 1200);
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
        className="bg-white border border-cream-300 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative"
      >
        <div className="flex items-center justify-between p-5 border-b border-cream-300 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-forest-800">
            {product ? t("productForm.edit") : t("productForm.new")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={`${t("productForm.sku")} *`}>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder={t("productForm.skuPlaceholder")}
                className="input"
              />
            </Field>
            <Field label={t("productForm.category")}>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input"
              >
                <option value="">{t("productForm.noCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={`${t("productForm.name")} *`}>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("productForm.namePlaceholder")}
              className="input"
            />
          </Field>

          <Field label={t("productForm.description")}>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("productForm.descriptionPlaceholder")}
              className="input resize-none"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label={`${t("productForm.price", { currency })} *`}>
              <input
                type="text"
                inputMode="numeric"
                required
                value={price}
                onChange={(e) => setPrice(formatGrouped(e.target.value))}
                placeholder="14,500,000"
                className="input"
              />
            </Field>
            <Field label={t("productForm.oldPrice")}>
              <input
                type="text"
                inputMode="numeric"
                value={oldPrice}
                onChange={(e) => setOldPrice(formatGrouped(e.target.value))}
                placeholder="15,200,000"
                className="input"
              />
            </Field>
            <Field label={t("productForm.stock")}>
              <input
                type="text"
                inputMode="numeric"
                value={stock}
                onChange={(e) => setStock(formatGrouped(e.target.value))}
                placeholder="0"
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
                  <div key={addon.addonProductId} className="flex items-center gap-2 bg-cream-100/50 border border-cream-300 rounded-lg p-2">
                    {addon.productImage ? (
                      <img src={addon.productImage} alt={addon.productName ?? ""} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-cream-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-forest-800 truncate">{addon.productName}</div>
                      <div className="text-[10px] text-slate-500">{Number(addon.productPrice ?? 0).toLocaleString("uz-UZ")} so'm</div>
                    </div>
                    <label className="flex items-center gap-1 text-[10px] text-slate-500">
                      <input
                        type="number"
                        value={addon.discountPct}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          setComboAddons((prev) => prev.map((a, j) => j === i ? { ...a, discountPct: v } : a));
                        }}
                        min={0}
                        max={100}
                        className="w-12 bg-white border border-cream-300 rounded px-1 py-0.5 text-xs text-forest-800 text-center"
                      />
                      <span>%</span>
                    </label>
                    <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
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
                      className="text-slate-500 hover:text-rose-600 p-1"
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
              className="w-full py-2 border-2 border-dashed border-cream-300 hover:border-emerald-500/50 hover:bg-leaf-400/5 rounded-lg text-xs text-slate-500 hover:text-forest-700 transition-colors flex items-center justify-center gap-1"
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
          {comboPickerOpen && (() => {
            const available = productsCatalog.filter(
              (p) => p.id !== product?.id && !comboAddons.find((a) => a.addonProductId === p.id),
            );
            return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4" onClick={() => setComboPickerOpen(false)}>
              <div className="bg-white border border-cream-300 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-cream-300 px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-forest-800">Mahsulot qo'shish</h3>
                  <button type="button" onClick={() => setComboPickerOpen(false)} className="p-1 text-slate-500 hover:text-forest-900">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {available.length === 0 ? (
                  <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
                    <div className="w-14 h-14 rounded-full bg-cream-100 flex items-center justify-center">
                      <Package className="w-7 h-7 text-slate-500" />
                    </div>
                    <p className="text-sm font-medium text-forest-800">
                      {productsCatalog.length === 0
                        ? "Hali boshqa mahsulotlar yo'q"
                        : "Hamma mahsulotlar allaqachon qo'shilgan"}
                    </p>
                    <p className="text-xs text-slate-500 max-w-xs">
                      {productsCatalog.length === 0
                        ? "Avval boshqa mahsulotlarni yarating — keyin shu mahsulot bilan birga combo sifatida bog'lashingiz mumkin (Mini App'da \"Bularni ham qo'shing\" sifatida ko'rinadi)."
                        : "Yangi combo qo'shish uchun avval boshqa mahsulot yarating."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setComboPickerOpen(false)}
                      className="mt-1 px-4 py-1.5 bg-cream-100 hover:bg-cream-200 rounded-lg text-xs text-slate-700"
                    >
                      Tushunarli
                    </button>
                  </div>
                ) : (
                <div className="p-2 space-y-1">
                  {available.map((p) => (
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
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-cream-100/60 text-left"
                    >
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-9 h-9 rounded object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-cream-100 flex items-center justify-center">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-forest-800 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-500">{p.sku} · {Number(p.price).toLocaleString("uz-UZ")} so'm</div>
                      </div>
                      <Plus className="w-4 h-4 text-forest-700 flex-shrink-0" />
                    </button>
                  ))}
                </div>
                )}
              </div>
            </div>
            );
          })()}

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-cream-100 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">
                {t("productForm.featured")}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-cream-100 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">{t("productForm.active")}</span>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-100 border border-rose-300 rounded-lg">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          )}
        </div>

        {/* Success overlay — yaratish/saqlashdan keyin */}
        {success && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-20 rounded-2xl">
            <div className="flex flex-col items-center gap-3 px-6 py-8">
              <div className="w-16 h-16 rounded-full bg-leaf-200 flex items-center justify-center animate-in zoom-in duration-300">
                <CheckCircle2 className="w-10 h-10 text-forest-700" />
              </div>
              <p className="text-base font-semibold text-forest-800">{success}</p>
              {name && <p className="text-sm text-slate-500">{name}</p>}
            </div>
          </div>
        )}

        {/* Image upload toast — yuqori o'ngda */}
        {imageToast && (
          <div className="fixed top-6 right-6 z-[90] flex items-center gap-2 px-4 py-2.5 bg-leaf-400 text-forest-800 rounded-lg shadow-2xl animate-in slide-in-from-right duration-200">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">{imageToast}</span>
          </div>
        )}

        <div className="flex items-center gap-2 justify-end p-5 border-t border-cream-300 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:text-forest-900"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-sm font-medium text-forest-800"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {product ? t("common.save") : t("productForm.create")}
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
  const { t } = useT();
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
        className="bg-white border border-cream-300 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b border-cream-300">
          <h2 className="text-lg font-bold text-forest-800">{t("categoriesModal.title")}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAdd} className="p-5 border-b border-cream-300 space-y-2">
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("categoriesModal.newName")}
            className="w-full px-3 py-2 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder={t("categoriesModal.slug")}
            className="w-full px-3 py-2 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-emerald-500"
          />
          <label
            className={`flex items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              uploading
                ? "border-emerald-500/50 bg-leaf-400/5"
                : newImageUrl
                  ? "border-cream-300"
                  : "border-cream-300 hover:border-slate-500 bg-cream-100/30"
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
              <div className="flex items-center gap-2 text-xs text-forest-700">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Yuklanmoqda...
              </div>
            ) : newImageUrl ? (
              <div className="flex items-center gap-2">
                <img src={newImageUrl} alt="preview" className="w-12 h-12 rounded object-cover" />
                <span className="text-xs text-slate-500">Rasmni o'zgartirish</span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Rasm yuklash (ixtiyoriy)</span>
            )}
          </label>
          {newImageUrl && !uploading && (
            <button
              type="button"
              onClick={() => setNewImageUrl("")}
              className="text-[11px] text-rose-600 hover:text-red-300"
            >
              Rasmni olib tashlash
            </button>
          )}
          {uploadError && <p className="text-[11px] text-rose-600">{uploadError}</p>}
          <button
            type="submit"
            disabled={saving || uploading || !newName.trim()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-sm font-medium text-forest-800"
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
                className="flex items-center gap-3 px-3 py-2 hover:bg-cream-100 rounded-lg"
              >
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-cream-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-forest-800 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 truncate">{c.slug}</p>
                </div>
                <button
                  onClick={() => handleDelete(c)}
                  className="p-1.5 rounded text-slate-500 hover:text-rose-600 flex-shrink-0"
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
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
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
              ? "border-emerald-500/50 bg-leaf-400/5"
              : dropZoneActive
                ? "border-emerald-500 bg-leaf-100"
                : "border-cream-300 hover:border-slate-500 bg-cream-100/30"
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
              <Loader2 className="w-6 h-6 text-forest-700 animate-spin" />
              <span className="text-xs text-forest-700">Yuklanmoqda...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ImagePlus className="w-10 h-10 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">
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
              className={`relative group ${isCover ? "col-span-2 row-span-2 aspect-[4/3]" : "aspect-square"} bg-cream-100 rounded-lg overflow-hidden cursor-move transition-all ${
                isDragSource ? "opacity-40" : ""
              } ${isDragTarget ? "ring-2 ring-emerald-500" : ""}`}
            >
              <img src={url} alt={isCover ? "Asosiy rasm" : `${i + 1}-rasm`} className="w-full h-full object-cover pointer-events-none" />

              {/* Asosiy belgisi */}
              {isCover && (
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-leaf-400 text-forest-800 text-[10px] font-bold rounded shadow-lg">
                  ASOSIY
                </div>
              )}

              {/* Tartib raqami (cover'dan tashqari) */}
              {!isCover && (
                <div className="absolute top-1 left-1 w-5 h-5 bg-black/70 text-forest-800 text-[10px] font-medium rounded-full flex items-center justify-center">
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
                      className="px-2 py-1 bg-leaf-400 hover:bg-leaf-500 rounded text-[10px] font-medium text-forest-800 shadow"
                      title="Asosiy qilish"
                    >
                      <Star className="w-3 h-3 inline mr-0.5" />
                      Asosiy
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="w-7 h-7 bg-rose-500 hover:bg-rose-600 rounded flex items-center justify-center text-forest-800 shadow"
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
                ? "border-emerald-500 bg-leaf-100"
                : "border-cream-300 hover:border-slate-500 bg-cream-100/30"
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
          <div className="aspect-square flex items-center justify-center border-2 border-dashed border-emerald-500/50 rounded-lg bg-leaf-400/5">
            <Loader2 className="w-5 h-5 text-forest-700 animate-spin" />
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 mt-2">
        💡 <span className="text-slate-500">Birinchi rasm — asosiy</span> · rasmni sudrab tartibini o'zgartiring · hover qilib ⭐ "Asosiy" yoki 🗑 "O'chirish" tanlang
      </p>
    </Field>
  );
}
