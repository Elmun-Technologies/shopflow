import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, ChevronDown, ChevronUp, Loader2, Image, Layers, Tag, FileText, Save, Sparkles } from "lucide-react";
import { api, ApiError, type UISchema, type UIBanner, type UISection, type AdminCategory, type AdminProduct, type BannerAction } from "../lib/api";
import { useNotifications } from "../lib/notifications";

interface Props {
  botId: string;
  open: boolean;
  onClose: () => void;
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

const defaultSchema: UISchema = {
  version: 1,
  theme: { primary: "#10b981" },
  welcomeMessage: "Assalomu alaykum! Pastdagi tugmalardan foydalaning.",
  banners: [],
  sections: [
    { type: "categories", id: "default-cats", title: "Kategoriyalar", layout: "scroll" },
    { type: "products", id: "default-featured", title: "Mahsulotlar", filter: { limit: 12 } },
  ],
};

export default function BotUiEditor({ botId, open, onClose }: Props) {
  const { toast } = useNotifications();
  const [schema, setSchema] = useState<UISchema | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.bots.getUiSchema(botId).catch(() => defaultSchema),
      api.products.categories.list().catch(() => []),
      api.products.list().catch(() => []),
    ]).then(([s, cats, prods]) => {
      setSchema(s);
      setCategories(cats);
      setProducts(prods);
    }).catch((err) => {
      setError(err instanceof ApiError ? err.message : "Yuklab bo'lmadi");
    }).finally(() => setLoading(false));
  }, [open, botId]);

  async function save() {
    if (!schema) return;
    setSaving(true);
    try {
      await api.bots.saveUiSchema(botId, schema);
      toast({ kind: "success", title: "Bot UI saqlandi", description: "Mini App'da o'zgarishlar darhol ko'rinadi" });
      onClose();
    } catch (err) {
      toast({ kind: "error", title: "Xato", description: err instanceof ApiError ? err.message : "Saqlanmadi" });
    } finally {
      setSaving(false);
    }
  }

  function addBanner() {
    if (!schema) return;
    setSchema({ ...schema, banners: [...schema.banners, { type: "banner", id: newId("banner"), title: "", subtitle: "", imageUrl: "", action: { kind: "none" } }] });
  }

  function updateBanner(id: string, patch: Partial<UIBanner>) {
    if (!schema) return;
    setSchema({ ...schema, banners: schema.banners.map((b) => b.id === id ? { ...b, ...patch } : b) });
  }

  function removeBanner(id: string) {
    if (!schema) return;
    setSchema({ ...schema, banners: schema.banners.filter((b) => b.id !== id) });
  }

  function moveBanner(id: string, dir: -1 | 1) {
    if (!schema) return;
    const idx = schema.banners.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= schema.banners.length) return;
    const arr = [...schema.banners];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    setSchema({ ...schema, banners: arr });
  }

  function addSection(type: UISection["type"]) {
    if (!schema) return;
    let s: UISection;
    if (type === "categories") s = { type, id: newId("cats"), title: "Kategoriyalar", layout: "scroll" };
    else if (type === "products") s = { type, id: newId("prods"), title: "Tavsiya etilgan", filter: { limit: 8 } };
    else s = { type, id: newId("text"), title: "Ma'lumot", body: "" };
    setSchema({ ...schema, sections: [...schema.sections, s] });
  }

  function updateSection(id: string, patch: Partial<UISection>) {
    if (!schema) return;
    setSchema({
      ...schema,
      sections: schema.sections.map((s) => s.id === id ? ({ ...s, ...patch } as UISection) : s),
    });
  }

  function removeSection(id: string) {
    if (!schema) return;
    setSchema({ ...schema, sections: schema.sections.filter((s) => s.id !== id) });
  }

  function moveSection(id: string, dir: -1 | 1) {
    if (!schema) return;
    const idx = schema.sections.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= schema.sections.length) return;
    const arr = [...schema.sections];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    setSchema({ ...schema, sections: arr });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-stretch justify-end bg-black/70" onClick={onClose}>
          <motion.div initial={{ x: 600 }} animate={{ x: 0 }} exit={{ x: 600 }} transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-slate-950 border-l border-slate-800 overflow-y-auto"
          >
            <div className="px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-950 z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold">Bot UI Editor</h2>
                  <p className="text-xs text-slate-500">Mini App va bot menyusi ko'rinishi</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loading || !schema ? (
              <div className="p-12 flex items-center justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Yuklanmoqda…</div>
            ) : error ? (
              <div className="p-6 text-amber-400 text-sm">{error}</div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Welcome message */}
                <Section title="Salomlashish xabari" icon={FileText}>
                  <textarea
                    value={schema.welcomeMessage}
                    onChange={(e) => setSchema({ ...schema, welcomeMessage: e.target.value })}
                    rows={2}
                    className={input + " min-h-[60px]"}
                    placeholder="Xush kelibsiz..."
                  />
                </Section>

                {/* Banners */}
                <Section title={`Bannerlar (${schema.banners.length})`} icon={Image}>
                  {schema.banners.map((b, i) => (
                    <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-slate-500">Banner #{i + 1}</p>
                        <div className="flex gap-1">
                          <IconBtn onClick={() => moveBanner(b.id, -1)} title="Yuqoriga"><ChevronUp className="w-4 h-4" /></IconBtn>
                          <IconBtn onClick={() => moveBanner(b.id, 1)} title="Pastga"><ChevronDown className="w-4 h-4" /></IconBtn>
                          <IconBtn onClick={() => removeBanner(b.id)} title="O'chirish" danger><Trash2 className="w-4 h-4" /></IconBtn>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <input value={b.title} onChange={(e) => updateBanner(b.id, { title: e.target.value })} placeholder="Sarlavha" className={input} />
                        <input value={b.subtitle} onChange={(e) => updateBanner(b.id, { subtitle: e.target.value })} placeholder="Subtitle" className={input} />
                        <input type="url" value={b.imageUrl} onChange={(e) => updateBanner(b.id, { imageUrl: e.target.value })} placeholder="Rasm URL (https://...)" className={input} />
                        <BannerActionEditor action={b.action} categories={categories} products={products} onChange={(a) => updateBanner(b.id, { action: a })} />
                      </div>
                    </div>
                  ))}
                  <button onClick={addBanner} className="w-full bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 text-slate-400 text-sm py-3 rounded-xl flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Yangi banner
                  </button>
                </Section>

                {/* Sections */}
                <Section title={`Bo'limlar (${schema.sections.length})`} icon={Layers}>
                  {schema.sections.map((s, i) => (
                    <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-slate-500">{sectionTypeLabel(s.type)} · #{i + 1}</p>
                        <div className="flex gap-1">
                          <IconBtn onClick={() => moveSection(s.id, -1)} title="Yuqoriga"><ChevronUp className="w-4 h-4" /></IconBtn>
                          <IconBtn onClick={() => moveSection(s.id, 1)} title="Pastga"><ChevronDown className="w-4 h-4" /></IconBtn>
                          <IconBtn onClick={() => removeSection(s.id)} title="O'chirish" danger><Trash2 className="w-4 h-4" /></IconBtn>
                        </div>
                      </div>
                      <SectionEditor section={s} categories={categories} products={products} onChange={(patch) => updateSection(s.id, patch)} />
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => addSection("categories")} className="bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 text-slate-400 text-xs py-3 rounded-xl flex items-center justify-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> Kategoriya
                    </button>
                    <button onClick={() => addSection("products")} className="bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 text-slate-400 text-xs py-3 rounded-xl flex items-center justify-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> Mahsulotlar
                    </button>
                    <button onClick={() => addSection("text")} className="bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 text-slate-400 text-xs py-3 rounded-xl flex items-center justify-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Matn
                    </button>
                  </div>
                </Section>
              </div>
            )}

            <div className="px-6 py-4 border-t border-slate-800 sticky bottom-0 bg-slate-950 flex gap-2">
              <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg">Bekor</button>
              <button onClick={save} disabled={saving || !schema} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Saqlash va publish
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function sectionTypeLabel(t: UISection["type"]) {
  return t === "categories" ? "Kategoriyalar" : t === "products" ? "Mahsulotlar" : "Matn bloki";
}

