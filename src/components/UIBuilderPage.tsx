import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, GripVertical, Eye, EyeOff, Trash2, Copy, Palette,
  LayoutTemplate, Smartphone, Monitor, Save, ChevronDown, ChevronRight,
  Plus, Image, Sparkles, Percent, TrendingUp, Crown, Calendar,
  Grid3X3, Zap, Sun, Heart, LayoutGrid, List, LayoutTemplate as LayoutIcon,
  Play, Megaphone, X, Type, Phone, Mail, MapPin, ShoppingBag,
  Clock, Package, CheckCircle2, ArrowUp, ArrowDown, Loader2, Globe,
} from "lucide-react";
import {
  blockDefinitions, templates, defaultBrandSettings, categoryColors,
} from "../data/uiBuilderData";
import type { UIBlock, BrandSettings } from "../data/uiBuilderData";
import { vitrinaApi, productsApi, categoriesApi } from "../api/endpoints";
import type { Product, Category } from "../types/api";
import { useT } from "../i18n";

const iconMap: Record<string, React.ElementType> = {
  Image, Sparkles, Percent, TrendingUp, Crown, Calendar, Grid3X3, Zap, Sun, Heart,
  LayoutGrid, List, LayoutIcon, Play, Megaphone, Search, Type,
};

type PreviewProduct = {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  imageUrl?: string;
  categoryName?: string;
};

function toPreviewProduct(p: Product): PreviewProduct {
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price),
    oldPrice: p.oldPrice != null ? Number(p.oldPrice) : undefined,
    imageUrl: p.imageUrl ?? undefined,
    categoryName: p.category?.name,
  };
}

