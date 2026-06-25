import { useEffect, useState } from "react";
import { Key, Plus, Copy, CheckCircle2, Trash2, Clock, X, AlertTriangle, Power } from "lucide-react";
import { api } from "../api/client";
import { useT } from "../i18n";
import { formatRelative } from "../utils/format";
import { useAppToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmDialog";

// Backend /settings/api-keys shakli (keyHash hech qachon kelmaydi)
interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

interface CreatedKey {
  id: string;
  name: string;
  prefix: string;
  key: string; // to'liq kalit — faqat bir marta
}

export function ApiKeysSection() {
  const { t } = useT();
  const toast = useAppToast();
  const confirmDialog = useConfirm();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [revealed, setRevealed] = useState<CreatedKey | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<ApiKeyRow[]>("/settings/api-keys");
      setKeys(data);
    } catch {
      toast.error(t("settings.api.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await api<CreatedKey>("/settings/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), scopes: [] }),
      });
      setRevealed(created);
      setCreateModalOpen(false);
      setNewName("");
      await load();
    } catch {
      toast.error(t("settings.api.createError"));
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (k: ApiKeyRow) => {
    // Optimistik
    setKeys((prev) => prev.map((x) => x.id === k.id ? { ...x, active: !x.active } : x));
    try {
      await api(`/settings/api-keys/${k.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !k.active }),
      });
    } catch {
      setKeys((prev) => prev.map((x) => x.id === k.id ? { ...x, active: k.active } : x));
    }
  };

  const handleDelete = async (k: ApiKeyRow) => {
    const ok = await confirmDialog({
      title: t("settings.api.deleteTitle"),
      description: t("settings.api.deleteDesc", { name: k.name }),
      confirmText: t("settings.api.delete"),
      cancelText: t("common.cancel"),
    });
    if (!ok) return;
    await api(`/settings/api-keys/${k.id}`, { method: "DELETE" });
    setKeys((prev) => prev.filter((x) => x.id !== k.id));
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm text-forest-800 font-semibold">{t("settings.api.title")}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{t("settings.api.hint")}</p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-leaf-400 hover:bg-leaf-500 text-forest-800 text-xs font-medium rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t("settings.api.newKey")}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-28 bg-cream-100 rounded-xl animate-pulse" />)}
        </div>
      ) : keys.length === 0 ? (
        <div className="bg-cream-100/50 border border-cream-300 rounded-xl p-8 text-center">
          <Key className="w-10 h-10 text-cream-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-forest-800">{t("settings.api.empty")}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t("settings.api.emptyHint")}</p>
        </div>
      ) : (
        keys.map((k) => (
          <div key={k.id} className={`bg-cream-100/50 border rounded-xl p-4 transition-all ${k.active ? "border-cream-300" : "border-cream-300/50 opacity-70"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Key className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="text-sm text-forest-800 font-semibold truncate">{k.name}</span>
                {k.active
                  ? <span className="text-[10px] text-leaf-700 bg-leaf-100 px-2 py-0.5 rounded-full flex-shrink-0">{t("settings.api.active")}</span>
                  : <span className="text-[10px] text-slate-400 bg-cream-100 px-2 py-0.5 rounded-full flex-shrink-0">{t("settings.api.disabled")}</span>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleToggle(k)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-200 transition-colors"
                  title={k.active ? t("settings.api.disable") : t("settings.api.enable")}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(k)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-100 transition-colors"
                  title={t("settings.api.delete")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Masked prefix — to'liq kalit faqat yaratishda ko'rsatiladi */}
            <div className="bg-white rounded-lg px-3 py-2 font-mono text-xs text-slate-500 mb-3">
              {k.prefix}{"•".repeat(24)}
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex flex-wrap gap-1.5">
                {k.scopes.length === 0 ? (
                  <span className="text-[10px] text-slate-500 bg-cream-100 px-2 py-0.5 rounded-md">{t("settings.api.allScopes")}</span>
                ) : k.scopes.map((p) => (
                  <span key={p} className="text-[10px] text-slate-500 bg-cream-100 px-2 py-0.5 rounded-md">{p}</span>
                ))}
              </div>
              {/* Access audit — oxirgi ishlatilgan vaqt (til-aware relative) */}
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock className="w-3 h-3" />
                {k.lastUsedAt
                  ? `${t("settings.api.lastUsed")}: ${formatRelative(k.lastUsedAt)}`
                  : t("settings.api.neverUsed")}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Create modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setCreateModalOpen(false)}>
          <div className="bg-white rounded-2xl border border-cream-200 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-cream-100">
              <h3 className="font-bold text-forest-800">{t("settings.api.createTitle")}</h3>
              <button onClick={() => setCreateModalOpen(false)} className="p-1.5 text-slate-400 hover:text-forest-700 hover:bg-cream-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                placeholder={t("settings.api.namePlaceholder")}
                className="w-full text-sm px-3 py-2 border border-cream-300 rounded-xl focus:outline-none focus:border-leaf-400"
              />
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-cream-100">
              <button onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-forest-800">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-5 py-2 text-sm font-semibold rounded-xl bg-leaf-400 text-forest-800 hover:bg-leaf-500 disabled:opacity-50"
              >
                {t("settings.api.create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One-time key reveal */}
      {revealed && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-cream-200 w-full max-w-md shadow-xl">
            <div className="p-5 border-b border-cream-100">
              <h3 className="font-bold text-forest-800">{t("settings.api.createdTitle")}</h3>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">{t("settings.api.createdWarning")}</p>
              </div>
              <div className="flex items-center gap-2 bg-cream-50 border border-cream-300 rounded-xl px-3 py-2.5">
                <code className="flex-1 font-mono text-xs text-forest-800 break-all">{revealed.key}</code>
                <button
                  onClick={() => copy(revealed.key, revealed.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-200 flex-shrink-0"
                  title={t("settings.api.copy")}
                >
                  {copiedId === revealed.id ? <CheckCircle2 className="w-4 h-4 text-leaf-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end px-5 py-4 border-t border-cream-100">
              <button
                onClick={() => setRevealed(null)}
                className="px-5 py-2 text-sm font-semibold rounded-xl bg-forest-700 text-white hover:bg-forest-800"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