function SectionEditor({ section, categories, products, onChange }: { section: UISection; categories: AdminCategory[]; products: AdminProduct[]; onChange: (p: Partial<UISection>) => void }) {
  if (section.type === "categories") {
    return (
      <div className="space-y-2">
        <input value={section.title} onChange={(e) => onChange({ title: e.target.value } as Partial<UISection>)} placeholder="Sarlavha" className={input} />
        <select value={section.layout} onChange={(e) => onChange({ layout: e.target.value as "scroll" | "grid" | "list" } as Partial<UISection>)} className={input}>
          <option value="scroll">Gorizontal scroll</option>
          <option value="grid">Grid (3 ustunli)</option>
          <option value="list">Vertikal ro'yxat</option>
        </select>
      </div>
    );
  }
  if (section.type === "products") {
    return (
      <div className="space-y-2">
        <input value={section.title} onChange={(e) => onChange({ title: e.target.value } as Partial<UISection>)} placeholder="Sarlavha" className={input} />
        <select
          value={section.filter.categoryId ?? ""}
          onChange={(e) => onChange({ filter: { ...section.filter, categoryId: e.target.value || undefined } } as Partial<UISection>)}
          className={input}
        >
          <option value="">Hamma kategoriya</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          type="number"
          value={section.filter.limit}
          onChange={(e) => onChange({ filter: { ...section.filter, limit: Math.max(1, Math.min(50, Number(e.target.value))) } } as Partial<UISection>)}
          placeholder="Limit"
          className={input}
          min={1} max={50}
        />
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-300">Aniq mahsulotlarni tanlash ({section.filter.productIds?.length ?? 0})</summary>
          <div className="mt-2 max-h-40 overflow-y-auto space-y-1 pr-2">
            {products.map((p) => {
              const checked = section.filter.productIds?.includes(p.id) ?? false;
              return (
                <label key={p.id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const cur = section.filter.productIds ?? [];
                      const next = e.target.checked ? [...cur, p.id] : cur.filter((id) => id !== p.id);
                      onChange({ filter: { ...section.filter, productIds: next.length > 0 ? next : undefined } } as Partial<UISection>);
                    }}
                  />
                  <span className="truncate">{p.name}</span>
                </label>
              );
            })}
          </div>
        </details>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <input value={section.title ?? ""} onChange={(e) => onChange({ title: e.target.value } as Partial<UISection>)} placeholder="Sarlavha (ixtiyoriy)" className={input} />
      <textarea value={section.body} onChange={(e) => onChange({ body: e.target.value } as Partial<UISection>)} rows={4} placeholder="Matn..." className={input + " min-h-[80px]"} />
    </div>
  );
}

