import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Globe, Eye, EyeOff, Save, ExternalLink, AlertCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { LoadingSkeleton } from "./common/LoadingSkeleton";
import { ErrorRetry } from "./common/ErrorRetry";
import type { StorefrontSite, StorefrontTheme } from "@shopflow/shared-types";

const STOREFRONT_BASE_DOMAIN = (import.meta.env.VITE_STOREFRONT_DOMAIN as string | undefined) ?? "shopflow.uz";

export function StorefrontAdminPage() {
  const qc = useQueryClient();
  const site = useQuery({
    queryKey: ["storefront", "site"],
    queryFn: () => api.get<StorefrontSite>("/storefront-admin/site").then((r) => r.data),
  });

  const save = useMutation({
    mutationFn: (dto: Partial<StorefrontSite>) =>
      api.put<StorefrontSite>("/storefront-admin/site", dto).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["storefront", "site"], data);
    },
  });

  const [draft, setDraft] = useState<Partial<StorefrontSite> | null>(null);
  useEffect(() => {
    if (site.data && !draft) setDraft(site.data);
  }, [site.data, draft]);

  if (site.isLoading || !draft) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Onlayn do'kon</h1>
        <LoadingSkeleton rows={5} />
      </div>
    );
  }
  if (site.isError) {
    return <ErrorRetry error={site.error} onRetry={() => site.refetch()} />;
  }

  const onChange = <K extends keyof StorefrontSite>(key: K, value: StorefrontSite[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const theme = (draft.theme ?? {}) as StorefrontTheme;
  const onThemeChange = (k: keyof StorefrontTheme, v: string) => {
    setDraft((d) => ({ ...d, theme: { ...(d?.theme as StorefrontTheme), [k]: v } }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await save.mutateAsync({
      subdomain: draft.subdomain,
      customDomain: draft.customDomain ?? null,
      title: draft.title,
      description: draft.description ?? null,
      theme: draft.theme,
      published: draft.published,
      catalogOnly: draft.catalogOnly,
    });
  };

  const previewUrl = draft.customDomain
    ? `https://${draft.customDomain}`
    : `https://${draft.subdomain}.${STOREFRONT_BASE_DOMAIN}`;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Onlayn do'kon</h1>
          <p className="text-sm text-slate-400 mt-1">
            Veb-sayt va katalog manzili, sarlavhasi, mavzu rangi va publikatsiya holati.
          </p>
        </div>
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-sm text-white"
        >
          <ExternalLink className="h-4 w-4" />
          Ko'rib chiqish
        </a>
      </header>

      <form onSubmit={submit} className="space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
        >
          <SectionTitle icon={<Globe className="h-5 w-5" />}>Asosiy</SectionTitle>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Subdomen">
              <div className="flex items-center gap-1">
                <input
                  required
                  pattern="[a-z0-9]([a-z0-9-]{0,28}[a-z0-9])?"
                  minLength={2}
                  maxLength={30}
                  value={draft.subdomain ?? ""}
                  onChange={(e) => onChange("subdomain", e.target.value.toLowerCase())}
                  className="input flex-1"
                  placeholder="mendokon"
                />
                <span className="text-slate-500 text-sm">.{STOREFRONT_BASE_DOMAIN}</span>
              </div>
            </Field>

            <Field
              label="Maxsus domen"
              hint="Agar o'z domeningiz bo'lsa (DNS sozlamasi qo'shimcha qo'llanma bo'yicha)"
            >
              <input
                value={draft.customDomain ?? ""}
                onChange={(e) => onChange("customDomain", e.target.value || null)}
                className="input"
                placeholder="dokonim.uz"
              />
            </Field>

            <Field label="Sayt sarlavhasi (title)">
              <input
                required
                minLength={2}
                maxLength={120}
                value={draft.title ?? ""}
                onChange={(e) => onChange("title", e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Tavsif (meta description)">
              <input
                maxLength={500}
                value={draft.description ?? ""}
                onChange={(e) => onChange("description", e.target.value)}
                className="input"
                placeholder="Bizning do'kon haqida qisqacha…"
              />
            </Field>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
        >
          <SectionTitle>Mavzu (Theme)</SectionTitle>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorField
              label="Asosiy rang"
              value={theme.primaryColor ?? "#10b981"}
              onChange={(v) => onThemeChange("primaryColor", v)}
            />
            <ColorField
              label="Aksent rangi"
              value={theme.accentColor ?? "#3b82f6"}
              onChange={(v) => onThemeChange("accentColor", v)}
            />
            <Field label="Logo URL (ixtiyoriy)">
              <input
                value={theme.logoUrl ?? ""}
                onChange={(e) => onThemeChange("logoUrl", e.target.value)}
                className="input"
                placeholder="https://…/logo.png"
              />
            </Field>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
        >
          <SectionTitle>Holat va rejim</SectionTitle>

          <div className="space-y-3">
            <Toggle
              label="Saytni e'lon qilish"
              description="O'chirilgan bo'lsa, sayt umumiy foydalanishda emas"
              checked={!!draft.published}
              onChange={(v) => onChange("published", v)}
              icon={draft.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            />
            <Toggle
              label="Faqat katalog rejimi"
              description="Mahsulotlar ko'rinadi, lekin savat va checkout yashiriladi"
              checked={!!draft.catalogOnly}
              onChange={(v) => onChange("catalogOnly", v)}
            />
          </div>
        </motion.section>

        {save.isError && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {extractMessage(save.error)}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 sticky bottom-0 py-2">
          <button
            type="button"
            onClick={() => setDraft(site.data ?? null)}
            disabled={save.isPending}
            className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm text-slate-200"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 px-4 py-2 text-sm font-medium text-white"
          >
            <Save className="h-4 w-4" />
            {save.isPending ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </form>

      <style>{`
        .input {
          width: 100%;
          background: rgb(15 23 42);
          border: 1px solid rgb(51 65 85);
          color: white;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: rgb(16 185 129);
          box-shadow: 0 0 0 3px rgb(16 185 129 / 0.15);
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-white mb-4">
      {icon && <span className="text-slate-400">{icon}</span>}
      <h2 className="text-lg font-semibold">{children}</h2>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-slate-300 mb-1.5">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border border-slate-700 bg-slate-900 cursor-pointer"
          aria-label={label}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input font-mono text-xs"
        />
      </div>
    </Field>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  icon,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex items-start gap-3">
        {icon && <span className="text-slate-400 mt-0.5">{icon}</span>}
        <div>
          <div className="text-sm font-medium text-white">{label}</div>
          {description && <div className="text-xs text-slate-400 mt-0.5">{description}</div>}
        </div>
      </div>
      <span className="relative inline-block w-10 h-5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-slate-700 peer-checked:bg-emerald-600 transition-colors" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function extractMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const anyErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
    const msg = anyErr.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(", ");
    if (typeof msg === "string") return msg;
    return anyErr.message ?? "Server bilan bog'lanishda xatolik";
  }
  return String(err);
}
