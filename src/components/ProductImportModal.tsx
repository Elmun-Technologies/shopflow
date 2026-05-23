// CSV / Excel paste orqali ko'p mahsulotni import qilish.
// Operator Excel'dan tab-separated ma'lumotni nusxalaydi va paste qiladi —
// jadval avtomatik tahlil qilinadi, xatoliklar ko'rsatiladi, OK bo'lganlar
// sequential create chaqiriqlari bilan yuklanadi.

import { useMemo, useState } from "react";
import { X, Upload, AlertCircle, CheckCircle2, Loader2, FileText, Download } from "lucide-react";
import { productsApi } from "../api/endpoints";
import type { Category, Product } from "../types/api";
import { useT } from "../i18n";

interface Props {
  categories: Category[];
  onClose: () => void;
  onDone: () => void;
}

interface ParsedRow {
  rowNum: number;
  sku: string;
  name: string;
  description: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  categoryName: string;
  categoryId: string | null;
  errors: string[];
}

// Excel'dan paste qilinganda ko'pincha tab-separated bo'ladi.
// CSV ham qo'llab-quvvatlanadi (vergul yoki nuqta-vergul).
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  if (firstLine.includes("\t")) return "\t";
  if (firstLine.includes(";")) return ";";
  return ",";
}

// Oddiy CSV parser — tirnoq ichidagi vergullarni hisobga oladi.
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// Raqamni parslash — "14,500,000" yoki "14 500 000" yoki "14500000" → 14500000
function parseNumber(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[\s,]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text: string, categories: Category[]): ParsedRow[] {
  const delim = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Birinchi qator — header. Sarlavhalarni normalize qilamiz.
  const header = splitCsvLine(lines[0], delim).map((h) => h.toLowerCase().trim());
  const idx = {
    sku: header.indexOf("sku"),
    name: header.findIndex((h) => h === "name" || h === "nomi"),
    description: header.findIndex((h) => h === "description" || h === "tavsif"),
    price: header.findIndex((h) => h === "price" || h === "narx"),
    oldPrice: header.findIndex((h) => h === "oldprice" || h === "old_price" || h === "eskinarx"),
    stock: header.findIndex((h) => h === "stock" || h === "ombor" || h === "qoldiq"),
    category: header.findIndex((h) => h === "category" || h === "kategoriya"),
  };

  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  return lines.slice(1).map((line, i) => {
    const cells = splitCsvLine(line, delim);
    const sku = idx.sku >= 0 ? cells[idx.sku] ?? "" : "";
    const name = idx.name >= 0 ? cells[idx.name] ?? "" : "";
    const description = idx.description >= 0 ? cells[idx.description] ?? "" : "";
    const priceRaw = idx.price >= 0 ? cells[idx.price] ?? "" : "";
    const oldPriceRaw = idx.oldPrice >= 0 ? cells[idx.oldPrice] ?? "" : "";
    const stockRaw = idx.stock >= 0 ? cells[idx.stock] ?? "" : "";
    const categoryName = idx.category >= 0 ? cells[idx.category] ?? "" : "";

    const errors: string[] = [];
    if (!sku) errors.push("sku");
    if (!name) errors.push("name");
    const price = parseNumber(priceRaw);
    if (price == null || price < 0) errors.push("price");
    const oldPrice = oldPriceRaw ? parseNumber(oldPriceRaw) : null;
    if (oldPriceRaw && oldPrice == null) errors.push("oldPrice");
    const stock = stockRaw ? parseNumber(stockRaw) ?? 0 : 0;

    let categoryId: string | null = null;
    if (categoryName) {
      categoryId = catByName.get(categoryName.toLowerCase()) ?? null;
      if (!categoryId) errors.push("category");
    }

    return {
      rowNum: i + 2, // header 1, ma'lumotlar 2-dan
      sku,
      name,
      description,
      price: price ?? 0,
      oldPrice,
      stock,
      categoryName,
      categoryId,
      errors,
    };
  });
}

const SAMPLE_CSV = `sku,name,description,price,oldPrice,stock,category
IPH-15,iPhone 15 Pro Max,Original Apple smartfon,14500000,,5,Telefonlar
SAM-S24,Samsung Galaxy S24,256GB qora rang,12000000,13000000,8,Telefonlar
HP-PRO,HP ProBook 450,15.6 Core i7,18500000,,3,Noutbuklar`;

