import { useState, useMemo } from "react";
import { X, Printer, Filter, PackageCheck } from "lucide-react";
import { openPriceListPrint, PriceListItem } from "../utils/printPriceList";
import type { Product } from "../types/api";
import { useT } from "../i18n";

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
  const { t, lang } = useT();
  const locale = lang === "ru" ? "ru-RU" : "uz-UZ";
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
    let filterLabel = t("priceList.filter.all");
    if (filterStockOnly && filterRecentOnly) filterLabel = t("priceList.filter.stockRecent");
    else if (filterStockOnly) filterLabel = t("priceList.filter.stock");
    else if (filterRecentOnly) filterLabel = t("priceList.filter.recent");

    openPriceListPrint({
      storeName,
      generatedAt: new Date(),
      currency,
      items,
      filterLabel,
      lang,
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
              <h3 className="text-lg font-bold text-forest-900">{t("priceList.title")}</h3>
              <p className="text-xs text-slate-500">
                {t("priceList.subtitle")}
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
              placeholder={t("priceList.search")}
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
              {t("priceList.stockOnly")}
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
              {t("priceList.recentOnly")}
            </button>
          </div>
        </div>

        {/* Table Preview */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-cream-300 bg-cream-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-2">№</th>
                <th className="py-2.5 px-2">{t("priceList.col.product")}</th>
                <th className="py-2.5 px-2">{t("priceList.col.sku")}</th>
                <th className="py-2.5 px-2 text-center">{t("priceList.col.stock")}</th>
                <th className="py-2.5 px-2 text-right">{t("priceList.col.cost")}</th>
                <th className="py-2.5 px-2 text-right">{t("priceList.col.oldPrice")}</th>
                <th className="py-2.5 px-2 text-right">{t("priceList.col.currentPrice")}</th>
                <th className="py-2.5 px-2 text-center bg-slate-100">{t("priceList.col.newPrice")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {t("catalog.productsNotFound")}
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
                      {item.costPrice ? item.costPrice.toLocaleString(locale) : "—"}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-400 line-through">
                      {item.oldPrice ? item.oldPrice.toLocaleString(locale) : "—"}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-forest-700">
                      {item.price.toLocaleString(locale)} {currency}
                    </td>
                    <td className="py-2 px-2 text-center bg-slate-50 border-l border-r border-dashed border-slate-300">
                      <span className="text-[10px] text-slate-400 italic">{t("priceList.emptyColumn")}</span>
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
            {t("priceList.total", { count: items.length })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-cream-200 transition-colors"
            >
              {t("common.close")}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-forest-800 text-white text-xs font-semibold hover:bg-forest-900 shadow-md transition-colors"
            >
              <Printer className="w-4 h-4" />
              {t("priceList.print")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