export default function UIBuilderPage() {
  const { t } = useT();
  const [blocks, setBlocks] = useState<UIBlock[]>([]);
  const [brand, setBrand] = useState<BrandSettings>(JSON.parse(JSON.stringify(defaultBrandSettings)));
  const [published, setPublished] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("mobile");
  const [activePanel, setActivePanel] = useState<"blocks" | "templates" | "brand">("blocks");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["products", "navigation", "media"]));
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [savedMessage, setSavedMessage] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<PreviewProduct[]>([]);
  const [realCategories, setRealCategories] = useState<Category[]>([]);
  const dragCounter = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [layout, prods, cats] = await Promise.all([
          vitrinaApi.getLayout(),
          productsApi.list({ pageSize: 50 }),
          categoriesApi.list(),
        ]);
        if (cancelled) return;

        const savedBlocks = layout.blocks as unknown as UIBlock[];
        setBlocks(
          savedBlocks.length > 0
            ? savedBlocks
            : JSON.parse(JSON.stringify(templates[3].blocks)).map((b: UIBlock) => ({
                ...b,
                id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              }))
        );
        setBrand({ ...defaultBrandSettings, ...(layout.brand as Partial<BrandSettings>) });
        setPublished(layout.published);
        setPreviewProducts(prods.items.map(toPreviewProduct));
        setRealCategories(cats);
      } catch {
        // use defaults on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);
  const selectedDef = blockDefinitions.find((d) => d.type === selectedBlock?.type);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const addBlock = useCallback((def: typeof blockDefinitions[0]) => {
    const newBlock: UIBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: def.type,
      title: def.label,
      enabled: true,
      settings: JSON.parse(JSON.stringify(def.defaultSettings)),
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setSelectedBlockId((prev) => (prev === id ? null : prev));
  }, []);

  const duplicateBlock = useCallback((block: UIBlock) => {
    const newBlock: UIBlock = {
      ...JSON.parse(JSON.stringify(block)),
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: block.title + " (nusxa)",
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }, []);

  const toggleBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b)));
  }, []);

  const updateBlockSetting = useCallback((id: string, key: string, value: unknown) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, settings: { ...b.settings, [key]: value } } : b))
    );
  }, []);

  const updateBlockTitle = useCallback((id: string, title: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, title } : b)));
  }, []);

  const applyTemplate = useCallback((templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      setBlocks(JSON.parse(JSON.stringify(tpl.blocks)).map((b: UIBlock) => ({
        ...b,
        id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      })));
      setSelectedBlockId(null);
    }
  }, []);

  const moveBlock = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setBlocks((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    moveBlock(index, index - 1);
  }, [moveBlock]);

  const moveDown = useCallback((index: number) => {
    setBlocks((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      next.splice(index + 1, 0, removed);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    // Agar yashirin holatda saqlanmoqchi bo'lsa — operator'dan tasdiq so'rash.
    // Aks holda mijoz Mini App'da "Do'kon yopiq" ko'radi va sabab tushunmaydi.
    if (!published) {
      const choice = window.confirm(
        "⚠️ Vitrina yashirin holatda saqlanmoqda.\n\n" +
        "Saqlasangiz mijozlar do'konni Telegram'da ochib ko'ra olmaydi (\"Do'kon yopiq\" xabari chiqadi).\n\n" +
        "OK — yashirin holda saqlash\n" +
        "Cancel — bekor qilish (so'ng \"Nashr\" tugmasini bosing)"
      );
      if (!choice) return;
    }
    setSaving(true);
    try {
      await vitrinaApi.saveLayout({ blocks, brand: brand as unknown as Record<string, unknown>, published });
      setSavedMessage(t("ui.saved"));
      setTimeout(() => setSavedMessage(""), 2500);
    } catch {
      setSavedMessage(t("common.error"));
      setTimeout(() => setSavedMessage(""), 2500);
    } finally {
      setSaving(false);
    }
  }, [blocks, brand, published, t]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (index: number) => {
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    dragCounter.current = 0;
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      moveBlock(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDropAtEnd = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    if (draggedIndex !== null && draggedIndex !== blocks.length - 1) {
      moveBlock(draggedIndex, blocks.length - 1);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getProducts = (count: number, categoryName?: string) => {
    const prods = categoryName
      ? previewProducts.filter((p) => p.categoryName === categoryName)
      : previewProducts;
    const result = prods.slice(0, Math.max(1, count));
    // pad with placeholders if not enough real products
    if (result.length === 0) {
      return Array.from<unknown, PreviewProduct>({ length: Math.min(count, 4) }, (_, i) => ({
        id: `placeholder-${i}`,
        name: `Mahsulot ${i + 1}`,
        price: 0,
      }));
    }
    return result;
  };

  const renderPreviewBlock = (block: UIBlock, isMobile: boolean) => {
    const s = block.settings;
    if (!block.enabled) return null;

    switch (block.type) {
      case "hero_banner":
        return (
          <div className="w-full rounded-xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${s.bgColor || brand.primaryColor}, ${brand.secondaryColor})` }}>
            <div className="p-5">
              <h2 className="text-lg font-bold text-forest-800">{s.title}</h2>
              <p className="text-xs text-forest-800/80 mt-1">{s.subtitle}</p>
              <button className="mt-3 px-4 py-2 bg-white text-slate-900 text-xs font-semibold rounded-lg">{s.buttonText}</button>
            </div>
          </div>
        );

      case "new_products":
      case "discounts":
      case "trending":
      case "bestsellers":
      case "preorder":
      case "category_products":
      case "recommended": {
        const prods = getProducts(s.count || 4, s.category);
        return (
          <div className="w-full">
            <h3 className="text-sm font-semibold text-forest-800 mb-2">{s.title}</h3>
            <div className={`grid gap-2 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
              {prods.map((p) => (
                <div key={p.id} className="bg-cream-100 rounded-xl p-2.5 hover:bg-slate-750 transition-colors">
                  <div className="w-full h-20 bg-cream-200 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-7 h-7 text-slate-500" />
                    )}
                  </div>
                  <p className="text-[10px] text-forest-800 truncate">{p.name}</p>
                  <p className="text-[10px] text-forest-700 font-bold mt-0.5">
                    {p.price > 0 ? p.price.toLocaleString() : "—"}
                  </p>
                  {p.oldPrice != null && (
                    <p className="text-[9px] text-slate-500 line-through">{p.oldPrice.toLocaleString()}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "flash_sale": {
        const fsProds = getProducts(s.count || 4);
        return (
          <div className="w-full bg-rose-100 border border-rose-300 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-rose-600">{s.title}</h3>
              {s.showTimer && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-rose-600" />
                  <span className="text-xs text-rose-600 font-mono">04:23:15</span>
                </div>
              )}
            </div>
            <div className={`grid gap-2 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
              {fsProds.map((p) => (
                <div key={p.id} className="bg-cream-100 rounded-xl p-2.5">
                  <div className="w-full h-20 bg-cream-200 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-7 h-7 text-slate-500" />
                    )}
                  </div>
                  <p className="text-[10px] text-forest-800 truncate">{p.name}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] text-rose-600 font-bold">
                      {p.price > 0 ? p.price.toLocaleString() : "—"}
                    </p>
                    {p.oldPrice != null && (
                      <p className="text-[9px] text-slate-500 line-through">{p.oldPrice.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "product_of_day": {
        const pod = previewProducts[0];
        return (
          <div className="w-full bg-amber-100 border border-amber-300 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-amber-500 mb-3">{s.title}</h3>
            {pod ? (
              <div className="flex gap-3">
                <div className="w-24 h-24 bg-cream-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {pod.imageUrl ? (
                    <img src={pod.imageUrl} alt={pod.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-10 h-10 text-slate-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-forest-800 truncate">{pod.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg font-bold text-forest-700">{pod.price.toLocaleString()}</span>
                    {pod.oldPrice != null && <span className="text-sm text-slate-500 line-through">{pod.oldPrice.toLocaleString()}</span>}
                  </div>
                  {s.showStockBar && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-cream-200 rounded-full overflow-hidden">
                        <div className="h-full w-[40%] bg-amber-500 rounded-full" />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span className="text-xs text-amber-500 font-mono">08:45:22</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Mahsulotlar yo'q</div>
            )}
          </div>
        );
      }

      case "popular_categories":
        return (
          <div className="w-full">
            <h3 className="text-sm font-semibold text-forest-800 mb-2">{s.title}</h3>
            <div className={`grid gap-2 ${isMobile ? "grid-cols-3" : "grid-cols-6"}`}>
              {(realCategories.length > 0 ? realCategories : []).slice(0, s.count || 6).map((cat) => (
                <div key={cat.id} className="bg-cream-100 rounded-xl p-3 text-center hover:bg-slate-750 transition-colors cursor-pointer">
                  <div className="w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1" style={{ backgroundColor: (categoryColors[cat.name] || "#6366f1") + "30" }}>
                    <Grid3X3 className="w-4 h-4" style={{ color: categoryColors[cat.name] || "#6366f1" }} />
                  </div>
                  <p className="text-[10px] text-forest-800">{cat.name}</p>
                </div>
              ))}
              {realCategories.length === 0 && [1, 2, 3, 4, 5, 6].slice(0, s.count || 6).map((i) => (
                <div key={i} className="bg-cream-100 rounded-xl p-3 text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-cream-200 mb-1" />
                  <p className="text-[10px] text-slate-400">Kategoriya {i}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case "categories_grid":
        return (
          <div className="w-full">
            <h3 className="text-sm font-semibold text-forest-800 mb-2">{s.title}</h3>
            <div className="space-y-1">
              {(realCategories.length > 0 ? realCategories : Array.from({ length: 4 }, (_, i) => ({ id: String(i), name: `Kategoriya ${i + 1}`, slug: "", parentId: null, createdAt: "" }))).map((cat) => (
                <div key={cat.id} className="flex items-center justify-between bg-cream-100 rounded-lg px-3 py-2 hover:bg-slate-750 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: (categoryColors[cat.name] || "#6366f1") + "30" }}>
                      <Grid3X3 className="w-3 h-3" style={{ color: categoryColors[cat.name] || "#6366f1" }} />
                    </div>
                    <span className="text-xs text-forest-800">{cat.name}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                </div>
              ))}
            </div>
          </div>
        );

      case "categories_2x2":
        return (
          <div className="w-full">
            <h3 className="text-sm font-semibold text-forest-800 mb-2">{s.title}</h3>
            <div className="grid grid-cols-2 gap-2">
              {(realCategories.length > 0 ? realCategories : Array.from({ length: 4 }, (_, i) => ({ id: String(i), name: `Kategoriya ${i + 1}`, slug: "", parentId: null, createdAt: "" }))).slice(0, s.count || 4).map((cat) => (
                <div key={cat.id} className="bg-cream-100 rounded-xl p-3 flex items-center gap-2 hover:bg-slate-750 transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: (categoryColors[cat.name] || "#6366f1") + "30" }}>
                    <Grid3X3 className="w-4 h-4" style={{ color: categoryColors[cat.name] || "#6366f1" }} />
                  </div>
                  <span className="text-xs text-forest-800">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "stories":
        return (
          <div className="w-full">
            <h3 className="text-sm font-semibold text-forest-800 mb-2">{s.title}</h3>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex-shrink-0 w-16 cursor-pointer">
                  <div className="w-14 h-14 mx-auto rounded-full border-2 border-emerald-500 p-0.5">
                    <div className="w-full h-full bg-cream-200 rounded-full flex items-center justify-center">
                      <Play className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                  <p className="text-[9px] text-center text-slate-500 mt-1">Hikoya {i}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case "announcement":
        return (
          <div className="w-full py-2.5 px-4 rounded-lg text-center" style={{ backgroundColor: s.bgColor || "#f59e0b" }}>
            <p className="text-xs text-forest-800 font-medium">{s.text}</p>
          </div>
        );

      case "search":
        return (
          <div className="w-full bg-cream-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500">{s.placeholder}</span>
          </div>
        );

      default:
        return null;
    }
  };

  const filteredDefs = blockDefinitions.filter((d) =>
    d.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedDefs = {
    products: filteredDefs.filter((d) => d.category === "products"),
    navigation: filteredDefs.filter((d) => d.category === "navigation"),
    media: filteredDefs.filter((d) => d.category === "media"),
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Yuklanmoqda...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Sidebar */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-cream-300 flex flex-col">
        <div className="flex border-b border-cream-300">
          {[
            { key: "blocks" as const, label: t("ui.tab.blocks"), icon: LayoutGrid },
            { key: "templates" as const, label: t("ui.tab.templates"), icon: LayoutTemplate },
            { key: "brand" as const, label: t("ui.tab.brand"), icon: Palette },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActivePanel(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-all ${
                  activePanel === tab.key ? "text-forest-700 border-b-2 border-emerald-400" : "text-slate-500 hover:text-forest-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <AnimatePresence mode="wait">
            {activePanel === "blocks" && (
              <motion.div key="blocks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder={t("ui.searchBlocks")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-cream-100 border border-cream-300 rounded-lg pl-8 pr-3 py-2 text-xs text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
                  />
                </div>

                {Object.entries(groupedDefs).map(([category, defs]) => {
                  const isExpanded = expandedCategories.has(category);
                  const catLabels: Record<string, string> = { products: "Mahsulotlar", navigation: "Navigatsiya", media: "Media" };
                  return (
                    <div key={category} className="mb-2">
                      <button onClick={() => toggleCategory(category)} className="flex items-center gap-1.5 w-full py-2 text-xs font-medium text-slate-500 hover:text-forest-900 transition-colors">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        {catLabels[category]}
                        <span className="ml-auto text-[10px] text-slate-400">{defs.length}</span>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="space-y-1 pl-1">
                              {defs.map((def) => {
                                const Icon = iconMap[def.icon] || Package;
                                return (
                                  <button
                                    key={def.type}
                                    onClick={() => addBlock(def)}
                                    className="w-full flex items-center gap-2 p-2 rounded-lg bg-cream-100/50 hover:bg-cream-100 transition-colors group text-left"
                                  >
                                    <div className="w-8 h-8 bg-cream-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-cream-200 transition-colors">
                                      <Icon className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs text-forest-800 truncate">{def.label}</p>
                                      <p className="text-[10px] text-slate-500 truncate">{def.description}</p>
                                    </div>
                                    <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-forest-700 ml-auto flex-shrink-0" />
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {activePanel === "templates" && (
              <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl.id)}
                    className="w-full text-left bg-cream-100/50 hover:bg-cream-100 rounded-xl p-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: tpl.previewColor + "20" }}>
                        <LayoutTemplate className="w-5 h-5" style={{ color: tpl.previewColor }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-forest-800">{tpl.name}</p>
                        <p className="text-[10px] text-slate-500">{tpl.category} · {tpl.blocks.length} bo'lim</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{tpl.description}</p>
                  </button>
                ))}
              </motion.div>
            )}

            {activePanel === "brand" && (
              <motion.div key="brand" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Do'kon nomi</label>
                  <input value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-xs text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Asosiy</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={brand.primaryColor} onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })} className="w-8 h-8 rounded-lg border-0 p-0 bg-transparent cursor-pointer" />
                      <span className="text-[10px] text-slate-500 font-mono">{brand.primaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Qo'shimcha</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={brand.secondaryColor} onChange={(e) => setBrand({ ...brand, secondaryColor: e.target.value })} className="w-8 h-8 rounded-lg border-0 p-0 bg-transparent cursor-pointer" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Aksent</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={brand.accentColor} onChange={(e) => setBrand({ ...brand, accentColor: e.target.value })} className="w-8 h-8 rounded-lg border-0 p-0 bg-transparent cursor-pointer" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Mahsulot kartasi</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["compact", "standard", "large"] as const).map((style) => (
                      <button key={style} onClick={() => setBrand({ ...brand, productCardStyle: style })} className={`px-2 py-1.5 rounded-lg text-[10px] capitalize transition-all ${brand.productCardStyle === style ? "bg-leaf-400 text-forest-800" : "bg-cream-100 text-slate-500 hover:text-forest-900"}`}>
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Kategoriya uslubi</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["list", "grid", "circle"] as const).map((style) => (
                      <button key={style} onClick={() => setBrand({ ...brand, categoryStyle: style })} className={`px-2 py-1.5 rounded-lg text-[10px] capitalize transition-all ${brand.categoryStyle === style ? "bg-leaf-400 text-forest-800" : "bg-cream-100 text-slate-500 hover:text-forest-900"}`}>
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Telefon</label>
                  <input value={brand.phone} onChange={(e) => setBrand({ ...brand, phone: e.target.value })} className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-xs text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Email</label>
                  <input value={brand.email} onChange={(e) => setBrand({ ...brand, email: e.target.value })} className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-xs text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Manzil</label>
                  <input value={brand.address} onChange={(e) => setBrand({ ...brand, address: e.target.value })} className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-xs text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Center Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-12 border-b border-cream-300 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-forest-800">{t("ui.editor")}</span>
            <span className="text-xs text-slate-500">{t("ui.blockCount", { n: blocks.length, active: blocks.filter((b) => b.enabled).length })}</span>
            {savedMessage && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`text-xs flex items-center gap-1 ${savedMessage === t("ui.saved") ? "text-forest-700" : "text-rose-600"}`}
              >
                <CheckCircle2 className="w-3 h-3" />
                {savedMessage}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Published toggle — yashirin holatni aniq ko'rinarli qiladi */}
            <button
              onClick={() => setPublished(!published)}
              title={published ? "Do'kon mijozlarga ko'rinadi — bossangiz yashiradi" : "⚠️ Do'kon mijozlarga ko'rinmaydi! Bossangiz nashr qiladi"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                published
                  ? "bg-leaf-100 text-forest-700 border border-leaf-300/60"
                  : "bg-amber-100 text-amber-700 border border-amber-400 animate-pulse"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              {published ? t("ui.published") : `⚠️ ${t("ui.hidden")}`}
            </button>
            <div className="flex items-center bg-cream-100 rounded-lg p-0.5">
              <button onClick={() => setPreviewMode("mobile")} className={`p-1.5 rounded-md transition-all ${previewMode === "mobile" ? "bg-cream-200 text-forest-800" : "text-slate-500"}`}>
                <Smartphone className="w-4 h-4" />
              </button>
              <button onClick={() => setPreviewMode("desktop")} className={`p-1.5 rounded-md transition-all ${previewMode === "desktop" ? "bg-cream-200 text-forest-800" : "text-slate-500"}`}>
                <Monitor className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => setShowPreview(!showPreview)} className={`p-1.5 rounded-lg transition-all ${showPreview ? "bg-leaf-100 text-forest-700" : "text-slate-500"}`}>
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-60 text-forest-800 text-xs font-medium rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {t("common.save")}
            </button>
          </div>
        </div>

        {/* Hidden state warning — operator sezmasdan qoldirmasligi uchun */}
        {!published && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Globe className="w-4 h-4 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">Do'kon yashirin holatda</p>
              <p className="text-xs text-amber-700">
                Mijozlar hozir Mini App'ni ochsa "<strong>Do'kon yopiq</strong>" xabari chiqadi.
                Mijozlar uchun ochish uchun yuqoridagi <strong>Yashirin</strong> tugmasini bosing.
              </p>
            </div>
            <button
              onClick={() => setPublished(true)}
              className="flex-shrink-0 px-3 py-1.5 bg-leaf-400 hover:bg-leaf-500 text-forest-800 text-xs font-semibold rounded-lg transition-colors"
            >
              Nashr qilish
            </button>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Block List */}
          <div className="flex-1 overflow-y-auto p-4">
            {blocks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-cream-300 rounded-xl">
                <Plus className="w-8 h-8 text-cream-300 mb-2" />
                <p className="text-sm text-slate-500">Blok qo'shing</p>
                <p className="text-xs text-slate-400 mt-1">Chap paneldan tanlang</p>
              </div>
            ) : (
              <div className="space-y-2 max-w-2xl mx-auto">
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`group relative bg-white border rounded-xl p-3 transition-all cursor-move ${
                      selectedBlockId === block.id ? "border-emerald-500/50 ring-1 ring-emerald-500/20" : "border-cream-300 hover:border-cream-300"
                    } ${!block.enabled ? "opacity-40" : ""} ${dragOverIndex === index && draggedIndex !== index ? "border-leaf-400/50 bg-leaf-400/5" : ""} ${draggedIndex === index ? "opacity-50" : ""}`}
                    onClick={() => setSelectedBlockId(block.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveUp(index); }}
                          disabled={index === 0}
                          className="p-0.5 text-slate-400 hover:text-forest-900 disabled:opacity-20 transition-colors"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <GripVertical className="w-4 h-4 text-slate-400" />
                        <button
                          onClick={(e) => { e.stopPropagation(); moveDown(index); }}
                          disabled={index === blocks.length - 1}
                          className="p-0.5 text-slate-400 hover:text-forest-900 disabled:opacity-20 transition-colors"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="w-8 h-8 bg-cream-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {(() => {
                          const def = blockDefinitions.find((d) => d.type === block.type);
                          const Icon = def ? (iconMap[def.icon] || Package) : Package;
                          return <Icon className="w-4 h-4 text-slate-500" />;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-forest-800">{block.title}</p>
                        <p className="text-[10px] text-slate-500">{blockDefinitions.find((d) => d.type === block.type)?.description}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); toggleBlock(block.id); }} className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100 transition-colors" title={block.enabled ? "O'chirish" : "Yoqish"}>
                          {block.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); duplicateBlock(block); }} className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100 transition-colors" title="Nusxa">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-100 transition-colors" title="O'chirish">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Drop zone at end */}
                <div
                  className={`h-12 border-2 border-dashed rounded-xl flex items-center justify-center text-xs transition-colors ${
                    dragOverIndex === blocks.length ? "border-leaf-400/50 bg-leaf-400/5 text-forest-700" : "border-cream-300 text-slate-400"
                  }`}
                  onDragEnter={() => setDragOverIndex(blocks.length)}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDropAtEnd}
                >
                  Blokni shu yerga torting
                </div>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <AnimatePresence>
            {showPreview && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: previewMode === "mobile" ? 360 : 480, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-l border-cream-300 bg-cream-50 overflow-hidden flex flex-col"
              >
                <div className="h-10 border-b border-cream-300 flex items-center justify-between px-3 flex-shrink-0">
                  <span className="text-xs font-medium text-slate-500">Preview</span>
                  <div className="flex items-center gap-2">
                    {previewProducts.length > 0 && (
                      <span className="text-[10px] text-slate-400">{previewProducts.length} mahsulot</span>
                    )}
                    <span className="text-[10px] text-slate-400">{previewMode === "mobile" ? "375px" : "480px"}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <div className={`mx-auto ${previewMode === "mobile" ? "w-[320px]" : "w-full"}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-cream-300">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-forest-800" style={{ backgroundColor: brand.primaryColor }}>
                          {brand.logo}
                        </div>
                        <span className="text-xs font-semibold text-forest-800">{brand.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-slate-500" />
                        <ShoppingBag className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    </div>

                    {/* Blocks */}
                    <div className="space-y-3">
                      {blocks.filter((b) => b.enabled).map((block) => (
                        <div key={block.id}>{renderPreviewBlock(block, previewMode === "mobile")}</div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="mt-6 pt-4 border-t border-cream-300 text-center">
                      <p className="text-[10px] text-slate-500">{brand.name} © 2025</p>
                      <div className="flex items-center justify-center gap-3 mt-2">
                        {brand.phone && <Phone className="w-3 h-3 text-slate-400" />}
                        {brand.email && <Mail className="w-3 h-3 text-slate-400" />}
                        {brand.address && <MapPin className="w-3 h-3 text-slate-400" />}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Settings Panel */}
      <AnimatePresence>
        {selectedBlock && selectedDef && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-l border-cream-300 bg-white overflow-hidden flex flex-col"
          >
            <div className="h-12 border-b border-cream-300 flex items-center justify-between px-4 flex-shrink-0">
              <span className="text-sm font-semibold text-forest-800">Blok sozlamalari</span>
              <button onClick={() => setSelectedBlockId(null)} className="p-1 rounded-lg text-slate-500 hover:text-forest-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-4">
                <label className="text-xs text-slate-500 mb-1.5 block">Sarlavha</label>
                <input
                  value={selectedBlock.title}
                  onChange={(e) => updateBlockTitle(selectedBlock.id, e.target.value)}
                  className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-xs text-forest-800 focus:outline-none focus:border-leaf-500/60"
                />
              </div>

              {Object.entries(selectedBlock.settings).map(([key, value]) => {
                if (key === "count") {
                  return (
                    <div key={key} className="mb-3">
                      <label className="text-xs text-slate-500 mb-1.5 block">Mahsulotlar soni</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={value}
                        onChange={(e) => updateBlockSetting(selectedBlock.id, key, parseInt(e.target.value) || 1)}
                        className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-xs text-forest-800 focus:outline-none focus:border-leaf-500/60"
                      />
                    </div>
                  );
                }
                if (key === "title" || key === "text" || key === "subtitle" || key === "buttonText" || key === "placeholder") {
                  return (
                    <div key={key} className="mb-3">
                      <label className="text-xs text-slate-500 mb-1.5 block capitalize">
                        {key === "buttonText" ? "Tugma matni" : key === "placeholder" ? "Placeholder" : key}
                      </label>
                      <input
                        value={value}
                        onChange={(e) => updateBlockSetting(selectedBlock.id, key, e.target.value)}
                        className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-xs text-forest-800 focus:outline-none focus:border-leaf-500/60"
                      />
                    </div>
                  );
                }
                if (key === "category") {
                  return (
                    <div key={key} className="mb-3">
                      <label className="text-xs text-slate-500 mb-1.5 block">Kategoriya</label>
                      <select
                        value={value}
                        onChange={(e) => updateBlockSetting(selectedBlock.id, key, e.target.value)}
                        className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-xs text-forest-800 focus:outline-none focus:border-leaf-500/60"
                      >
                        <option value="">Barcha kategoriyalar</option>
                        {realCategories.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                }
                if (key === "bgColor") {
                  return (
                    <div key={key} className="mb-3">
                      <label className="text-xs text-slate-500 mb-1.5 block">Fon rangi</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={value}
                          onChange={(e) => updateBlockSetting(selectedBlock.id, key, e.target.value)}
                          className="w-8 h-8 rounded-lg border-0 p-0 bg-transparent cursor-pointer"
                        />
                        <span className="text-xs text-slate-500 font-mono">{value}</span>
                      </div>
                    </div>
                  );
                }
                if (key === "showBadge" || key === "showTimer" || key === "showStockBar") {
                  const labels: Record<string, string> = {
                    showBadge: "Badge ko'rsatish",
                    showTimer: "Taymer ko'rsatish",
                    showStockBar: "Zaxira shkalasi",
                  };
                  return (
                    <div key={key} className="mb-3 flex items-center justify-between">
                      <label className="text-xs text-slate-500">{labels[key] || key}</label>
                      <button
                        onClick={() => updateBlockSetting(selectedBlock.id, key, !value)}
                        className={`relative w-8 h-4 rounded-full transition-all ${value ? "bg-leaf-400" : "bg-cream-200"}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${value ? "left-4" : "left-0.5"}`} />
                      </button>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
