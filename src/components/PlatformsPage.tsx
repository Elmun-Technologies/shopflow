import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Loader2,
  AlertCircle,
  Layers,
  Copy,
  Check,
  Trash2,
  Power,
  PowerOff,
  Globe,
  Instagram,
  Send,
  Facebook,
  MessageCircle,
  Mail,
  Phone,
  Users as UsersIcon,
  Target,
  ShoppingBag,
  MapPin,
  Monitor,
} from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { channelsApi } from "../api/endpoints";
import { formatDate } from "../utils/format";
import type { ChannelType, Channel } from "../types/api";
import { useT } from "../i18n";

const channelTypeMeta: Record<ChannelType, { label: string; icon: React.ElementType; color: string }> = {
  WEBSITE: { label: "Veb-sayt", icon: Globe, color: "text-forest-700" },
  LANDING_PAGE: { label: "Landing Page", icon: Monitor, color: "text-forest-700" },
  INSTAGRAM: { label: "Instagram", icon: Instagram, color: "text-pink-600" },
  TELEGRAM: { label: "Telegram", icon: Send, color: "text-blue-600" },
  FACEBOOK: { label: "Facebook", icon: Facebook, color: "text-blue-600" },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle, color: "text-leaf-600" },
  EMAIL: { label: "Email", icon: Mail, color: "text-amber-500" },
  PHONE: { label: "Telefon", icon: Phone, color: "text-forest-700" },
  REFERRAL: { label: "Referral", icon: UsersIcon, color: "text-violet-600" },
  GOOGLE_ADS: { label: "Google Ads", icon: Target, color: "text-rose-600" },
  YANDEX_DIRECT: { label: "Yandex Direct", icon: Target, color: "text-orange-600" },
  MARKETPLACE: { label: "Marketplace", icon: ShoppingBag, color: "text-purple-400" },
  OFFLINE: { label: "Offline", icon: MapPin, color: "text-slate-500" },
};

export default function PlatformsPage() {
  const { t } = useT();
  const { data, loading, error, refetch } = useAsync(() => channelsApi.list(), []);
  const [showAdd, setShowAdd] = useState(false);
  const channels = data ?? [];

  const handleToggle = async (ch: Channel) => {
    await channelsApi.update(ch.id, { active: !ch.active });
    refetch();
  };

  const handleDelete = async (ch: Channel) => {
    if (!confirm(t("platforms.deleteConfirm", { name: ch.name }))) return;
    await channelsApi.delete(ch.id);
    refetch();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-forest-800">{t("platforms.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("platforms.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-leaf-400 hover:bg-leaf-500 rounded-lg text-sm font-medium text-forest-800 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t("platforms.newChannel")}</span>
        </button>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-white border border-cream-300 rounded-xl p-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <p className="text-sm text-slate-700">{error.message}</p>
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-white border border-cream-300 rounded-xl p-12 text-center">
          <Layers className="w-12 h-12 text-cream-300 mx-auto mb-3" />
          <p className="text-base font-semibold text-forest-800">{t("platforms.empty.title")}</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {t("platforms.empty.hint")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((ch) => (
            <ChannelCard
              key={ch.id}
              channel={ch}
              onToggle={() => handleToggle(ch)}
              onDelete={() => handleDelete(ch)}
              onChanged={refetch}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddChannelModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            refetch();
          }}
        />
      )}
    </>
  );
}

