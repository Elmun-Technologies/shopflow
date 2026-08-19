// CSV / Excel paste orqali ko'p mahsulotni import qilish.
// Parser: src/utils/productImport.ts — SKU ixtiyoriy, noma'lum kategoriya
// avtomatik yaratiladi, backend POST /products/import bir so'rovda yuklaydi.

import { useMemo, useState } from "react";
import { X, Upload, AlertCircle, CheckCircle2, Loader2, FileText, Download } from "lucide-react";
import { productsApi } from "../api/endpoints";
import type { Category } from "../types/api";
import { useT } from "../i18n";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  SAMPLE_PRODUCT_CSV,
  looksLikeSpreadsheetBinary,
  parseProductCsv,
} from "../utils/productImport";

interface Props {
  categories: Category[];
  onClose: () => void;
  onDone: () => void;
}

const CHUNK = 200;

export default function ProductImportModal({ categories, onClose, onDone }: Props) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0, created: 0, updated: 0 });
  const [showDone, setShowDone] = useState(false);
  const panelRef = useFocusTrap<HTMLDivElement>(true, onClose);

  const parsed = useMemo(() => (text.trim() ? parseProductCsv(text, categories) : []), [text, categories]);
  const validRows = parsed.filter((r) => r.errors.length === 0);
  const invalidRows = parsed.filter((r) => r.errors.length > 0);

  const handleFile = async (file: File) => {
    setFileError(null);
    const ext = file.name.toLowerCase();
    if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
      setFileError(t("import.xlsxNotSupported"));
      return;
    }
    const content = await file.text();
    if (looksLikeSpreadsheetBinary(content)) {
      setFileError(t("import.xlsxNotSupported"));
      return;
    }
    setText(content);
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    let failed = 0;
    let created = 0;
    let updated = 0;
    setProgress({ done: 0, total: validRows.length, failed: 0, created: 0, updated: 0 });

    for (let i = 0; i < validRows.length; i += CHUNK) {
      const slice = validRows.slice(i, i + CHUNK);
      try {
        const res = await productsApi.import({
          updateExisting,
          items: slice.map((row) => ({
            sku: row.sku || undefined,
            name: row.name,
            description: row.description || undefined,
            price: row.price,
            oldPrice: row.oldPrice,
            stock: row.stock,
            categoryName: row.categoryName || undefined,
            categoryId: row.categoryId,
            active: true,
            featured: false,
          })),
        });
        created += res.created;
        updated += res.updated;
        failed += res.failed;
      } catch {
        failed += slice.length;
      }
      setProgress({
        done: Math.min(i + slice.length, validRows.length),
        total: validRows.length,
        failed,
        created,
        updated,
      });
    }
    setImporting(false);
    setShowDone(true);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_PRODUCT_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

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
              {t("import.doneSummaryFull", {
                created: progress.created,
                updated: progress.updated,
                failed: progress.failed,
                total: progress.total,
              })}
            </p>
            <button
              onClick={() => {
                onDone();
                onClose();
              }}
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
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("import.title")}
        className="bg-white border border-cream-300 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
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
              <div className="bg-cream-100/40 border border-cream-300 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-forest-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-forest-700" />
                  {t("import.format")}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">{t("import.formatHint")}</p>
                <code className="block text-[11px] text-slate-700 bg-white rounded px-2 py-1.5 mt-2 font-mono">
                  sku, name, description, price, oldPrice, stock, category
                </code>
                <p className="text-[11px] text-slate-500">{t("import.rulesHint")}</p>
                <button
                  onClick={downloadSample}
                  className="text-xs font-medium text-forest-700 hover:text-forest-800 flex items-center gap-1 mt-2"
                >
                  <Download className="w-3 h-3" />
                  {t("import.downloadSample")}
                </button>
              </div>

              <div>
                <label className="block">
                  <span className="text-xs text-slate-500 mb-1.5 block">{t("import.fromFile")}</span>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-cream-100 border border-cream-300 border-dashed rounded-lg cursor-pointer hover:border-leaf-500/50 transition-colors">
                    <Upload className="w-4 h-4 text-slate-500" />
                    <input
                      type="file"
                      accept=".csv,.txt,.tsv,text/csv,text/plain"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFile(f);
                      }}
                      className="flex-1 text-sm text-forest-800 file:hidden bg-transparent focus:outline-none"
                    />
                  </div>
                </label>
                {fileError && <p className="text-[11px] text-rose-600 mt-1.5">{fileError}</p>}
              </div>

              <div>
                <label className="block">
                  <span className="text-xs text-slate-500 mb-1.5 block">{t("import.orPaste")}</span>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={8}
                    placeholder={SAMPLE_PRODUCT_CSV}
                    className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-xs text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 font-mono resize-none"
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label={t("import.stat.total")} value={parsed.length} color="text-forest-800" />
                <Stat label={t("import.stat.valid")} value={validRows.length} color="text-forest-700" />
                <Stat label={t("import.stat.invalid")} value={invalidRows.length} color="text-red-600" />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="w-4 h-4 rounded border-cream-300 text-leaf-500"
                />
                {t("import.updateExisting")}
              </label>

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
                        <tr key={row.rowNum} className={`border-t border-cream-300/50 ${row.errors.length > 0 ? "bg-red-500/5" : ""}`}>
                          <td className="py-1.5 px-2 text-slate-500">{row.rowNum}</td>
                          <td className="py-1.5 px-2 text-forest-800 font-mono">
                            {row.sku || <span className="text-slate-400 italic">{t("import.skuAuto")}</span>}
                          </td>
                          <td className="py-1.5 px-2 text-forest-800 truncate max-w-[180px]">{row.name || "—"}</td>
                          <td className="py-1.5 px-2 text-right text-slate-700">{row.price ? row.price.toLocaleString() : "—"}</td>
                          <td className="py-1.5 px-2 text-right text-slate-700">{row.stock}</td>
                          <td className="py-1.5 px-2 text-slate-500">
                            {row.categoryName || "—"}
                            {row.notes.includes("category-create") && (
                              <span className="ml-1 text-[10px] text-amber-600">{t("import.categoryWillCreate")}</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            {row.errors.length === 0 ? (
                              <span className="text-forest-700 text-[10px] font-medium">OK</span>
                            ) : (
                              <span className="text-red-600 text-[10px] font-medium" title={row.errors.join(", ")}>
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

              {importing && (
                <div className="bg-cream-100/40 border border-cream-300 rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t("import.progressLabel")}
                    </span>
                    <span>
                      {progress.done} / {progress.total}
                    </span>
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
