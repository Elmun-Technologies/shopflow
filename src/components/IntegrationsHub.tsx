// Markazlashgan integratsiyalar paneli — Sozlamalar > Integratsiyalar tab'ida.
// Toifa bo'yicha guruhlangan barcha integratsiyalar (to'lov, kanal, yetkazib
// berish, analytics, ERP, marketing, boshqa). Har biri "Ulash" yoki "Sozlash"
// tugmasi bilan — bosilganda setup modal ochiladi.

import { useMemo, useState } from "react";
import { api } from "../api/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Plus, Settings as SettingsIcon, X, Search, Sparkles,
  CreditCard, MessageSquare, Truck, BarChart3, Boxes, Megaphone, Wrench, Briefcase,
} from "lucide-react";
import { integrations, integrationCategories, type IntegrationItem, type IntegrationCategory } from "../data/integrationsData";
import { MoyskladIntegrationCard } from "./MoyskladIntegrationCard";
import { SalesDoctorIntegrationCard } from "./SalesDoctorIntegrationCard";
import { OneCIntegrationCard } from "./OneCIntegrationCard";
import { WebhookIntegrationCard } from "./WebhookIntegrationCard";
import { useAppToast } from "./ui/Toast";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useT } from "../i18n";

const CATEGORY_ICONS: Record<IntegrationCategory, React.ElementType> = {
  payments: CreditCard,
  channels: MessageSquare,
  delivery: Truck,
  analytics: BarChart3,
  erp: Boxes,
  crm: Briefcase,
  marketing: Megaphone,
  other: Wrench,
};