function ChannelCard({
  channel,
  onToggle,
  onDelete,
  onChanged,
}: {
  channel: Channel;
  onToggle: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const { t } = useT();
  const meta = channelTypeMeta[channel.type];
  const Icon = meta.icon;
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const webhookPath = channel.type === "TELEGRAM" ? "telegram" : "lead";
  const webhookUrl = `${window.location.origin}/api/webhooks/${webhookPath}/${channel.webhookKey}`;
  const config = (channel.config ?? {}) as Record<string, unknown>;
  const hasToken = channel.type === "TELEGRAM" && Boolean(config.botToken_set || config.botToken);
  const botUsername = config.botUsername as string | undefined;

  const copy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleConnectTelegram = async () => {
    if (!hasToken) {
      setShowTokenModal(true);
      return;
    }
    setConnecting(true);
    setConnectMsg(null);
    try {
      const res = await fetch(
        `${window.location.origin}/api/channels/${channel.id}/telegram/setup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("shopflow.token")}`,
          },
          body: JSON.stringify({ publicHost: window.location.origin }),
        },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string; bot?: { username?: string } };
      if (!res.ok || !json.ok) {
        setConnectMsg({ ok: false, text: json.error || t("common.error") });
      } else {
        setConnectMsg({
          ok: true,
          text: t("platforms.connectOk", { username: json.bot?.username ?? "?" }),
        });
        onChanged();
      }
    } catch (err) {
      setConnectMsg({ ok: false, text: err instanceof Error ? err.message : t("common.error") });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="bg-white border border-cream-300 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-cream-100 flex items-center justify-center ${meta.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-forest-800">{channel.name}</p>
            <p className="text-xs text-slate-500">
              {t(`leads.channel.${channel.type}`)}
              {botUsername && (
                <>
                  {" · "}
                  <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-forest-700 hover:underline"
                  >
                    @{botUsername}
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
            channel.active ? "bg-leaf-100 text-forest-700" : "bg-cream-200 text-slate-500"
          }`}
        >
          {channel.active ? t("platforms.statusActive") : t("platforms.statusDisabled")}
        </span>
      </div>

      {channel.type === "TELEGRAM" && (
        <div className="bg-cream-100/50 border border-cream-300 rounded-lg p-2.5 mb-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-slate-500 uppercase mb-0.5">{t("platforms.botToken")}</p>
              <p className="text-[11px] text-slate-700 font-mono truncate">
                {hasToken ? (config.botToken as string) : <span className="text-slate-400">{t("platforms.notSet")}</span>}
              </p>
            </div>
            <button
              onClick={() => setShowTokenModal(true)}
              className="ml-2 px-2 py-1 rounded text-forest-700 hover:bg-cream-200 text-[11px] font-medium"
            >
              {hasToken ? t("common.edit") : t("common.add")}
            </button>
          </div>
        </div>
      )}

      <div className="bg-cream-100/50 border border-cream-300 rounded-lg p-2.5 mb-3">
        <p className="text-[10px] text-slate-500 uppercase mb-1">{t("platforms.webhookUrl")}</p>
        <div className="flex items-center gap-2">
          <code className="text-[11px] text-slate-700 font-mono truncate flex-1">{webhookUrl}</code>
          <button
            onClick={copy}
            className="p-1 rounded text-slate-500 hover:text-forest-900 flex-shrink-0"
            aria-label={t("platforms.copy")}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-forest-700" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {channel.type === "TELEGRAM" && hasToken && (
        <button
          onClick={handleConnectTelegram}
          disabled={connecting}
          className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 bg-leaf-100 hover:bg-leaf-200 border border-leaf-300/60 rounded-lg text-sm font-medium text-forest-700 disabled:opacity-50"
        >
          {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {t("platforms.telegramAutoConnect")}
        </button>
      )}

      {connectMsg && (
        <div
          className={`mb-3 px-3 py-2 rounded-lg text-xs ${
            connectMsg.ok
              ? "bg-leaf-100 border border-leaf-300/60 text-forest-700"
              : "bg-rose-100 border border-rose-300 text-rose-600"
          }`}
        >
          {connectMsg.text}
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{t("platforms.createdAt")}: {formatDate(channel.createdAt)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="px-2 py-1 rounded text-forest-700 hover:bg-cream-100 text-[11px] font-medium"
          >
            {showHelp ? t("common.close") : t("platforms.howToConnect")}
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded text-slate-500 hover:text-forest-900 hover:bg-cream-100"
            title={channel.active ? t("platforms.disable") : t("platforms.enable")}
          >
            {channel.active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-cream-100"
            title={t("common.delete")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showHelp && <ChannelSetupHelp channelType={channel.type} webhookUrl={webhookUrl} />}

      {showTokenModal && (
        <BotTokenModal
          channel={channel}
          onClose={() => setShowTokenModal(false)}
          onSaved={() => {
            setShowTokenModal(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function ChannelSetupHelp({
  channelType,
  webhookUrl,
}: {
  channelType: ChannelType;
  webhookUrl: string;
}) {
  const { t } = useT();
  const renderSteps = () => {
    switch (channelType) {
      case "TELEGRAM":
        return (
          <>
            <Step n={1}>
              {t("platforms.setup.tg.step1.pre")}{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-forest-700 underline"
              >
                @BotFather
              </a>
              {t("platforms.setup.tg.step1.post", { newbot: "/newbot", example: "123456:ABCdef..." })}
            </Step>
            <Step n={2}>
              {t("platforms.setup.tg.step2")}
              <pre className="mt-1 p-2 bg-cream-50 rounded text-[10px] text-slate-700 font-mono overflow-x-auto break-all whitespace-pre-wrap">
                {`https://api.telegram.org/bot<TOKEN>/setWebhook?url=${webhookUrl}`}
              </pre>
            </Step>
            <Step n={3}>
              {t("platforms.setup.tg.step3.pre")} <code>{`{"ok":true,"result":true}`}</code> {t("platforms.setup.tg.step3.post")}
            </Step>
          </>
        );
      case "WEBSITE":
      case "LANDING_PAGE":
        return (
          <>
            <Step n={1}>{t("platforms.setup.website.step1")}</Step>
            <Step n={2}>
              <pre className="mt-1 p-2 bg-cream-50 rounded text-[10px] text-slate-700 font-mono overflow-x-auto whitespace-pre-wrap break-all">
{`<script>
fetch("${webhookUrl}", {
  method: "POST",
  headers: {"Content-Type":"application/json"},
  body: JSON.stringify({
    name: "Ism",
    phone: "+998901234567",
    email: "user@example.com"
  })
});
</script>`}
              </pre>
            </Step>
          </>
        );
      case "INSTAGRAM":
      case "FACEBOOK":
      case "WHATSAPP":
        return (
          <>
            <Step n={1}>
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noreferrer"
                className="text-forest-700 underline"
              >
                Meta for Developers
              </a>{" "}
              {t("platforms.setup.meta.step1.post")}
            </Step>
            <Step n={2}>
              {t("platforms.setup.meta.step2")}
              <pre className="mt-1 p-2 bg-cream-50 rounded text-[10px] text-slate-700 font-mono overflow-x-auto break-all">
                {webhookUrl}
              </pre>
            </Step>
            <Step n={3}>
              {t("platforms.setup.meta.step3")}
            </Step>
          </>
        );
      default:
        return (
          <>
            <Step n={1}>{t("platforms.setup.generic.step1")}</Step>
            <Step n={2}>
              <pre className="mt-1 p-2 bg-cream-50 rounded text-[10px] text-slate-700 font-mono overflow-x-auto break-all">
                {webhookUrl}
              </pre>
            </Step>
            <Step n={3}>
              {t("platforms.setup.generic.step3.pre")} <code>{`{"name":"...","phone":"...","email":"...","notes":"..."}`}</code>
            </Step>
          </>
        );
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-cream-300 space-y-2">
      <p className="text-xs font-semibold text-forest-800 mb-2">{t("platforms.setupSteps")}</p>
      {renderSteps()}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs text-slate-700">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-leaf-200 text-forest-700 flex items-center justify-center text-[10px] font-bold">
        {n}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function AddChannelModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useT();
  const [type, setType] = useState<ChannelType>("TELEGRAM");
  const [name, setName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const config: Record<string, unknown> = {};
      if (type === "TELEGRAM" && botToken.trim()) {
        config.botToken = botToken.trim();
      }
      await channelsApi.create({ type, name, config });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-cream-300 rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4"
      >
        <h2 className="text-lg font-bold text-forest-800">{t("platforms.add.title")}</h2>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">{t("platforms.add.type")}</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ChannelType)}
            className="w-full px-3 py-2 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-leaf-500"
          >
            {(Object.keys(channelTypeMeta) as ChannelType[]).map((k) => (
              <option key={k} value={k}>
                {t(`leads.channel.${k}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">{t("platforms.add.name")}</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === "TELEGRAM" ? t("platforms.add.namePh.telegram") : t("platforms.add.namePh.generic")}
            className="w-full px-3 py-2 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-leaf-500"
          />
        </div>

        {type === "TELEGRAM" && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              {t("platforms.add.botToken")}{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-forest-700 hover:underline"
              >
                {t("platforms.add.botFather")}
              </a>
            </label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="7891234567:AAEhBP1234abcdEFGHIjklmn..."
              className="w-full px-3 py-2 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm font-mono focus:outline-none focus:border-leaf-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {t("platforms.add.tokenNote")}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex items-center gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-slate-500 hover:text-forest-900">
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-sm font-medium text-forest-800"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("platforms.add.create")}
          </button>
        </div>
      </form>
    </div>
  );
}

function BotTokenModal({
  channel,
  onClose,
  onSaved,
}: {
  channel: Channel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await channelsApi.update(channel.id, { config: { botToken: token.trim() } });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-cream-300 rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4"
      >
        <h2 className="text-lg font-bold text-forest-800">{t("platforms.botToken")}</h2>

        <div className="text-xs text-slate-500 space-y-2 bg-cream-100/50 border border-cream-300 rounded-lg p-3">
          <p>{t("platforms.tokenStep1")}</p>
          <p>{t("platforms.tokenStep2")}</p>
          <p>{t("platforms.tokenStep3")}</p>
          <p>{t("platforms.tokenStep4")} (<code className="bg-white px-1 rounded">7891234567:AAE...</code>)</p>
          <p>{t("platforms.tokenStep5")}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">{t("platforms.botToken")}</label>
          <input
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="7891234567:AAEhBP1234abcdEFGHIjklmn..."
            className="w-full px-3 py-2 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm font-mono focus:outline-none focus:border-leaf-500"
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex items-center gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-slate-500 hover:text-forest-900">
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving || !token.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-sm font-medium text-forest-800"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
