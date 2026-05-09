import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, RefreshCw, Plus, Pencil, Trash2, X, Package, Tag } from "lucide-react";
import { api, ApiError, type AdminCategory, type AdminProduct } from "../lib/api";
import { useNotifications } from "../lib/notifications";

export default function LiveCatalogPanel() {
  const { toast, onShopEvent } = useNotifications();
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminProduct | null | "new">(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [prods, cats] = await Promise.all([api.products.list(), api.products.categories.list()]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xato");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return onShopEvent((ev) => {
      if (ev.type === "product.updated") void load();
    });
  }, [onShopEvent]);

  async function remove(id: string) {
    if (!confirm("Mahsulotni o'chirishga ishonchingiz komilmi?")) return;
    try {
      await api.products.remove(id);
      setProducts((p) => p ? p.filter((x) => x.id !== id) : p);
      toast({ kind: "success", title: "Mahsulot o'chirildi" });
    } catch (err) {
      toast({ kind: "error", title: "Xato", description: err instanceof ApiError ? err.message : "" });
    }
  }

  if (loading && !products) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex items-center justify-center text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yuklanmoqda…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="text-white font-semibold">📦 Live katalog (Telegram bot ko'rsatadi)</h3>
            <p className="text-xs text-slate-500">{products?.length ?? 0} mahsulot · {categories.length} kategoriya</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400" title="Yangilash">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setEditing("new")} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Yangi mahsulot
          </button>
        </div>
      </div>

      {error && (
        <div className="p-6 text-sm text-amber-400 bg-amber-500/5">
          ⚠️ {error}. Backend (server: <code>http://localhost:4000</code>) ishga tushganligini tekshiring.
        </div>
      )}

      {products && products.length === 0 ? (
        <div className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">Hali Telegram bot uchun mahsulot yo'q</p>
          <button onClick={() => setEditing("new")} className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg">
            Birinchi mahsulot qo'shish
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-6">
          {products?.map((p) => {
            const cat = categories.find((c) => c.id === p.categoryId);
            return (
              <div key={p.id} className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden group">
                <div className="aspect-square bg-slate-900 overflow-hidden">
                  {p.images[0] ? (
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-700"><Package className="w-10 h-10" /></div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-white line-clamp-1">{p.name}</p>
                  {cat && <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1"><Tag className="w-2.5 h-2.5" />{cat.name}</p>}
                  <p className="text-emerald-400 font-semibold text-sm mt-1">{p.price.toLocaleString()} so'm</p>
                  <p className={`text-[10px] mt-0.5 ${p.stock > 5 ? "text-slate-500" : p.stock > 0 ? "text-amber-400" : "text-red-400"}`}>
                    Qoldiq: {p.stock}
                  </p>
                  <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditing(p)} className="flex-1 text-xs bg-slate-700 hover:bg-slate-600 text-white py-1 rounded">
                      <Pencil className="w-3 h-3 inline" /> Tahrir
                    </button>
                    <button onClick={() => remove(p.id)} className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 py-1 px-2 rounded">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <ProductEditor
            product={editing === "new" ? null : editing}
            categories={categories}
            onClose={() => setEditing(null)}
            onSaved={(p) => {
              setProducts((prev) => {
                if (!prev) return [p];
                const idx = prev.findIndex((x) => x.id === p.id);
                return idx < 0 ? [p, ...prev] : prev.map((x) => x.id === p.id ? p : x);
              });
              setEditing(null);
              toast({ kind: "success", title: editing === "new" ? "Mahsulot qo'shildi" : "Yangilandi" });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductEditor({ product, categories, onClose, onSaved }: { product: AdminProduct | null; categories: AdminCategory[]; onClose: () => void; onSaved: (p: AdminProduct) => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price ?? 0);
  const [stock, setStock] = useState(product?.stock ?? 0);
  const [categoryId, setCategoryId] = useState<string | null>(product?.categoryId ?? null);
  const [imageUrl, setImageUrl] = useState(product?.images[0] ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name, description: description || undefined, price, stock,
        categoryId: categoryId || null,
        images: imageUrl ? [imageUrl] : [],
        active,
      };
      const result = product
        ? await api.products.update(product.id, body)
        : await api.products.create(body);
      onSaved(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-white font-semibold">{product ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <Field label="Nomi *">
            <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </Field>
          <Field label="Tavsifi">
            <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${input} min-h-[80px]`} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Narx (so'm) *">
              <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className={input} />
            </Field>
            <Field label="Qoldiq">
              <input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} className={input} />
            </Field>
          </div>
          <Field label="Kategoriya">
            <select value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value || null)} className={input}>
              <option value="">— tanlang —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Rasm URL">
            <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className={input} />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer" onClick={() => setActive((v) => !v)}>
            <div className={`w-5 h-5 rounded border ${active ? "bg-emerald-600 border-emerald-500" : "border-slate-600"} flex items-center justify-center`}>
              {active && <span className="text-white text-xs">✓</span>}
            </div>
            <span className="text-sm text-slate-300">Faol (Telegram'da ko'rinadi)</span>
          </label>

          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg">Bekor</button>
            <button onClick={save} disabled={saving || !name.trim() || price <= 0} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Saqlash
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const input = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
