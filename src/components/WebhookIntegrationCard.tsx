// Custom Webhook integratsiyasi — tenant tashqi tizimlarga event yuborishni
// sozlaydi. order.created / order.status_changed / order.paid / lead.created.
// Har biri HMAC-SHA256 imzo bilan (secret kiritilsa).

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Webhook, Plus, Loader2, Trash2, Send, CheckCircle2, AlertCircle, X } from "lucide-react";
import { webhooksApi, type OutboundWebhook } from "../api/endpoints";
import { useAppToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmDialog";
import { useT } from "../i18n";

const EVENT_LABEL_KEYS: Record<string, string> = {
  "order.created": "webhook.event.created",
  "order.status_changed": "webhook.event.status_changed",
  "order.paid": "webhook.event.paid",
  "lead.created": "webhook.event.lead_created",
};

export function WebhookIntegrationCard() {
  const { t } = useT();
  const toast = useAppToast();
  const confirm = useConfirm();
  const [hooks, setHooks] = useState<OutboundWebhook[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    try {
      const res = await webhooksApi.list();
      setHooks(res.items);
      setEvents(res.availableEvents);
    } catch {
      /* ignore — kartochka bo'sh ko'rinadi */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void reload(); }, []);

  const toggleActive = async (h: OutboundWebhook) => {
    setBusyId(h.id);
    try {
      await webhooksApi.update(h.id, { active: !h.active });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("webhook.toast.error"));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (h: OutboundWebhook) => {
    const ok = await confirm({ title: t("webhook.confirmDelete"), description: h.url, kind: "danger", confirmText: t("common.delete") });
    if (!ok) return;
    setBusyId(h.id);
    try {
      await webhooksApi.remove(h.id);
      toast.success(t("webhook.toast.deleted"));
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("webhook.toast.error"));
    } finally {
      setBusyId(null);
    }
  };

  const test = async (h: OutboundWebhook) => {
    setBusyId(h.id);
    try {
      const res = await webhooksApi.test(h.id);
      if (res.lastStatus && res.lastStatus >= 200 && res.lastStatus < 300) {
        toast.success(t("webhook.toast.testOk", { status: res.lastStatus }));
      } else {
        toast.error(t("webhook.toast.testFail", { error: res.lastError ?? t("webhook.noResponse") }));
      }
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("webhook.toast.error"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-cream-300 p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: "#5FA340" }}>
            <Webhook className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-forest-800">Custom Webhook</h3>
            <p className="text-xs text-slate-500">{t("webhook.subtitle")}</p>
          </div>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-leaf-400 hover:bg-leaf-500 rounded-lg text-sm font-medium text-forest-800"
        >
          <Plus className="w-4 h-4" /> {t("common.add")}
        </button>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : hooks.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">
          {t("webhook.empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {hooks.map((h) => (
            <div key={h.id} className={`p-3 rounded-xl border ${h.active ? "border-cream-300 bg-cream-50" : "border-cream-300 bg-cream-100/40 opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-forest-800 truncate font-mono">{h.url}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {h.events.map((e) => (
                      <span key={e} className="text-[10px] px-1.5 py-0.5 rounded-full bg-leaf-100 text-forest-700">
                        {EVENT_LABEL_KEYS[e] ? t(EVENT_LABEL_KEYS[e]) : e}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                    {h.hasSecret && <span className="text-forest-600">🔒 HMAC</span>}
                    {h.lastStatus != null && (
                      <span className={h.lastStatus >= 200 && h.lastStatus < 300 ? "text-forest-700" : "text-red-600"}>
                        {h.lastStatus >= 200 && h.lastStatus < 300 ? <CheckCircle2 className="w-3 h-3 inline" /> : <AlertCircle className="w-3 h-3 inline" />}
                        {" "}HTTP {h.lastStatus}
                      </span>
                    )}
                    {h.failureCount > 0 && <span className="text-amber-600">{t("webhook.failureCount", { count: h.failureCount })}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => test(h)} disabled={busyId === h.id} className="p-1.5 rounded-lg text-slate-500 hover:text-forest-700 hover:bg-cream-100" title={t("webhook.test")}>
                    {busyId === h.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                  <button onClick={() => toggleActive(h)} disabled={busyId === h.id} className="text-[10px] px-2 py-1 rounded-lg bg-cream-100 hover:bg-cream-200 text-slate-600">
                    {h.active ? t("webhook.active") : t("webhook.off")}
                  </button>
                  <button onClick={() => remove(h)} disabled={busyId === h.id} className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50" title={t("common.delete")}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <WebhookFormModal
          events={events}
          onClose={() => setFormOpen(false)}
          onCreated={() => { setFormOpen(false); toast.success(t("webhook.toast.added")); reload(); }}
        />
      )}
    </div>
  );
}

function WebhookFormModal({ events, onClose, onCreated }: { events: string[]; onClose: () => void; onCreated: () => void }) {
  const { t } = useT();
  const toast = useAppToast();
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>(["order.created"]);
  const [secret, setSecret] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (e: string) => setSelected((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!url.trim() || selected.length === 0) return;
    setBusy(true);
    try {
      await webhooksApi.create({
        url: url.trim(),
        events: selected,
        secret: secret.trim() || undefined,
        description: description.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("webhook.toast.notSaved"));
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <motion.form
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-cream-300 rounded-2xl p-5 max-w-md w-full"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-forest-800">{t("webhook.modalTitle")}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-cream-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">{t("webhook.endpointUrl")}</span>
            <input type="url" required autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhook" className={`${field} font-mono`} />
          </label>
          <div>
            <span className="text-xs text-slate-500 mb-1.5 block">{t("webhook.events")}</span>
            <div className="space-y-1.5">
              {events.map((e) => (
                <label key={e} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selected.includes(e)} onChange={() => toggle(e)} className="w-4 h-4 rounded border-cream-300 text-leaf-500" />
                  <span className="text-sm text-forest-800">{EVENT_LABEL_KEYS[e] ? t(EVENT_LABEL_KEYS[e]) : e}</span>
                  <code className="text-[10px] text-slate-400">{e}</code>
                </label>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">{t("webhook.secret")}</span>
            <input type="text" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={t("webhook.secretPlaceholder")} className={field} />
            <p className="text-[10px] text-slate-400 mt-1">{t("webhook.secretHelper")} <code>X-ShopFlow-Signature</code> {t("webhook.secretHelperSuffix")}</p>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">{t("webhook.comment")}</span>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-sm bg-cream-100 hover:bg-cream-200 text-slate-700">{t("common.cancel")}</button>
          <button type="submit" disabled={busy || !url.trim() || selected.length === 0} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 text-forest-800 font-medium">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("common.add")}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
