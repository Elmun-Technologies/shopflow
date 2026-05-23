// Admin: sale campaign / aksiya boshqaruvi.
// Bir nechta mahsulotni rangli badge (Распродажа / Hit / Yangi va h.k.) bilan
// guruhlash, vaqt cheklovi qo'yish.

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Tag as TagIcon, Edit2, Trash2, Loader2, Eye, EyeOff, X, Calendar, Package as PackageIcon, Search,
} from "lucide-react";
import { api } from "../api/client";
import { useT } from "../i18n";
import { useAppToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmDialog";

type BadgeColor = "RED" | "ORANGE" | "EMERALD" | "PURPLE" | "BLUE";

interface SaleCampaignSummary {
  id: string;
  name: string;
  label: string;
  badgeColor: BadgeColor;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  productCount: number;
  createdAt: string;
}

interface SaleCampaignDetail extends SaleCampaignSummary {
  products: Array<{ id: string; name: string; sku: string; price: string | number; oldPrice: string | number | null; imageUrl: string | null }>;
}

interface ProductMini {
  id: string;
  name: string;
  sku: string;
  price: string | number;
  imageUrl: string | null;
}

const BADGE_BG: Record<BadgeColor, string> = {
  RED: "bg-rose-500 text-forest-800",
  ORANGE: "bg-orange-500 text-forest-800",
  EMERALD: "bg-leaf-400 text-forest-800",
  PURPLE: "bg-purple-500 text-forest-800",
  BLUE: "bg-blue-500 text-forest-800",
};

const BADGE_LABEL: Record<BadgeColor, string> = {
  RED: "Qizil",
  ORANGE: "To'q sariq",
  EMERALD: "Yashil",
  PURPLE: "Binafsha",
  BLUE: "Ko'k",
};

const saleApi = {
  list: () => api<{ campaigns: SaleCampaignSummary[] }>("/sale-campaigns"),
  get: (id: string) => api<SaleCampaignDetail>(`/sale-campaigns/${id}`),
  create: (data: Partial<SaleCampaignDetail> & { productIds?: string[] }) =>
    api<SaleCampaignSummary>("/sale-campaigns", { method: "POST", body: data as never }),
  update: (id: string, data: Partial<SaleCampaignDetail> & { productIds?: string[] }) =>
    api<SaleCampaignSummary>(`/sale-campaigns/${id}`, { method: "PATCH", body: data as never }),
  remove: (id: string) => api<void>(`/sale-campaigns/${id}`, { method: "DELETE" }),
};

const productsApi = {
  list: (params: { search?: string; page?: number; pageSize?: number }) =>
    api<{ items: ProductMini[]; total: number }>("/products", { query: params }),
};

export default function SaleCampaignsPage() {
  const { t } = useT();
  const [list, setList] = useState<SaleCampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const toast = useAppToast();
  const confirmDialog = useConfirm();

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await saleApi.list();
      setList(res.campaigns);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklashda xato");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (c: SaleCampaignSummary) => {
    try {
      await saleApi.update(c.id, { active: !c.active });
      toast.success(c.active ? "Aksiya yashirildi" : "Aksiya yoqildi");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yangilanmadi");
    }
  };

  const remove = async (c: SaleCampaignSummary) => {
    const ok = await confirmDialog({
      title: "Aksiya o'chirilsinmi?",
      description: `"${c.name}" o'chiriladi (mahsulotlarda yorliq olib tashlanadi).`,
      kind: "danger",
      confirmText: "O'chirish",
    });
    if (!ok) return;
    try {
      await saleApi.remove(c.id);
      toast.success("Aksiya o'chirildi");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O'chirilmadi");
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-forest-800 flex items-center gap-2">
            <TagIcon className="w-6 h-6 text-rose-600" />
            {t("campaigns.title")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("campaigns.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 rounded-lg text-sm font-medium text-forest-800"
        >
          <Plus className="w-4 h-4" />
          {t("campaigns.newCampaign")}
        </button>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white border border-cream-300 rounded-xl py-20 px-6 text-center">
          <TagIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-forest-800 mb-1">Aksiyalar yo'q</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            Yangi aksiya yarating va mahsulotlarni biriktiring — Mini App'da har kartochkada rangli yorliq paydo bo'ladi.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg text-sm font-medium text-forest-800"
          >
            <Plus className="w-4 h-4" />
            Birinchi aksiya
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map((c) => (
            <div key={c.id} className="bg-white border border-cream-300 rounded-2xl p-4 hover:border-cream-300 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${BADGE_BG[c.badgeColor]}`}>
                      {c.label}
                    </span>
                    {c.active ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-leaf-100 text-forest-700">Faol</span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cream-100 text-slate-500">O'chirilgan</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-forest-800 truncate">{c.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <PackageIcon className="w-3 h-3" />
                      {c.productCount} mahsulot
                    </span>
                    {(c.startsAt || c.endsAt) && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {c.startsAt ? new Date(c.startsAt).toLocaleDateString("uz-UZ") : "—"}
                        {" → "}
                        {c.endsAt ? new Date(c.endsAt).toLocaleDateString("uz-UZ") : "muddatsiz"}
                      </span>
                    )}
                    {c.priority > 0 && <span>P:{c.priority}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 border-t border-cream-300 pt-2">
                <button onClick={() => toggleActive(c)} className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100" title={c.active ? "Yashirish" : "Yoqish"}>
                  {c.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => setEditingId(c.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100" title="Tahrirlash">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => remove(c)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-100" title="O'chirish">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editingId) && (
        <CampaignEditor
          campaignId={editingId}
          onClose={() => { setCreating(false); setEditingId(null); }}
          onSaved={() => { setCreating(false); setEditingId(null); refresh(); }}
        />
      )}
    </>
  );
}

function CampaignEditor({
  campaignId, onClose, onSaved,
}: {
  campaignId: string | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!campaignId;
  const toast = useAppToast();

  const [form, setForm] = useState({
    name: "",
    label: "Распродажа",
    badgeColor: "RED" as BadgeColor,
    active: true,
    priority: 0,
    startsAt: "",
    endsAt: "",
  });
  const [productIds, setProductIds] = useState<Set<string>>(new Set());
  const [productsList, setProductsList] = useState<ProductMini[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Load campaign + products
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isEdit && campaignId) {
          const c = await saleApi.get(campaignId);
          if (!cancelled) {
            setForm({
              name: c.name,
              label: c.label,
              badgeColor: c.badgeColor,
              active: c.active,
              priority: c.priority,
              startsAt: c.startsAt ? c.startsAt.slice(0, 16) : "",
              endsAt: c.endsAt ? c.endsAt.slice(0, 16) : "",
            });
            setProductIds(new Set(c.products.map((p) => p.id)));
          }
        }
        const res = await productsApi.list({ pageSize: 100, search: search || undefined });
        if (!cancelled) setProductsList(res.items);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Yuklashda xato");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, search]);

  const filteredProducts = useMemo(() => productsList, [productsList]);

  const toggleProduct = (id: string) => {
    setProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!form.name.trim() || !form.label.trim()) {
      toast.error("Nom va yorliq matni bo'sh bo'lmasin");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        label: form.label,
        badgeColor: form.badgeColor,
        active: form.active,
        priority: form.priority,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        productIds: Array.from(productIds),
      };
      if (isEdit && campaignId) {
        await saleApi.update(campaignId, payload);
        toast.success("Aksiya saqlandi");
      } else {
        await saleApi.create(payload);
        toast.success("Aksiya yaratildi");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlashda xato");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={onClose}>
      <div
        className="bg-white border border-cream-300 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-cream-300 px-5 py-3 flex items-center justify-between z-10">
          <h2 className="text-base font-semibold text-forest-800">{isEdit ? "Aksiya tahrirlash" : "Yangi aksiya"}</h2>
          <button onClick={onClose} className="p-1 -mr-1 text-slate-500 hover:text-forest-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <Field label="Nom (ichki)" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Yangi yil chegirmasi" />
            <Field label="Yorliq matni (kartochkada ko'rinadi)" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="Распродажа" />

            <div>
              <div className="text-xs text-slate-500 mb-2">Yorliq rangi</div>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(BADGE_BG) as BadgeColor[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, badgeColor: c })}
                    className={`px-2 py-1.5 rounded-md text-[10px] font-bold ${BADGE_BG[c]} ${
                      form.badgeColor === c ? "ring-2 ring-offset-2 ring-offset-slate-900 ring-white/30" : "opacity-60"
                    }`}
                  >
                    {BADGE_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Boshlanish" type="datetime-local" value={form.startsAt} onChange={(v) => setForm({ ...form, startsAt: v })} />
              <Field label="Tugash" type="datetime-local" value={form.endsAt} onChange={(v) => setForm({ ...form, endsAt: v })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Prioritet" type="number" value={String(form.priority)} onChange={(v) => setForm({ ...form, priority: Number(v) || 0 })} />
              <label className="flex items-end pb-2 gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 rounded bg-cream-100 border-cream-300 text-emerald-500 focus:ring-emerald-500/50"
                />
                <span className="text-sm text-forest-700">Faol</span>
              </label>
            </div>

            {/* Product picker */}
            <div className="pt-3 border-t border-cream-300">
              <div className="text-xs text-slate-500 mb-2">Mahsulotlar ({productIds.size} tanlangan)</div>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Mahsulot qidirish..."
                  className="w-full bg-cream-100 border border-cream-300 rounded-lg pl-9 pr-3 py-2 text-sm text-forest-800 placeholder-slate-400"
                />
              </div>
              <div className="border border-cream-300 rounded-lg max-h-60 overflow-y-auto divide-y divide-cream-300">
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 text-center">Mahsulot topilmadi</p>
                ) : (
                  filteredProducts.map((p) => (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-cream-100/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={productIds.has(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="w-4 h-4 rounded bg-cream-100 border-cream-300 text-emerald-500"
                      />
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-cream-100 flex items-center justify-center">
                          <PackageIcon className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-forest-800 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-500">{p.sku}</div>
                      </div>
                      <div className="text-xs text-slate-500">{Number(p.price).toLocaleString("uz-UZ")}</div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 bg-white border-t border-cream-300 px-5 py-3 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-slate-700 bg-cream-100 hover:bg-cream-200 rounded-lg font-medium">
            Bekor
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex-1 py-2.5 text-sm bg-rose-500 hover:bg-rose-600 disabled:opacity-50 rounded-lg font-semibold text-forest-800 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Saqlash" : "Yaratish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
      />
    </label>
  );
}
