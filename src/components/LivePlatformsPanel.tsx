import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Send, Database, CreditCard, Wallet, Camera, Users as UsersIcon, MessageCircle, Smartphone, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import IntegrationModal from "./IntegrationModal";
import TelegramBotModal from "./TelegramBotModal";

interface PlatformCard {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  status: "connected" | "disconnected" | "soon";
  type?: "telegram" | "moysklad" | "click" | "payme" | "instagram" | "facebook" | "whatsapp" | "sms";
}

const platforms: Omit<PlatformCard, "status">[] = [
  { id: "telegram", name: "Telegram Bot", description: "Bot orqali sotuv va Mini App", icon: Send, color: "#0088cc", type: "telegram" },
  { id: "moysklad", name: "MoySklad", description: "Mahsulot va buyurtmalar sinxroni", icon: Database, color: "#1a73e8", type: "moysklad" },
  { id: "click", name: "Click", description: "Onlayn to'lov tizimi", icon: CreditCard, color: "#00b5ad", type: "click" },
  { id: "payme", name: "Payme", description: "Onlayn to'lov tizimi", icon: Wallet, color: "#3eaeff", type: "payme" },
  { id: "instagram", name: "Instagram", description: "Direct va commentlar (tez orada)", icon: Camera, color: "#ec4899", type: "instagram" },
  { id: "facebook", name: "Facebook", description: "Messenger va commentlar (tez orada)", icon: UsersIcon, color: "#3b82f6", type: "facebook" },
  { id: "whatsapp", name: "WhatsApp Business", description: "Bizes API (tez orada)", icon: MessageCircle, color: "#25d366", type: "whatsapp" },
  { id: "sms", name: "SMS (Eskiz)", description: "SMS yuborish (tez orada)", icon: Smartphone, color: "#f59e0b", type: "sms" },
];

export default function LivePlatformsPanel() {
  const [list, setList] = useState<PlatformCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<"telegram" | "moysklad" | "click" | "payme" | null>(null);

  async function load() {
    setLoading(true);
    try {
      const integrations = await api.integrations.list();
      const bots = await api.bots.list();
      const connectedTypes = new Set(integrations.map((i) => i.type));
      const hasBot = bots.length > 0;

      setList(platforms.map((p) => {
        let status: "connected" | "disconnected" | "soon";
        if (p.id === "telegram") status = hasBot ? "connected" : "disconnected";
        else if (["instagram", "facebook", "whatsapp", "sms"].includes(p.id)) status = "soon";
        else status = connectedTypes.has(p.id) ? "connected" : "disconnected";
        return { ...p, status } as PlatformCard;
      }));
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const stats = {
    total: list.length,
    connected: list.filter((p) => p.status === "connected").length,
    available: list.filter((p) => p.status === "disconnected").length,
    soon: list.filter((p) => p.status === "soon").length,
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="text-white font-semibold">🔌 Platformalar va integratsiyalar</h3>
            <p className="text-xs text-slate-500">{stats.connected} ulangan · {stats.available} mavjud · {stats.soon} tez orada</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && list.length === 0 ? (
        <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-6">
          {list.map((p) => {
            const Icon = p.icon;
            const isConnected = p.status === "connected";
            const isSoon = p.status === "soon";
            return (
              <div key={p.id} className={`bg-slate-800/40 border rounded-xl p-4 ${isConnected ? "border-emerald-500/30" : isSoon ? "border-slate-800" : "border-slate-800 hover:border-slate-700"} transition-colors`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${p.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: p.color }} />
                  </div>
                  {isConnected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Faol
                    </span>
                  )}
                  {isSoon && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                      Tez orada
                    </span>
                  )}
                  {!isConnected && !isSoon && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                      Mavjud
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-white mb-0.5">{p.name}</h4>
                <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">{p.description}</p>
                <button
                  disabled={isSoon}
                  onClick={() => {
                    if (isSoon) return;
                    if (p.type === "telegram") setActiveModal("telegram");
                    else if (p.type === "moysklad") setActiveModal("moysklad");
                    else if (p.type === "click") setActiveModal("click");
                    else if (p.type === "payme") setActiveModal("payme");
                  }}
                  className={`w-full mt-3 text-xs font-medium py-2 rounded-lg transition-colors ${
                    isConnected ? "bg-slate-700 hover:bg-slate-600 text-white" :
                    isSoon ? "bg-slate-800 text-slate-500 cursor-not-allowed" :
                    "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {isConnected ? "⚙ Sozlash" : isSoon ? "Tez orada" : "→ Ulash"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <TelegramBotModal open={activeModal === "telegram"} onClose={() => { setActiveModal(null); void load(); }} />
      {activeModal && activeModal !== "telegram" && (
        <IntegrationModal provider={activeModal} open={!!activeModal} onClose={() => { setActiveModal(null); void load(); }} />
      )}
    </div>
  );
}