function BannerActionEditor({ action, categories, products, onChange }: { action: BannerAction; categories: AdminCategory[]; products: AdminProduct[]; onChange: (a: BannerAction) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <select value={action.kind} onChange={(e) => {
        const k = e.target.value as BannerAction["kind"];
        if (k === "category") onChange({ kind: "category", categoryId: categories[0]?.id ?? "" });
        else if (k === "product") onChange({ kind: "product", productId: products[0]?.id ?? "" });
        else if (k === "url") onChange({ kind: "url", url: "" });
        else onChange({ kind: "none" });
      }} className={input + " col-span-1"}>
        <option value="none">Harakatsiz</option>
        <option value="category">Kategoriyaga</option>
        <option value="product">Mahsulotga</option>
        <option value="url">URL</option>
      </select>
      {action.kind === "category" && (
        <select value={action.categoryId} onChange={(e) => onChange({ kind: "category", categoryId: e.target.value })} className={input + " col-span-2"}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {action.kind === "product" && (
        <select value={action.productId} onChange={(e) => onChange({ kind: "product", productId: e.target.value })} className={input + " col-span-2"}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      {action.kind === "url" && (
        <input type="url" value={action.url} onChange={(e) => onChange({ kind: "url", url: e.target.value })} placeholder="https://..." className={input + " col-span-2"} />
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-slate-300">
        <Icon className="w-4 h-4" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      {children}
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} className={`p-1.5 rounded ${danger ? "text-slate-400 hover:text-red-400 hover:bg-red-500/10" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>
      {children}
    </button>
  );
}

const input = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50";