export function IntegrationsHub() {
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory | "all">("all");
  const [selected, setSelected] = useState<IntegrationItem | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return integrations.filter((i) => {
      // MoySklad, Sales Doctor va 1C uchun maxsus hero kartochkalar bor — duplicate render qilmaslik
      if (i.id === "moysklad" || i.id === "salesdoctor" || i.id === "1c") return false;
      if (activeCategory !== "all" && i.category !== activeCategory) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
    });
  }, [search, activeCategory]);

  const stats = useMemo(() => {
    const connected = integrations.filter((i) => i.status === "connected").length;
    const available = integrations.filter((i) => i.status === "available").length;
    return { connected, available, total: integrations.length };
  }, []);

  const recommended = useMemo(
    () => integrations.filter((i) => i.recommended && i.status !== "connected").slice(0, 4),
    [],
  );

  return (
    <div className="space-y-6">
      {/* Hero — statistika va search */}
      <div className="bg-gradient-to-br from-leaf-100 to-cream-50 border border-leaf-300/40 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-forest-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-forest-700" />
              {t("integrations.title")}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              {t("integrations.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <div>
              <p className="text-2xl font-bold text-forest-800">{stats.connected}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{t("integrations.stat.connected")}</p>
            </div>
            <div className="w-px h-10 bg-cream-300" />
            <div>
              <p className="text-2xl font-bold text-slate-500">{stats.available}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{t("integrations.stat.available")}</p>
            </div>
            <div className="w-px h-10 bg-cream-300" />
            <div>
              <p className="text-2xl font-bold text-slate-400">{stats.total}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{t("integrations.stat.total")}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <label className="relative block max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("integrations.searchPlaceholder")}
            className="w-full bg-white border border-cream-300 rounded-lg pl-10 pr-4 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
          />
        </label>
      </div>

      {/* Tavsiya etiladi */}
      {recommended.length > 0 && search === "" && activeCategory === "all" && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            {t("integrations.recommended")}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recommended.map((int) => (
              <IntegrationCard key={int.id} item={int} onClick={() => setSelected(int)} compact />
            ))}
          </div>
        </div>
      )}

      {/* Toifa tab'lari */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${
            activeCategory === "all"
              ? "bg-forest-700 text-white"
              : "bg-cream-100 text-slate-500 hover:text-forest-800"
          }`}
        >
          {t("integrations.allTab", { count: integrations.length })}
        </button>
        {integrationCategories.map((cat) => {
          const count = integrations.filter((i) => i.category === cat.id).length;
          const Icon = CATEGORY_ICONS[cat.id];
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${
                activeCategory === cat.id
                  ? "bg-forest-700 text-white"
                  : "bg-cream-100 text-slate-500 hover:text-forest-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Alohida hero kartochkalar — real integratsiyalar */}
      {(activeCategory === "all" || activeCategory === "erp") && search === "" && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t("integrations.activeSection")}</h4>
          <div className="space-y-3">
            <MoyskladIntegrationCard />
            <OneCIntegrationCard />
          </div>
        </div>
      )}
      {(activeCategory === "all" || activeCategory === "crm") && search === "" && (
        <div className="space-y-3">
          {activeCategory === "crm" && (
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("integrations.activeSection")}</h4>
          )}
          <SalesDoctorIntegrationCard />
        </div>
      )}
      {(activeCategory === "all" || activeCategory === "other") && search === "" && (
        <div className="space-y-3">
          {activeCategory === "other" && (
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("integrations.activeSection")}</h4>
          )}
          <WebhookIntegrationCard />
        </div>
      )}

      {/* Asosiy ro'yxat — toifa bo'yicha guruhlangan */}
      {activeCategory === "all" ? (
        <div className="space-y-6">
          {integrationCategories.map((cat) => {
            const items = filtered.filter((i) => i.category === cat.id);
            if (items.length === 0) return null;
            const Icon = CATEGORY_ICONS[cat.id];
            return (
              <div key={cat.id}>
                <div className="flex items-baseline justify-between mb-3">
                  <h4 className="text-sm font-semibold text-forest-800 flex items-center gap-2">
                    <Icon className="w-4 h-4 text-slate-400" />
                    {cat.label}
                  </h4>
                  <p className="text-[11px] text-slate-500">{cat.subtitle}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((int) => (
                    <IntegrationCard key={int.id} item={int} onClick={() => setSelected(int)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-sm text-slate-500">
              {t("integrations.notFound")}
            </div>
          ) : (
            filtered.map((int) => <IntegrationCard key={int.id} item={int} onClick={() => setSelected(int)} />)
          )}
        </div>
      )}

      {/* Setup modal */}
      <AnimatePresence>
        {selected && (
          <SetupModal item={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function IntegrationCard({
  item,
  onClick,
  compact = false,
}: {
  item: IntegrationItem;
  onClick: () => void;
  compact?: boolean;
}) {
  const { t } = useT();
  const statusBadge = () => {
    if (item.status === "connected") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-forest-700 bg-leaf-100 px-2 py-0.5 rounded-full">
          <CheckCircle2 className="w-2.5 h-2.5" />
          {t("integrations.badge.connected")}
        </span>
      );
    }
    if (item.status === "soon") {
      return (
        <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
          {t("integrations.badge.soon")}
        </span>
      );
    }
    return null;
  };

  return (
    <button
      onClick={onClick}
      disabled={item.status === "soon"}
      className={`group text-left bg-white border border-cream-300/80 rounded-2xl p-4 transition-all ${
        item.status === "soon"
          ? "opacity-60 cursor-not-allowed"
          : "hover:border-leaf-300 hover:shadow-md hover:shadow-leaf-500/5"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Logo placeholder — initial'lar bilan rangli kvadrat */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: item.color }}
        >
          {item.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-sm font-semibold text-forest-800 truncate">{item.name}</p>
            {item.region === "UZ" && <span className="text-[10px]">🇺🇿</span>}
          </div>
          <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{item.description}</p>
        </div>
      </div>
      {!compact && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-cream-300/60">
          {statusBadge() || <span className="text-[10px] text-slate-400">{t("integrations.badge.notConnected")}</span>}
          {item.status === "connected" ? (
            <span className="text-[11px] font-medium text-slate-500 group-hover:text-forest-800 flex items-center gap-1">
              <SettingsIcon className="w-3 h-3" />
              {t("integrations.action.configure")}
            </span>
          ) : item.status === "available" ? (
            <span className="text-[11px] font-semibold text-forest-700 flex items-center gap-1">
              <Plus className="w-3 h-3" />
              {t("integrations.action.connect")}
            </span>
          ) : null}
        </div>
      )}
    </button>
  );
}

function SetupModal({ item, onClose }: { item: IntegrationItem; onClose: () => void }) {
  const { t } = useT();
  const toast = useAppToast();
  const [apiKey, setApiKey] = useState("");
  const [secondField, setSecondField] = useState("");
  const [thirdField, setThirdField] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedWebhookUrl, setSavedWebhookUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Focus-trap + Escape + fokus tiklash (modal a11y). Modal faqat mount bo'lganda
  // ko'rinadi (parent `selected` bilan gate qiladi), shuning uchun active=true.
  const panelRef = useFocusTrap<HTMLDivElement>(true, onClose);

  // Field count: ba'zi providerlar 2 ta key kerak (Click — Merchant ID + Service ID)
  const needsSecondField = ["click", "payme", "uzum-pay", "alif", "google-analytics", "yandex-metrika"].includes(item.id);
  // Click qo'shimcha — secret key kerak (signature uchun)
  const needsThirdField = item.id === "click";

  // To'lov provayderlari (Click/Payme/Uzum) — to'g'ridan-to'g'ri PaymentMethod
  // jadvaliga yoziladi va shu zahoti faollashadi
  const isPaymentProvider = item.id === "click" || item.id === "payme" || item.id === "uzum-pay";

  const handleSave = async () => {
    if (!isPaymentProvider) {
      toast.info(t("integrations.toast.useCustomCard", { name: item.name }));
      onClose();
      return;
    }
    setSaving(true);
    try {
      // Kod xaritalash — IntegrationItem.id → PaymentMethod.code
      const code = item.id === "uzum-pay" ? "uzum" : item.id;
      // Mavjud usulni topish (PATCH) yoki yangi yaratish (POST)
      const list = await api<Array<{ id: string; code: string; webhookUrl?: string }>>("/payments/methods");
      const existing = list.find((m) => m.code === code);
      const config =
        item.id === "click"
          ? { merchantId: apiKey, serviceId: secondField, secretKey: thirdField }
          : item.id === "payme"
          ? { merchantId: apiKey, secretKey: secondField }
          : { secretKey: apiKey, merchantId: secondField };
      if (existing) {
        await api(`/payments/methods/${existing.id}`, { method: "PATCH", body: { config, status: "ACTIVE" } });
      } else {
        await api("/payments/methods", { method: "POST", body: { code, name: item.name, config, status: "ACTIVE" } });
      }
      // Webhook URL'ni qaytadan olamiz — provayder partner panel'ida shu URL kerak
      const refreshed = await api<Array<{ code: string; webhookUrl?: string }>>("/payments/methods");
      const me = refreshed.find((m) => m.code === code);
      if (me?.webhookUrl) {
        setSavedWebhookUrl(me.webhookUrl);
        toast.success(t("integrations.toast.connectedCopyUrl", { name: item.name }));
      } else {
        toast.success(t("integrations.toast.connectedVisible", { name: item.name }));
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("integrations.toast.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-cream-300 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-cream-300 flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: item.color }}
          >
            {item.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-forest-800">{item.name}</h3>
              {item.region === "UZ" && <span className="text-xs">🇺🇿</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mt-1 -mr-1 rounded-lg text-slate-400 hover:text-forest-800 hover:bg-cream-100"
            aria-label={t("common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {item.setupHint && (
            <div className="bg-leaf-100/50 border border-leaf-300/40 rounded-lg p-3">
              <p className="text-xs text-forest-800 leading-relaxed">💡 {item.setupHint}</p>
            </div>
          )}

          {item.status === "connected" ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 text-leaf-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-forest-800">{t("integrations.alreadyConnected")}</p>
              <p className="text-xs text-slate-500 mt-1">{t("integrations.alreadyConnectedHint")}</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  {item.category === "payments" ? t("integrations.field.merchantIdToken") :
                   item.category === "analytics" ? t("integrations.field.trackerId") :
                   item.category === "marketing" ? t("integrations.field.apiToken") :
                   t("integrations.field.apiKey")}
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={item.category === "analytics" ? "G-XXXXXXXX / 12345678" : "•••••••••••••••"}
                  className="w-full bg-white border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
                />
              </div>

              {needsSecondField && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    {item.id === "click" ? t("integrations.field.serviceId") :
                     item.id === "payme" ? t("integrations.field.cashboxId") :
                     item.id === "google-analytics" ? t("integrations.field.measurementId") :
                     t("integrations.field.secretKey")}
                  </label>
                  <input
                    type="text"
                    value={secondField}
                    onChange={(e) => setSecondField(e.target.value)}
                    placeholder="•••••••••••••••"
                    className="w-full bg-white border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
                  />
                </div>
              )}
              {needsThirdField && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    {t("integrations.field.secretKey")}
                  </label>
                  <input
                    type="password"
                    value={thirdField}
                    onChange={(e) => setThirdField(e.target.value)}
                    placeholder={t("integrations.field.secretKeyPlaceholder")}
                    className="w-full bg-white border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
                  />
                </div>
              )}
            </>
          )}

          {savedWebhookUrl && (
            <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-medium text-amber-800 mb-1.5">
                {t("integrations.webhookUrlWarning")}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border border-amber-300 rounded-md px-2.5 py-1.5 text-[11px] font-mono text-amber-900 truncate select-all">
                  {savedWebhookUrl}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(savedWebhookUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      toast.error(t("integrations.toast.copyFailed"));
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-md bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-medium flex items-center gap-1"
                >
                  {copied ? t("integrations.copied") : t("integrations.copy")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cream-300 flex items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm text-slate-500 hover:text-forest-800"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (!apiKey.trim() && item.status !== "connected")}
              className="px-4 py-2 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-forest-800"
            >
              {item.status === "connected" ? t("integrations.update") : t("integrations.action.connect")}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
