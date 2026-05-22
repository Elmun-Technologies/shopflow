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
  WEBSITE: { label: "Veb-sayt", icon: Globe, color: "text-blue-400" },
  LANDING_PAGE: { label: "Landing Page", icon: Monitor, color: "text-cyan-400" },
  INSTAGRAM: { label: "Instagram", icon: Instagram, color: "text-pink-400" },
  TELEGRAM: { label: "Telegram", icon: Send, color: "text-sky-400" },
  FACEBOOK: { label: "Facebook", icon: Facebook, color: "text-blue-500" },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle, color: "text-green-400" },
  EMAIL: { label: "Email", icon: Mail, color: "text-amber-400" },
  PHONE: { label: "Telefon", icon: Phone, color: "text-emerald-400" },
  REFERRAL: { label: "Referral", icon: UsersIcon, color: "text-violet-400" },
  GOOGLE_ADS: { label: "Google Ads", icon: Target, color: "text-red-400" },
  YANDEX_DIRECT: { label: "Yandex Direct", icon: Target, color: "text-orange-400" },
  MARKETPLACE: { label: "Marketplace", icon: ShoppingBag, color: "text-purple-400" },
  OFFLINE: { label: "Offline", icon: MapPin, color: "text-slate-400" },
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
    if (!confirm(`"${ch.name}" kanalini o'chirish? Unga bog'langan lidlar saqlanadi.`)) return;
    await channelsApi.delete(ch.id);
    refetch();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">{t("platforms.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("platforms.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium text-white"
        >
          <Plus className="w-4 h-4" />
          {t("platforms.newChannel")}
        </button>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-slate-300">{error.message}</p>
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Layers className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-base font-semibold text-white">{t("platforms.empty.title")}</p>
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
        setConnectMsg({ ok: false, text: json.error || "Xato" });
      } else {
        setConnectMsg({
          ok: true,
          text: `Ulanishi muvaffaqiyatli! Bot: @${json.bot?.username ?? "?"}`,
        });
        onChanged();
      }
    } catch (err) {
      setConnectMsg({ ok: false, text: err instanceof Error ? err.message : "Xato" });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center ${meta.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{channel.name}</p>
            <p className="text-xs text-slate-500">
              {meta.label}
              {botUsername && (
                <>
                  {" · "}
                  <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline"
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
            channel.active ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700 text-slate-400"
          }`}
        >
          {channel.active ? "Aktiv" : "O'chirilgan"}
        </span>
      </div>

      {channel.type === "TELEGRAM" && (
        <div className="bg-slate-800/50 border border-slate-800 rounded-lg p-2.5 mb-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-slate-500 uppercase mb-0.5">Bot token</p>
              <p className="text-[11px] text-slate-300 font-mono truncate">
                {hasToken ? (config.botToken as string) : <span className="text-slate-600">kiritilmagan</span>}
              </p>
            </div>
            <button
              onClick={() => setShowTokenModal(true)}
              className="ml-2 px-2 py-1 rounded text-emerald-400 hover:bg-slate-700 text-[11px] font-medium"
            >
              {hasToken ? "O'zgartirish" : "Qo'shish"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-800 rounded-lg p-2.5 mb-3">
        <p className="text-[10px] text-slate-500 uppercase mb-1">Webhook URL</p>
        <div className="flex items-center gap-2">
          <code className="text-[11px] text-slate-300 font-mono truncate flex-1">{webhookUrl}</code>
          <button
            onClick={copy}
            className="p-1 rounded text-slate-500 hover:text-white flex-shrink-0"
            aria-label="Nusxa olish"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {channel.type === "TELEGRAM" && hasToken && (
        <button
          onClick={handleConnectTelegram}
          disabled={connecting}
          className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg text-sm font-medium text-sky-400 disabled:opacity-50"
        >
          {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Telegram'ga avto-ulash (setWebhook)
        </button>
      )}

      {connectMsg && (
        <div
          className={`mb-3 px-3 py-2 rounded-lg text-xs ${
            connectMsg.ok
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {connectMsg.text}
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Yaratilgan: {formatDate(channel.createdAt)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="px-2 py-1 rounded text-emerald-400 hover:bg-slate-800 text-[11px] font-medium"
          >
            {showHelp ? "Yopish" : "Qanday ulanadi?"}
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-800"
            title={channel.active ? "O'chirish" : "Yoqish"}
          >
            {channel.active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800"
            title="O'chirish"
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
  const renderSteps = () => {
    switch (channelType) {
      case "TELEGRAM":
        return (
          <>
            <Step n={1}>
              Telegram'da{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 underline"
              >
                @BotFather
              </a>
              'ga yozing → <code>/newbot</code> → nomini va username'ini bering. Sizga <strong>bot token</strong>
              beradi (masalan: <code>123456:ABCdef...</code>)
            </Step>
            <Step n={2}>
              Brauzer adres satriga quyidagi URL'ni kiriting (TOKEN ni o'zgartirib):
              <pre className="mt-1 p-2 bg-slate-950 rounded text-[10px] text-slate-300 font-mono overflow-x-auto break-all whitespace-pre-wrap">
                {`https://api.telegram.org/bot<TOKEN>/setWebhook?url=${webhookUrl}`}
              </pre>
            </Step>
            <Step n={3}>
              Javob <code>{`{"ok":true,"result":true}`}</code> bo'lsa, tayyor. Endi botingizga yozilgan har bir
              xabar avtomatik <strong>Lidlar</strong> sahifasiga keladi.
            </Step>
          </>
        );
      case "WEBSITE":
      case "LANDING_PAGE":
        return (
          <>
            <Step n={1}>Veb-saytingizdagi forma'ni quyidagicha sozlang:</Step>
            <Step n={2}>
              <pre className="mt-1 p-2 bg-slate-950 rounded text-[10px] text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
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
                className="text-emerald-400 underline"
              >
                Meta for Developers
              </a>{" "}
              → App yarating (Business type)
            </Step>
            <Step n={2}>
              App'ga Webhook qo'shing. Callback URL sifatida quyidagini kiriting:
              <pre className="mt-1 p-2 bg-slate-950 rounded text-[10px] text-slate-300 font-mono overflow-x-auto break-all">
                {webhookUrl}
              </pre>
            </Step>
            <Step n={3}>
              ⚠️ Meta HTTPS talab qiladi. Domain va SSL sertifikat kerak (hozir HTTP'da ishlamaydi).
            </Step>
          </>
        );
      default:
        return (
          <>
            <Step n={1}>Tashqi platforma webhook'iga quyidagi URL'ni kiriting:</Step>
            <Step n={2}>
              <pre className="mt-1 p-2 bg-slate-950 rounded text-[10px] text-slate-300 font-mono overflow-x-auto break-all">
                {webhookUrl}
              </pre>
            </Step>
            <Step n={3}>
              Body formati: <code>{`{"name":"...","phone":"...","email":"...","notes":"..."}`}</code>
            </Step>
          </>
        );
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
      <p className="text-xs font-semibold text-white mb-2">Sozlash bosqichlari</p>
      {renderSteps()}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs text-slate-300">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
        {n}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function AddChannelModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
      setError(err instanceof Error ? err.message : "Xato");
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
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4"
      >
        <h2 className="text-lg font-bold text-white">Yangi kanal</h2>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Kanal turi</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ChannelType)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
          >
            {(Object.keys(channelTypeMeta) as ChannelType[]).map((k) => (
              <option key={k} value={k}>
                {channelTypeMeta[k].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Nom</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === "TELEGRAM" ? "Mening Telegram botim" : "Kanal nomi"}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        {type === "TELEGRAM" && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Bot token{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline"
              >
                (@BotFather'dan oling)
              </a>
            </label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="7891234567:AAEhBP1234abcdEFGHIjklmn..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Token xavfsiz saqlanadi va GET so'rovlarida yashiringan ko'rsatiladi.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-slate-400 hover:text-white">
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-sm font-medium text-white"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Yaratish
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
      setError(err instanceof Error ? err.message : "Xato");
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
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4"
      >
        <h2 className="text-lg font-bold text-white">Bot token</h2>

        <div className="text-xs text-slate-400 space-y-2 bg-slate-800/50 border border-slate-800 rounded-lg p-3">
          <p>1. Telegram'da{" "}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 underline"
            >
              @BotFather
            </a>
            'ga yozing
          </p>
          <p>2. <code className="bg-slate-900 px-1 rounded">/newbot</code> komandasini yuboring</p>
          <p>3. Bot nomi va username'ni bering</p>
          <p>4. BotFather sizga token beradi (masalan: <code className="bg-slate-900 px-1 rounded">7891234567:AAE...</code>)</p>
          <p>5. Tokenni nusxalab, quyiga joylashtiring</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Bot token</label>
          <input
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="7891234567:AAEhBP1234abcdEFGHIjklmn..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-slate-400 hover:text-white">
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={saving || !token.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-sm font-medium text-white"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Saqlash
          </button>
        </div>
      </form>
    </div>
  );
}
