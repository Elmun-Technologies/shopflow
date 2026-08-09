import { useState, useMemo } from "react";
import { X, Printer, Filter, PackageCheck } from "lucide-react";
import { openPriceListPrint, PriceListItem } from "../utils/printPriceList";
import type { Product } from "../types/api";

export interface PriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  currency: string;
  storeName?: string;
}

export default function PriceListModal({
  isOpen,
  onClose,
  products,
  currency,
  storeName = "ShopFlow Market",
}: PriceListModalProps) {
  const [filterStockOnly, setFilterStockOnly] = useState(false);
  const [filterRecentOnly, setFilterRecentOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const items: PriceListItem[] = useMemo(() => {
    let list = [...products];

    if (filterStockOnly) {
      list = list.filter((p) => (p.stock ?? 0) > 0);
    }

    if (filterRecentOnly) {
      // Oxirgi qabul qilingan mahsulotlar bo'yicha (createdAt / updatedAt saralash)
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q),
      );
    }

    return list.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku || "—",
      stock: p.stock ?? 0,
      costPrice: Math.round((typeof p.price === "number" ? p.price : Number(p.price) || 0) * 0.7),
      oldPrice: typeof p.oldPrice === "string" ? Number(p.oldPrice) : (p.oldPrice || null),
      price: typeof p.price === "number" ? p.price : Number(p.price) || 0,
      receiptDate: p.createdAt,
    }));
  }, [products, filterStockOnly, filterRecentOnly, searchQuery]);

  if (!isOpen) return null;

  const handlePrint = () => {
    let filterLabel = "Barcha mahsulotlar";
    if (filterStockOnly && filterRecentOnly) filterLabel = "Qoldiqda bor va oxirgi kelganlar";
    else if (filterStockOnly) filterLabel = "Faqat qoldiqda borlar";
    else if (filterRecentOnly) filterLabel = "Oxirgi qabul qilinganlar bo'yicha";

    openPriceListPrint({
      storeName,
      generatedAt: new Date(),
      currency,
      items,
      filterLabel,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-cream-300 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cream-200 flex items-center justify-between bg-cream-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-leaf-100 text-forest-700 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-forest-900">Прайс-лист генератори va печать</h3>
              <p className="text-xs text-slate-500">
                A4 formatida yangi narxlar to'ldirish ustuni va qoldiqlar analitikasi bilan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-cream-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 bg-white border-b border-cream-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <input
              type="text"
              placeholder="Qidiruv (Nomi, Artikul)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-cream-300 text-sm focus:outline-none focus:border-leaf-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterStockOnly((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterStockOnly
                  ? "bg-leaf-100 border-leaf-300 text-forest-800"
                  : "bg-white border-cream-300 text-slate-600 hover:bg-cream-50"
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              Faqat bor mahsulotlar (Qoldiq &gt; 0)
            </button>
            <button
              type="button"
              onClick={() => setFilterRecentOnly((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterRecentOnly
                  ? "bg-leaf-100 border-leaf-300 text-forest-800"
                  : "bg-white border-cream-300 text-slate-600 hover:bg-cream-50"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Oxirgi qabul qilinganlar (Приемка)
            </button>
          </div>
        </div>

        {/* Table Preview */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-cream-300 bg-cream-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-2">№</th>
                <th className="py-2.5 px-2">Наименование товара</th>
                <th className="py-2.5 px-2">Артикул</th>
                <th className="py-2.5 px-2 text-center">Остаток</th>
                <th className="py-2.5 px-2 text-right">Себ-сть</th>
                <th className="py-2.5 px-2 text-right">Старая цена</th>
                <th className="py-2.5 px-2 text-right">Текущая цена</th>
                <th className="py-2.5 px-2 text-center bg-slate-100">Новая цена (печать)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Mahsulotlar topilmadi
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-cream-50/50">
                    <td className="py-2 px-2 text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-2 font-medium text-slate-800">{item.name}</td>
                    <td className="py-2 px-2 font-mono text-slate-600">{item.sku}</td>
                    <td
                      className={`py-2 px-2 text-center font-semibold ${
                        item.stock > 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {item.stock}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-600">
                      {item.costPrice ? item.costPrice.toLocaleString("uz-UZ") : "—"}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-400 line-through">
                      {item.oldPrice ? item.oldPrice.toLocaleString("uz-UZ") : "—"}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-forest-700">
                      {item.price.toLocaleString("uz-UZ")} {currency}
                    </td>
                    <td className="py-2 px-2 text-center bg-slate-50 border-l border-r border-dashed border-slate-300">
                      <span className="text-[10px] text-slate-400 italic">[ Bo'sh ustun ]</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-cream-200 bg-cream-50/50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Jami: {items.length} ta mahsulot saralandi
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-cream-200 transition-colors"
            >
              Yopish
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-forest-800 text-white text-xs font-semibold hover:bg-forest-900 shadow-md transition-colors"
            >
              <Printer className="w-4 h-4" />
              Chop etish (Печать)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
