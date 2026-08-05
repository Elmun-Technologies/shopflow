// B2B so'rov modali — ulgurji rejimda "savatga qo'shish" o'rniga shu ochiladi.
//
// Natijasi buyurtma emas, LID: `POST /api/storefront/:slug/inquiry` Lead yaratadi
// va u Lidlar quvuriga tushadi — bot `b2b` shabloni bilan bir xil mantiq
// ("savat yo'q — har bir yo'l lidga olib boradi", narxni menejer tasdiqlaydi).
//
// Storefront dark temasida (Mini App), admin light temasi bu yerga tegmaydi.

import { useState } from "react";
import { Loader2, Send, X, CheckCircle2 } from "lucide-react";
import { useT } from "../../i18n";
import { haptic } from "./storefront-theme";
import type { B2bInquiryKind } from "../../data/uiBuilderData";

/** Telegram WebApp imzolangan initData — backend so'rovni tasdiqlashi uchun. */
function tgInitData(): string {
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
      ?.initData ?? ""
  );
}

export interface B2bInquiryTarget {
  kind: B2bInquiryKind;
  productId?: string;
  productName?: string;
}

export function B2bInquiryModal({
  slug,
  target,
  requireCompany,
  primaryColor,
  apiBase = "/api",
  prefill,
  onClose,
}: {
  slug: string;
  target: B2bInquiryTarget;
  requireCompany: boolean;
  primaryColor: string;
  apiBase?: string;
  prefill?: { name?: string; phone?: string };
  onClose: () => void;
}) {
  const { t } = useT();
  const [form, setForm] = useState({
    name: prefill?.name ?? "",
    phone: prefill?.phone ?? "",
    company: "",
    position: "",
    email: "",
    quantity: "",
    comment: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneCode, setDoneCode] = useState<string | null>(null);

  const titleKey =
    target.kind === "price"
      ? "b2b.form.title.price"
      : target.kind === "sample"
        ? "b2b.form.title.sample"
        : "b2b.form.title.consult";

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  async function submit() {
    if (!form.name.trim() || !form.phone.trim()) {
      setError(t("b2b.form.required"));
      return;
    }
    if (requireCompany && !form.company.trim()) {
      setError(t("b2b.form.companyRequired"));
      return;
    }
    setError("");
    setBusy(true);
    try {
      const tgUserId = (
        window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } }
      ).Telegram?.WebApp?.initDataUnsafe?.user?.id;

      const res = await fetch(`${apiBase}/storefront/${encodeURIComponent(slug)}/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: target.kind,
          name: form.name.trim(),
          phone: form.phone.trim(),
          company: form.company.trim() || undefined,
          position: form.position.trim() || undefined,
          email: form.email.trim() || undefined,
          quantity: form.quantity.trim() || undefined,
          comment: form.comment.trim() || undefined,
          productId: target.productId,
          ...(tgUserId ? { tgUserId } : {}),
          initData: tgInitData(),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { code?: string };
      haptic.medium();
      setDoneCode(data.code ?? "—");
    } catch {
      setError(t("b2b.form.error"));
    } finally {
      setBusy(false);
    }
  }

  const field = (
    label: string,
    key: keyof typeof form,
    opts: { placeholder?: string; type?: string; rows?: number } = {},
  ) => (
    <div>
      <label className="text-[11px] text-slate-400 mb-1 block">{label}</label>
      {opts.rows ? (
        <textarea
          value={form[key]}
          onChange={(e) => set({ [key]: e.target.value } as Partial<typeof form>)}
          rows={opts.rows}
          placeholder={opts.placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/25 resize-none"
        />
      ) : (
        <input
          value={form[key]}
          onChange={(e) => set({ [key]: e.target.value } as Partial<typeof form>)}
          type={opts.type ?? "text"}
          placeholder={opts.placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/25"
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-[#15151f] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto">
        {doneCode ? (
          <div className="p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-base font-semibold text-white mb-2">{t("b2b.success.title")}</h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              {t("b2b.success.text", { code: doneCode })}
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl font-semibold text-white text-sm active:scale-[0.98] transition-transform"
              style={{ backgroundColor: primaryColor }}
            >
              {t("b2b.success.close")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 bg-[#15151f]">
              <h2 className="text-base font-semibold text-white">{t(titleKey)}</h2>
              <button
                onClick={onClose}
                aria-label={t("b2b.success.close")}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {target.productName && (
                <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                  <p className="text-[11px] text-slate-400">{t("b2b.form.title.price")}</p>
                  <p className="text-sm text-white leading-snug">{target.productName}</p>
                </div>
              )}

              {field(t("b2b.form.name"), "name")}
              {field(t("b2b.form.phone"), "phone", { type: "tel", placeholder: "+998 90 123 45 67" })}
              {field(t("b2b.form.company"), "company")}
              {field(t("b2b.form.position"), "position")}
              {field(t("b2b.form.email"), "email", { type: "email" })}
              {field(t("b2b.form.quantity"), "quantity", { placeholder: t("b2b.form.quantity.ph") })}
              {field(t("b2b.form.comment"), "comment", { rows: 3 })}

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                onClick={submit}
                disabled={busy}
                className="w-full py-3.5 rounded-2xl font-semibold text-white text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
                style={{ backgroundColor: primaryColor }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {busy ? t("b2b.form.sending") : t("b2b.form.submit")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
