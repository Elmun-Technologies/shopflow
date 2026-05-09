import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Mail,
  Tag,
  Share2,
  MessageSquare,
  Send,
  Image as ImageIcon,
  Star,
  Megaphone,
  ExternalLink,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  ChevronLeft,
  Award,
  Trophy,
  ArrowLeftRight,
  Gift,
  Trash,
} from "lucide-react";
import type {
  MarketingSub,
  EmailCampaign,
  EmailCampaignStatus,
  PromoCode,
  MarketingSource,
  SmsCampaign,
  SmsCampaignStatus,
  ChannelPost,
  ChannelPlatform,
  ChannelPostStatus,
  MarketingBanner,
  BannerPlacement,
  ProductReview,
  ReviewStatus,
  GiftPromotion,
  LoyaltyRule,
  LoyaltySettings,
  GiveawayContest,
  GiveawayStatus,
  GiveawayPrizeType,
  LoyaltyTransaction,
  TransactionType,
} from "../data/marketingData";
import {
  marketingSubOrder,
  marketingSubLabels,
  initialEmailCampaigns,
  initialPromoCodes,
  initialGiftPromotions,
  initialSources,
  initialSmsCampaigns,
  initialChannelPosts,
  initialBanners,
  initialReviews,
  initialLoyaltyRules,
  initialLoyaltySettings,
  initialGiveaways,
  initialTransactions,
  emailCampaignStatusLabels,
  smsStatusLabels,
  channelPlatformLabels,
  channelPostStatusLabels,
  bannerPlacementLabels,
  reviewStatusLabels,
  giveawayPrizeTypeLabels,
  giveawayStatusLabels,
  transactionTypeLabels,
} from "../data/marketingData";

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now()}`;
}

interface MarketingPageProps {
  activeSub: MarketingSub;
  onSubChange: (sub: MarketingSub) => void;
}

type PageMode = "list" | "create" | "edit";

type EditTarget =
  | { kind: "none" }
  | { kind: "email"; item: EmailCampaign | null }
  | { kind: "promo"; item: PromoCode | null }
  | { kind: "sovga"; item: GiftPromotion | null }
  | { kind: "source"; item: MarketingSource | null }
  | { kind: "sms"; item: SmsCampaign | null }
  | { kind: "channel"; item: ChannelPost | null }
  | { kind: "banner"; item: MarketingBanner | null }
  | { kind: "giveaway"; item: GiveawayContest | null }
  | { kind: "rule"; item: LoyaltyRule | null };

type DeleteState =
  | { kind: "none" }
  | { kind: "email"; id: string }
  | { kind: "promo"; id: string }
  | { kind: "sovga"; id: string }
  | { kind: "source"; id: string }
  | { kind: "sms"; id: string }
  | { kind: "channel"; id: string }
  | { kind: "banner"; id: string }
  | { kind: "giveaway"; id: string };

const inputClass =
  "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20";
const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";
const thClass =
  "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-slate-200 border-t border-slate-800";

function pillClass(active: boolean) {
  return active
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white";
}

/* Status badges */
function EmailStatusBadge({ status }: { status: EmailCampaignStatus }) {
  const map: Record<EmailCampaignStatus, string> = {
    draft: "bg-slate-700 text-slate-300",
    scheduled: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    sending: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
    sent: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    paused: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status]}`}>{emailCampaignStatusLabels[status]}</span>;
}

function SmsStatusBadge({ status }: { status: SmsCampaignStatus }) {
  const map: Record<SmsCampaignStatus, string> = {
    draft: "bg-slate-700 text-slate-300",
    scheduled: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    sent: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    failed: "bg-red-500/15 text-red-400 border border-red-500/30",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status]}`}>{smsStatusLabels[status]}</span>;
}

function PostStatusBadge({ status }: { status: ChannelPostStatus }) {
  const map: Record<ChannelPostStatus, string> = {
    draft: "bg-slate-700 text-slate-300",
    scheduled: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    published: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status]}`}>{channelPostStatusLabels[status]}</span>;
}

function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const map: Record<ReviewStatus, string> = {
    pending: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    rejected: "bg-red-500/15 text-red-400 border border-red-500/30",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status]}`}>{reviewStatusLabels[status]}</span>;
}

function GiveawayStatusBadge({ status }: { status: GiveawayStatus }) {
  const map: Record<GiveawayStatus, string> = {
    draft: "bg-slate-700 text-slate-300",
    active: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    ended: "bg-slate-600 text-slate-400 border border-slate-500/30",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status]}`}>{giveawayStatusLabels[status]}</span>;
}