export default function ProductImportModal({ categories, onClose, onDone }: Props) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [showDone, setShowDone] = useState(false);

  const parsed = useMemo(() => (text.trim() ? parseCsv(text, categories) : []), [text, categories]);
  const validRows = parsed.filter((r) => r.errors.length === 0);
  const invalidRows = parsed.filter((r) => r.errors.length > 0);

  const handleFile = async (file: File) => {
    const content = await file.text();
    setText(content);
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setProgress({ done: 0, total: validRows.length, failed: 0 });
    let failed = 0;
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await productsApi.create({
          sku: row.sku,
          name: row.name,
          description: row.description || null,
          price: row.price as unknown as Product["price"],
          oldPrice: (row.oldPrice ?? null) as unknown as Product["oldPrice"],
          stock: row.stock,
          categoryId: row.categoryId,
          active: true,
          featured: false,
        });
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: validRows.length, failed });
    }
    setImporting(false);
    setShowDone(true);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Yakuniy ekran
  if (showDone) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white border border-cream-300 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-leaf-200 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-10 h-10 text-forest-700" />
            </div>
            <h3 className="text-lg font-bold text-forest-800 mb-1">{t("import.doneTitle")}</h3>
            <p className="text-sm text-slate-500 mb-4">
              {t("import.doneSummary", {
                ok: progress.done - progress.failed,
                total: progress.total,
                failed: progress.failed,
              })}
            </p>
            <button
              onClick={() => { onDone(); onClose(); }}
              className="w-full py-2.5 bg-leaf-400 hover:bg-leaf-500 rounded-lg text-sm font-semibold text-forest-800"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-cream-300 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cream-300 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-forest-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-forest-700" />
              {t("import.title")}
            </h2>
            <p className="text-xs text-slate-500 mt-1">{t("import.subtitle")}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!parsed.length ? (
            <>
              {/* Yo'riqnoma */}
              <div className="bg-cream-100/40 border border-cream-300 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-forest-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-forest-700" />
                  {t("import.format")}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">{t("import.formatHint")}</p>
                <code className="block text-[11px] text-slate-700 bg-white rounded px-2 py-1.5 mt-2 font-mono">
                  sku, name, description, price, oldPrice, stock, category
                </code>
                <button
                  onClick={downloadSample}
                  className="text-xs font-medium text-forest-700 hover:text-forest-700 flex items-center gap-1 mt-2"
                >
                  <Download className="w-3 h-3" />
                  {t("import.downloadSample")}
                </button>
              </div>

              {/* File upload */}
              <div>
                <label className="block">
                  <span className="text-xs text-slate-500 mb-1.5 block">{t("import.fromFile")}</span>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-cream-100 border border-cream-300 border-dashed rounded-lg cursor-pointer hover:border-emerald-500/50 transition-colors">
                    <Upload className="w-4 h-4 text-slate-500" />
                    <input
                      type="file"
                      accept=".csv,.txt,.tsv"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
                      className="flex-1 text-sm text-forest-800 file:hidden bg-transparent focus:outline-none"
                    />
                  </div>
                </label>
              </div>

              {/* Paste area */}
              <div>
                <label className="block">
                  <span className="text-xs text-slate-500 mb-1.5 block">{t("import.orPaste")}</span>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={8}
                    placeholder={SAMPLE_CSV}
                    className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-xs text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 font-mono resize-none"
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              {/* Tahlil natijasi */}
              <div className="grid grid-cols-3 gap-3">
                <Stat label={t("import.stat.total")} value={parsed.length} color="text-forest-800" />
                <Stat label={t("import.stat.valid")} value={validRows.length} color="text-forest-700" />
                <Stat label={t("import.stat.invalid")} value={invalidRows.length} color="text-rose-600" />
              </div>

              {/* Preview table */}
              <div className="border border-cream-300 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead className="bg-cream-100/50 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-2 text-slate-500 font-medium">#</th>
                        <th className="text-left py-2 px-2 text-slate-500 font-medium">SKU</th>
                        <th className="text-left py-2 px-2 text-slate-500 font-medium">{t("import.col.name")}</th>
                        <th className="text-right py-2 px-2 text-slate-500 font-medium">{t("import.col.price")}</th>
                        <th className="text-right py-2 px-2 text-slate-500 font-medium">{t("import.col.stock")}</th>
                        <th className="text-left py-2 px-2 text-slate-500 font-medium">{t("import.col.category")}</th>
                        <th className="text-left py-2 px-2 text-slate-500 font-medium">{t("import.col.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((row) => (
                        <tr key={row.rowNum} className={`border-t border-cream-300/50 ${row.errors.length > 0 ? "bg-rose-500/5" : ""}`}>
                          <td className="py-1.5 px-2 text-slate-500">{row.rowNum}</td>
                          <td className="py-1.5 px-2 text-forest-800 font-mono">{row.sku || "—"}</td>
                          <td className="py-1.5 px-2 text-forest-800 truncate max-w-[180px]">{row.name || "—"}</td>
                          <td className="py-1.5 px-2 text-right text-slate-700">{row.price ? row.price.toLocaleString() : "—"}</td>
                          <td className="py-1.5 px-2 text-right text-slate-700">{row.stock}</td>
                          <td className="py-1.5 px-2 text-slate-500">{row.categoryName || "—"}</td>
                          <td className="py-1.5 px-2">
                            {row.errors.length === 0 ? (
                              <span className="text-forest-700 text-[10px] font-medium">OK</span>
                            ) : (
                              <span className="text-rose-600 text-[10px] font-medium" title={row.errors.join(", ")}>
                                ✗ {row.errors.join(", ")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Progress */}
              {importing && (
                <div className="bg-cream-100/40 border border-cream-300 rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs text-slate-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t("import.progressLabel")}
                    </span>
                    <span>{progress.done} / {progress.total}</span>
                  </div>
                  <div className="h-1.5 bg-cream-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-leaf-400 transition-all"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 justify-between p-4 border-t border-cream-300 flex-shrink-0">
          {parsed.length > 0 && (
            <button
              onClick={() => setText("")}
              disabled={importing}
              className="px-3 py-2 text-sm text-slate-500 hover:text-forest-900 disabled:opacity-50"
            >
              ← {t("import.startOver")}
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose} disabled={importing} className="px-4 py-2 text-sm text-slate-500 hover:text-forest-900 disabled:opacity-50">
              {t("common.cancel")}
            </button>
            {parsed.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-sm font-semibold text-forest-800"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {t("import.submit", { n: validRows.length })}
              </button>
            )}
          </div>
        </div>

        {invalidRows.length > 0 && !importing && (
          <div className="px-5 pb-3 -mt-2 flex items-center gap-1.5 text-[11px] text-amber-600">
            <AlertCircle className="w-3 h-3" />
            {t("import.invalidWarning", { n: invalidRows.length })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-cream-100/40 border border-cream-300 rounded-lg p-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