function TransactionTypeBadge({ type }: { type: TransactionType }) {
  const colors: Record<TransactionType, string> = {
    earn: "bg-emerald-500/15 text-emerald-400",
    spend: "bg-red-500/15 text-red-400",
    expire: "bg-gray-500/15 text-gray-400",
    manual_add: "bg-blue-500/15 text-blue-400",
    manual_remove: "bg-orange-500/15 text-orange-400",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[type]}`}>{transactionTypeLabels[type]}</span>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="p-1 rounded text-slate-500 hover:text-emerald-400 transition-colors"
      title="Nusxalash"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function UsageBar({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-yellow-500" : "bg-emerald-500";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{used}</span>
        <span>{max}</span>
      </div>
      <div className="h-1.5 w-24 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "fill-slate-700 text-slate-700"}`}
        />
      ))}
    </span>
  );
}

export default function MarketingPage({ activeSub, onSubChange }: MarketingPageProps) {
  const [emails, setEmails] = useState<EmailCampaign[]>(initialEmailCampaigns);
  const [promos, setPromos] = useState<PromoCode[]>(initialPromoCodes);
  const [sovgalar, setSovgalar] = useState<GiftPromotion[]>(initialGiftPromotions);
  const [sources, setSources] = useState<MarketingSource[]>(initialSources);
  const [smsList, setSmsList] = useState<SmsCampaign[]>(initialSmsCampaigns);
  const [posts, setPosts] = useState<ChannelPost[]>(initialChannelPosts);
  const [banners, setBanners] = useState<MarketingBanner[]>(initialBanners);
  const [reviews] = useState<ProductReview[]>(initialReviews);
  const [loyaltyRules] = useState<LoyaltyRule[]>(initialLoyaltyRules);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>(initialLoyaltySettings);
  const [giveaways, setGiveaways] = useState<GiveawayContest[]>(initialGiveaways);
  const [transactions] = useState<LoyaltyTransaction[]>(initialTransactions);

  const [pageMode, setPageMode] = useState<PageMode>("list");
  const [editTarget, setEditTarget] = useState<EditTarget>({ kind: "none" });
  const [search, setSearch] = useState("");
  const [, setStatusFilter] = useState<string>("all");
  const [pendingDelete, setPendingDelete] = useState<DeleteState>({ kind: "none" });
  const [, setFormError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalSent = emails.reduce((s, e) => s + e.sent, 0);
    const totalOpened = emails.reduce((s, e) => s + e.opened, 0);
    const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0";
    return {
      activePromos: promos.filter((p) => p.active).length,
      pendingReviews: reviews.filter((r) => r.status === "pending").length,
      emailOpenRate: openRate,
      smsSent: smsList.filter((s) => s.status === "sent").length,
      activeBanners: banners.filter((b) => b.active).length,
      totalConversions: sources.reduce((s, src) => s + src.conversions, 0),
      activeGiveaways: giveaways.filter((g) => g.status === "active").length,
      totalPoints: transactions.reduce((s, t) => s + (t.type === "earn" ? t.points : -t.points), 0),
    };
  }, [emails, promos, reviews, smsList, banners, sources, giveaways, transactions]);

  const q = search.trim().toLowerCase();

  const handleSubChange = (sub: MarketingSub) => {
    setStatusFilter("all");
    setSearch("");
    setPageMode("list");
    onSubChange(sub);
  };

  // List view tables
  const tabIcons: Record<MarketingSub, React.ElementType> = {
    rassilka: Mail,
    promokod: Tag,
    sovgalar: Gift,
    manbalar: Share2,
    sms: MessageSquare,
    kanal: Send,
    banner: ImageIcon,
    sharhlar: Star,
    sodiqlik: Award,
    giveaway: Trophy,
    tranzaksiyalar: ArrowLeftRight,
  };

  // If in edit/create mode, show full-page form
  if (pageMode !== "list") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <button
            onClick={() => { setPageMode("list"); setEditTarget({ kind: "none" }); setFormError(null); }}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {editTarget.kind === "email" && (editTarget.item ? "Email tahrirlash" : "Yangi email kampaniya")}
              {editTarget.kind === "promo" && (editTarget.item ? "Promo tahrirlash" : "Yangi promokod")}
              {editTarget.kind === "sovga" && (editTarget.item ? "Sovg'a tahrirlash" : "Yangi sovg'a")}
              {editTarget.kind === "sms" && (editTarget.item ? "SMS tahrirlash" : "Yangi SMS kampaniya")}
              {editTarget.kind === "channel" && (editTarget.item ? "Post tahrirlash" : "Yangi post")}
              {editTarget.kind === "banner" && (editTarget.item ? "Banner tahrirlash" : "Yangi banner")}
              {editTarget.kind === "giveaway" && (editTarget.item ? "Giveaway tahrirlash" : "Yangi giveaway")}
              {editTarget.kind === "rule" && (editTarget.item ? "Rule tahrirlash" : "Yangi rule")}
            </h1>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => { setPageMode("list"); setEditTarget({ kind: "none" }); }}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
            >
              Bekor
            </button>
            <button
              onClick={() => handleCreateEdit()}
              className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              Saqlash
            </button>
          </div>
        </div>

        {/* Form content */}
        {editTarget.kind === "email" && (
          <EmailEditForm
            initial={editTarget.item}
            onSave={(data) => {
              if (editTarget.item) {
                setEmails((prev) => prev.map((e) => (e.id === editTarget.item!.id ? { ...e, ...data } : e)));
              } else {
                setEmails((prev) => [{ ...data, id: newId("em"), sent: 0, opened: 0, clicks: 0, createdAt: new Date().toISOString().slice(0, 10) }, ...prev]);
              }
              setPageMode("list");
              setEditTarget({ kind: "none" });
            }}
            setError={setFormError}
          />
        )}
      </motion.div>
    );
  }

  // List mode
  return (
    <div className="space-y-6">
      {/* Header stats */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-emerald-400" />
            Marketing
          </h1>
          <p className="text-sm text-slate-500 mt-1">Barcha marketing kampaniyalarini bitta joydan boshqaring</p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Email ochilish</p>
            <p className="text-lg font-semibold text-emerald-400">{stats.emailOpenRate}%</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Aktiv promo</p>
            <p className="text-lg font-semibold text-white">{stats.activePromos}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Giveaway</p>
            <p className="text-lg font-semibold text-white">{stats.activeGiveaways}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Ballar</p>
            <p className="text-lg font-semibold text-white">{stats.totalPoints}</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {marketingSubOrder.map((sub) => {
          const Icon = tabIcons[sub];
          const active = activeSub === sub;
          return (
            <button
              key={sub}
              type="button"
              onClick={() => handleSubChange(sub)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all whitespace-nowrap ${pillClass(active)}`}
            >
              <Icon className="w-4 h-4" />
              {marketingSubLabels[sub]}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish..."
            className={inputClass + " pl-10"}
          />
        </div>
        <button
          type="button"
          onClick={() => { setPageMode("create"); setEditTarget(getCreateTarget(activeSub)); setFormError(null); }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Yangi qo'shish
        </button>
      </div>

      {/* Content - based on active section */}
      <AnimatePresence mode="wait">
        {activeSub === "rassilka" && <EmailListView emails={emails} onEdit={startEdit} onDelete={startDelete} search={q} />}
        {activeSub === "promokod" && <PromoListView promos={promos} onEdit={startEdit} onDelete={startDelete} search={q} />}
        {activeSub === "sovgalar" && <SovgalarListView sovgalar={sovgalar} onEdit={startEdit} onDelete={startDelete} search={q} />}
        {activeSub === "manbalar" && <ManbaListView sources={sources} onEdit={startEdit} onDelete={startDelete} search={q} />}
        {activeSub === "sms" && <SmsListView sms={smsList} onEdit={startEdit} onDelete={startDelete} search={q} />}
        {activeSub === "kanal" && <KanalListView posts={posts} onEdit={startEdit} onDelete={startDelete} search={q} />}
        {activeSub === "banner" && <BannerListView banners={banners} onEdit={startEdit} onDelete={startDelete} search={q} />}
        {activeSub === "sharhlar" && <ReviewListView reviews={reviews} onEdit={startEdit} onDelete={startDelete} search={q} />}
        {activeSub === "sodiqlik" && <LoyaltyView rules={loyaltyRules} settings={loyaltySettings} onEditRule={startEdit} onUpdateSettings={handleUpdateLoyaltySettings} />}
        {activeSub === "giveaway" && <GiveawayListView giveaways={giveaways} onEdit={startEdit} onDelete={startDelete} search={q} />}
        {activeSub === "tranzaksiyalar" && <TransactionListView transactions={transactions} />}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {pendingDelete.kind !== "none" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70"
            onClick={() => setPendingDelete({ kind: "none" })}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Trash className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-white font-medium">O'chirishni tasdiqlang</p>
              </div>
              <p className="text-sm text-slate-400 mb-6">Bu amalni qaytarib bo'lmaydi.</p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                  onClick={() => setPendingDelete({ kind: "none" })}
                >
                  Bekor
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-medium"
                  onClick={() => handleConfirmDelete()}
                >
                  O'chirish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Helper functions
  function startEdit(kind: string, item: any) {
    setEditTarget({ kind, item } as EditTarget);
    setPageMode("edit");
    setFormError(null);
  }

  function startDelete(kind: string, id: string) {
    setPendingDelete({ kind, id } as DeleteState);
  }

  function getCreateTarget(sub: MarketingSub): EditTarget {
    const map: Record<MarketingSub, EditTarget> = {
      rassilka: { kind: "email", item: null },
      promokod: { kind: "promo", item: null },
      sovgalar: { kind: "sovga", item: null },
      manbalar: { kind: "source", item: null },
      sms: { kind: "sms", item: null },
      kanal: { kind: "channel", item: null },
      banner: { kind: "banner", item: null },
      sharhlar: { kind: "none" },
      sodiqlik: { kind: "rule", item: null },
      giveaway: { kind: "giveaway", item: null },
      tranzaksiyalar: { kind: "none" },
    };
    return map[sub];
  }

  function handleCreateEdit() {
    if (editTarget.kind === "email") {
      setPageMode("list");
    }
  }

  function handleConfirmDelete() {
    const d = pendingDelete;
    if (d.kind === "email") setEmails((prev) => prev.filter((x) => x.id !== d.id));
    if (d.kind === "promo") setPromos((prev) => prev.filter((x) => x.id !== d.id));
    if (d.kind === "sovga") setSovgalar((prev) => prev.filter((x) => x.id !== d.id));
    if (d.kind === "source") setSources((prev) => prev.filter((x) => x.id !== d.id));
    if (d.kind === "sms") setSmsList((prev) => prev.filter((x) => x.id !== d.id));
    if (d.kind === "channel") setPosts((prev) => prev.filter((x) => x.id !== d.id));
    if (d.kind === "banner") setBanners((prev) => prev.filter((x) => x.id !== d.id));
    if (d.kind === "giveaway") setGiveaways((prev) => prev.filter((x) => x.id !== d.id));
    setPendingDelete({ kind: "none" });
  }

  function handleUpdateLoyaltySettings(settings: LoyaltySettings) {
    setLoyaltySettings(settings);
  }

}

// List view components (simplified for space)
function EmailListView({ emails, onEdit, onDelete, search }: any) {
  const filtered = emails.filter((e: any) => !search || e.name.toLowerCase().includes(search) || e.subject.toLowerCase().includes(search));
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <table className="w-full min-w-[800px]">
        <thead className="bg-slate-900/80">
          <tr>
            <th className={thClass}>Kampaniya</th>
            <th className={thClass}>Segment</th>
            <th className={thClass}>Holat</th>
            <th className={thClass}>Reja</th>
            <th className={thClass}>Yuborilgan</th>
            <th className={thClass}>Ochilish %</th>
            <th className={`${thClass} text-right`}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((e: any) => (
            <tr key={e.id} className="hover:bg-slate-800/40">
              <td className={tdClass + " font-medium"}>{e.name}</td>
              <td className={tdClass}>{e.segment}</td>
              <td className={tdClass}><EmailStatusBadge status={e.status} /></td>
              <td className={tdClass + " text-xs text-slate-400"}>{e.scheduledAt}</td>
              <td className={tdClass}>{e.sent.toLocaleString()}</td>
              <td className={tdClass + " text-xs"}>{e.sent > 0 ? ((e.opened / e.sent) * 100).toFixed(1) : "—"}%</td>
              <td className={tdClass + " text-right whitespace-nowrap"}>
                <button onClick={() => onEdit("email", e)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => onDelete("email", e.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Ma'lumot topilmadi</div>}
    </motion.div>
  );
}

function PromoListView({ promos, onEdit, onDelete, search }: any) {
  const filtered = promos.filter((p: any) => !search || p.code.toLowerCase().includes(search));
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <table className="w-full min-w-[800px]">
        <thead className="bg-slate-900/80">
          <tr>
            <th className={thClass}>Kod</th>
            <th className={thClass}>Chegirma</th>
            <th className={thClass}>Min. buyurtma</th>
            <th className={thClass}>Ishlatish</th>
            <th className={thClass}>Amal qilish</th>
            <th className={thClass}>Holat</th>
            <th className={`${thClass} text-right`}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p: any) => {
            const expired = p.validTo < new Date().toISOString().slice(0, 10);
            return (
              <tr key={p.id} className="hover:bg-slate-800/40">
                <td className={tdClass}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-emerald-400">{p.code}</span>
                    <CopyButton text={p.code} />
                  </div>
                </td>
                <td className={tdClass}>{p.discountType === "percent" ? `${p.value}%` : `${p.value.toLocaleString()} so'm`}</td>
                <td className={tdClass}>{p.minOrder.toLocaleString()}</td>
                <td className={tdClass}><UsageBar used={p.usedCount} max={p.maxUses} /></td>
                <td className={tdClass + " text-xs text-slate-400"}>{p.validFrom} — {p.validTo}</td>
                <td className={tdClass}><span className={`text-xs px-2 py-0.5 rounded-full ${p.active ? (expired ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400") : "bg-slate-800 text-slate-500"}`}>{expired ? "Muddati o'tgan" : (p.active ? "Aktiv" : "O'chirilgan")}</span></td>
                <td className={tdClass + " text-right whitespace-nowrap"}>
                  <button onClick={() => onEdit("promo", p)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => onDelete("promo", p.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Ma'lumot topilmadi</div>}
    </motion.div>
  );
}

function SovgalarListView({ sovgalar, onEdit, onDelete, search }: any) {
  const filtered = sovgalar.filter((s: any) => !search || s.name.toLowerCase().includes(search));
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <table className="w-full min-w-[800px]">
        <thead className="bg-slate-900/80">
          <tr>
            <th className={thClass}>Sovg'a nomi</th>
            <th className={thClass}>Shart</th>
            <th className={thClass}>Sovg'a</th>
            <th className={thClass}>Ishlatish</th>
            <th className={thClass}>Amal qilish</th>
            <th className={thClass}>Holat</th>
            <th className={`${thClass} text-right`}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s: any) => (
            <tr key={s.id} className="hover:bg-slate-800/40">
              <td className={tdClass + " font-medium"}>{s.name}</td>
              <td className={tdClass + " text-xs"}>{s.conditionType === "quantity" ? `${s.conditionValue} ta` : `${s.conditionValue.toLocaleString()} so'm`}</td>
              <td className={tdClass + " text-xs text-slate-400"}>{s.giftDescription}</td>
              <td className={tdClass}><UsageBar used={s.usedCount} max={s.usageLimit || 999} /></td>
              <td className={tdClass + " text-xs text-slate-400"}>{s.startAt} — {s.endAt}</td>
              <td className={tdClass}>{s.active ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Aktiv</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">O'chirilgan</span>}</td>
              <td className={tdClass + " text-right whitespace-nowrap"}>
                <button onClick={() => onEdit("sovga", s)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => onDelete("sovga", s.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Ma'lumot topilmadi</div>}
    </motion.div>
  );
}

function ManbaListView({ sources, onEdit, onDelete, search }: any) {
  const filtered = sources.filter((s: any) => !search || s.name.toLowerCase().includes(search));
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <table className="w-full min-w-[800px]">
        <thead className="bg-slate-900/80">
          <tr>
            <th className={thClass}>Manba</th>
            <th className={thClass}>Kanal</th>
            <th className={thClass}>Oylik byudjet</th>
            <th className={thClass}>Konversiya</th>
            <th className={thClass}>CPC</th>
            <th className={`${thClass} text-right`}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s: any) => {
            const cpc = s.conversions > 0 && s.spendMonthly > 0 ? Math.round(s.spendMonthly / s.conversions).toLocaleString() : "—";
            return (
              <tr key={s.id} className="hover:bg-slate-800/40">
                <td className={tdClass + " font-medium"}>{s.name}</td>
                <td className={tdClass}>{s.channel}</td>
                <td className={tdClass}>{s.spendMonthly > 0 ? `${s.spendMonthly.toLocaleString()} so'm` : "Bepul"}</td>
                <td className={tdClass}>{s.conversions.toLocaleString()}</td>
                <td className={tdClass + " text-xs"}>{cpc === "—" ? "—" : `${cpc} so'm`}</td>
                <td className={tdClass + " text-right whitespace-nowrap"}>
                  <button onClick={() => onEdit("source", s)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => onDelete("source", s.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Ma'lumot topilmadi</div>}
    </motion.div>
  );
}

function SmsListView({ sms, onEdit, onDelete, search }: any) {
  const filtered = sms.filter((s: any) => !search || s.name.toLowerCase().includes(search));
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <table className="w-full min-w-[800px]">
        <thead className="bg-slate-900/80">
          <tr>
            <th className={thClass}>Kampaniya</th>
            <th className={thClass}>Matn</th>
            <th className={thClass}>Qabul qiluvchilar</th>
            <th className={thClass}>Holat</th>
            <th className={thClass}>Reja</th>
            <th className={thClass}>Yetkazish</th>
            <th className={`${thClass} text-right`}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s: any) => {
            const smsCount = Math.ceil(s.message.length / 160);
            return (
              <tr key={s.id} className="hover:bg-slate-800/40">
                <td className={tdClass + " font-medium"}>{s.name}</td>
                <td className={tdClass + " max-w-[200px]"}>
                  <p className="text-xs text-slate-400 truncate">{s.message}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{smsCount} SMS</p>
                </td>
                <td className={tdClass}>{s.recipients.toLocaleString()}</td>
                <td className={tdClass}><SmsStatusBadge status={s.status} /></td>
                <td className={tdClass + " text-xs text-slate-400"}>{s.scheduledAt}</td>
                <td className={tdClass + " text-xs"}>{s.sent > 0 ? `${s.delivered}/${s.sent}` : "—"}</td>
                <td className={tdClass + " text-right whitespace-nowrap"}>
                  <button onClick={() => onEdit("sms", s)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => onDelete("sms", s.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Ma'lumot topilmadi</div>}
    </motion.div>
  );
}

function KanalListView({ posts, onEdit, onDelete, search }: any) {
  const filtered = posts.filter((p: any) => !search || p.title.toLowerCase().includes(search));
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <table className="w-full min-w-[800px]">
        <thead className="bg-slate-900/80">
          <tr>
            <th className={thClass}>Platforma</th>
            <th className={thClass}>Sarlavha</th>
            <th className={thClass}>Chop etish</th>
            <th className={thClass}>Holat</th>
            <th className={thClass}>Qamrov</th>
            <th className={`${thClass} text-right`}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p: any) => (
            <tr key={p.id} className="hover:bg-slate-800/40">
              <td className={tdClass}><span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{channelPlatformLabels[p.platform as ChannelPlatform]}</span></td>
              <td className={tdClass + " font-medium max-w-[200px] truncate"}>{p.title}</td>
              <td className={tdClass + " text-xs text-slate-400"}>{p.scheduledAt}</td>
              <td className={tdClass}><PostStatusBadge status={p.status} /></td>
              <td className={tdClass}>{p.reach > 0 ? p.reach.toLocaleString() : "—"}</td>
              <td className={tdClass + " text-right whitespace-nowrap"}>
                {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="p-1.5 rounded text-slate-400 hover:text-emerald-400 inline-flex"><ExternalLink className="w-4 h-4" /></a>}
                <button onClick={() => onEdit("channel", p)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => onDelete("channel", p.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Ma'lumot topilmadi</div>}
    </motion.div>
  );
}

function BannerListView({ banners, onEdit, onDelete, search }: any) {
  const filtered = banners.filter((b: any) => !search || b.title.toLowerCase().includes(search));
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <table className="w-full min-w-[800px]">
        <thead className="bg-slate-900/80">
          <tr>
            <th className={thClass}>Banner</th>
            <th className={thClass}>Joylashuv</th>
            <th className={thClass}>Ko'rinish</th>
            <th className={thClass}>CTR</th>
            <th className={thClass}>Muddat</th>
            <th className={`${thClass} text-right`}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((b: any) => {
            const ctr = b.impressions > 0 ? ((b.clicks / b.impressions) * 100).toFixed(2) : "0";
            return (
              <tr key={b.id} className="hover:bg-slate-800/40">
                <td className={tdClass}><div className="flex items-center gap-2"><img src={b.imageUrl} alt="" className="w-12 h-8 object-cover rounded border border-slate-700" /><span className="font-medium">{b.title}</span></div></td>
                <td className={tdClass + " text-xs"}>{bannerPlacementLabels[b.placement as BannerPlacement]}</td>
                <td className={tdClass}>{b.impressions.toLocaleString()}</td>
                <td className={tdClass}>{ctr}%</td>
                <td className={tdClass + " text-xs text-slate-400"}>{b.startAt} — {b.endAt}</td>
                <td className={tdClass + " text-right whitespace-nowrap"}>
                  <button onClick={() => onEdit("banner", b)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => onDelete("banner", b.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Ma'lumot topilmadi</div>}
    </motion.div>
  );
}

function ReviewListView({ reviews, onEdit, onDelete, search }: any) {
  const filtered = reviews.filter((r: any) => !search || r.customerName.toLowerCase().includes(search) || r.productName.toLowerCase().includes(search));
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <table className="w-full min-w-[800px]">
        <thead className="bg-slate-900/80">
          <tr>
            <th className={thClass}>Mijoz</th>
            <th className={thClass}>Mahsulot</th>
            <th className={thClass}>Baho</th>
            <th className={thClass}>Sharh</th>
            <th className={thClass}>Holat</th>
            <th className={thClass}>Sana</th>
            <th className={`${thClass} text-right`}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r: any) => (
            <tr key={r.id} className="hover:bg-slate-800/40">
              <td className={tdClass + " font-medium"}>{r.customerName}</td>
              <td className={tdClass}>{r.productName}</td>
              <td className={tdClass}><StarRating rating={r.rating} /></td>
              <td className={tdClass + " max-w-[200px]"}><p className="text-xs text-slate-400 line-clamp-2">{r.text}</p></td>
              <td className={tdClass}><ReviewStatusBadge status={r.status} /></td>
              <td className={tdClass + " text-xs text-slate-500"}>{r.createdAt}</td>
              <td className={tdClass + " text-right whitespace-nowrap"}>
                {r.status === "pending" && <>
                  <button className="p-1.5 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-800"><CheckCircle className="w-4 h-4" /></button>
                  <button className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><XCircle className="w-4 h-4" /></button>
                </>}
                <button onClick={() => onEdit("review", r)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => onDelete("review", r.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Ma'lumot topilmadi</div>}
    </motion.div>
  );
}

function LoyaltyView({ rules, settings, onEditRule, onUpdateSettings }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Sodiqlik dasturi sozlamalari</h3>
            <p className="text-sm text-slate-400 mt-1">Ballar tizimini boshqaring va qaydlarini o'rnating</p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-6 h-6 rounded-full ${settings.enabled ? "bg-emerald-500" : "bg-slate-600"}`} />
            <span className="text-sm text-slate-300">{settings.enabled ? "Faol" : "O'chirilgan"}</span>
          </label>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-400 block mb-1.5">1 ball qiymati (so'm)</label>
            <input type="number" value={settings.pointValue} className="w-full sm:w-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" onChange={(e) => onUpdateSettings({ ...settings, pointValue: Number(e.target.value) })} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {rules.map((rule: any) => (
          <div key={rule.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-white">{rule.name}</h4>
              <p className="text-sm text-slate-400 mt-1">{rule.description}</p>
              <p className="text-sm text-emerald-400 mt-2">{rule.pointsValue} ball</p>
            </div>
            <div className="flex gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${rule.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>{rule.active ? "Aktiv" : "O'chirilgan"}</span>
              <button onClick={() => onEditRule("rule", rule)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function GiveawayListView({ giveaways, onEdit, onDelete, search }: any) {
  const filtered = giveaways.filter((g: any) => !search || g.title.toLowerCase().includes(search));
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <table className="w-full min-w-[800px]">
        <thead className="bg-slate-900/80">
          <tr>
            <th className={thClass}>Giveaway</th>
            <th className={thClass}>Sovrin turi</th>
            <th className={thClass}>Sovrinlar soni</th>
            <th className={thClass}>Ishtirokchilar</th>
            <th className={thClass}>Tugash</th>
            <th className={thClass}>Holat</th>
            <th className={`${thClass} text-right`}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((g: any) => (
            <tr key={g.id} className="hover:bg-slate-800/40">
              <td className={tdClass + " font-medium"}>{g.title}</td>
              <td className={tdClass + " text-xs"}>{giveawayPrizeTypeLabels[g.prizeType as GiveawayPrizeType]}</td>
              <td className={tdClass}>{g.prizeCount}</td>
              <td className={tdClass}>{g.participantCount.toLocaleString()}</td>
              <td className={tdClass + " text-xs text-slate-400"}>{g.endAt}</td>
              <td className={tdClass}><GiveawayStatusBadge status={g.status} /></td>
              <td className={tdClass + " text-right whitespace-nowrap"}>
                <button onClick={() => onEdit("giveaway", g)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => onDelete("giveaway", g.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Ma'lumot topilmadi</div>}
    </motion.div>
  );
}

function TransactionListView({ transactions }: any) {
  const stats = {
    earned: transactions.filter((t: any) => t.type === "earn").reduce((s: number, t: any) => s + t.points, 0),
    spent: transactions.filter((t: any) => t.type === "spend").reduce((s: number, t: any) => s + t.points, 0),
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-400">Ball olindi</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">+{stats.earned.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-400">Ball sarflandi</p>
          <p className="text-2xl font-bold text-red-400 mt-1">-{stats.spent.toLocaleString()}</p>
        </div>
      </div>
      <button className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
        <Plus className="w-4 h-4 inline mr-2" />
        Qo'lda ball qo'shish
      </button>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <table className="w-full min-w-[800px]">
          <thead className="bg-slate-900/80">
            <tr>
              <th className={thClass}>Mijoz</th>
              <th className={thClass}>Turi</th>
              <th className={thClass}>Ballar</th>
              <th className={thClass}>Balans</th>
              <th className={thClass}>Tavsif</th>
              <th className={thClass}>Sana</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t: any) => (
              <tr key={t.id} className="hover:bg-slate-800/40">
                <td className={tdClass + " font-medium"}>{t.customerName}</td>
                <td className={tdClass}><TransactionTypeBadge type={t.type} /></td>
                <td className={tdClass + " font-medium"} style={{ color: t.type === "earn" ? "#34d399" : "#ef4444" }}>{t.type === "earn" ? "+" : ""}{t.points.toLocaleString()}</td>
                <td className={tdClass}>{t.balance.toLocaleString()}</td>
                <td className={tdClass + " text-sm text-slate-400"}>{t.description}</td>
                <td className={tdClass + " text-xs text-slate-500"}>{t.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function EmailEditForm({ initial, onSave, setError }: { initial: EmailCampaign | null; onSave: (data: any) => void; setError: (err: string | null) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [segment, setSegment] = useState(initial?.segment ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [status, setStatus] = useState<EmailCampaignStatus>(initial?.status ?? "draft");
  const [scheduledAt, setScheduledAt] = useState(initial?.scheduledAt ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !segment.trim()) {
      setError("Nomi, mavzu va segment majburiy.");
      return;
    }
    onSave({ name: name.trim(), subject: subject.trim(), segment: segment.trim(), body: body.trim(), status, scheduledAt: scheduledAt.trim() || "—" });
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Kampaniya sozlamalari</h3>
          <div>
            <label className={labelClass}>Kampaniya nomi</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Email mavzusu (Subject)</label>
            <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Segment</label>
            <input className={inputClass} value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Masalan: Faol xaridorlar" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Email matni</h3>
          <textarea className={inputClass + " min-h-[150px]"} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Email tanasi matnini kiriting..." />
          <p className="text-xs text-slate-500">{body.length} belgi</p>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Sozlamalar</h3>
          <div>
            <label className={labelClass}>Holat</label>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as EmailCampaignStatus)}>
              {(Object.keys(emailCampaignStatusLabels) as EmailCampaignStatus[]).map((k) => (
                <option key={k} value={k}>{emailCampaignStatusLabels[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Reja vaqti</label>
            <input className={inputClass} type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
        </div>
      </div>
    </form>
  );
}
