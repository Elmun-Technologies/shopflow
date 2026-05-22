import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight, ArrowLeft, User as UserIcon, ShoppingBag, Star, Ticket, Users,
  Globe, MapPin, MessageCircle, Phone, Calendar, Plus, Trash2, ChevronDown, Loader2, Send,
  Bell as BellIcon,
} from "lucide-react";
import { formatUzPhone } from "../../utils/phone";
import { useT } from "../../i18n";

type ProfileView =
  | "menu"
  | "info"
  | "orders"
  | "reviews"
  | "promocodes"
  | "referrals"
  | "language"
  | "addresses"
  | "notifications";

type Lang = "uz" | "ru";
type Gender = "male" | "female" | "";

interface ProfileData {
  firstName: string;
  lastName: string;
  patronymic: string;
  phone: string;
  birthDate: string; // YYYY-MM-DD
  gender: Gender;
}

interface NotificationPrefs {
  orderUpdates: boolean;
  cartAbandonment: boolean;
  promotions: boolean;
}

interface ReferralStats {
  invitedCount: number;
  withOrdersCount: number;
  invited: Array<{ id: string; displayName: string; createdAt: string; ordersCount: number }>;
}

interface Address {
  id: string;
  label: string;
  city: string;
  street: string;
  apartment?: string;
  notes?: string;
  isDefault?: boolean;
}

interface OrderItemView {
  id: string;
  qty: number;
  price: number;
  product: { id: string; name: string; imageUrl: string | null; sku: string };
}

interface CustomerOrder {
  id: string;
  code: string;
  status: string;
  total: number;
  currency: string;
  notes?: string | null;
  createdAt: string;
  items: OrderItemView[];
}

// Telegram WebApp — requestContact API uchun (mahalliy declaration)
type TwaContactResponse = { status: "sent" | "cancelled"; response?: { contact?: { phone_number?: string } } };
interface TwaApi {
  requestContact?: (cb: (ok: boolean, ev?: TwaContactResponse) => void) => void;
  HapticFeedback?: { impactOccurred?: (s: string) => void; notificationOccurred?: (t: string) => void };
}

interface ProfilePageProps {
  storeSlug: string;
  tenantName: string;
  telegramUser?: { userId?: number; username?: string; firstName?: string; lastName?: string };
  operatorTelegram?: string; // bot username for contact
  apiBase: string;
  // Tashqi ko'rsatuv — masalan, success screen'dan to'g'ridan-to'g'ri buyurtmalarga
  initialView?: ProfileView;
}

function lsKey(slug: string, key: string): string {
  return `shopflow:store:${slug}:${key}`;
}

function loadProfile(slug: string, tgUser?: ProfilePageProps["telegramUser"]): ProfileData {
  try {
    const raw = localStorage.getItem(lsKey(slug, "profile"));
    if (raw) return JSON.parse(raw) as ProfileData;
  } catch {
    // ignore
  }
  return {
    firstName: tgUser?.firstName ?? "",
    lastName: tgUser?.lastName ?? "",
    patronymic: "",
    phone: "",
    birthDate: "",
    gender: "",
  };
}

function loadLang(slug: string): Lang {
  try {
    const raw = localStorage.getItem(lsKey(slug, "lang"));
    if (raw === "uz" || raw === "ru") return raw;
  } catch {
    // ignore
  }
  return "uz";
}

function loadAddresses(slug: string): Address[] {
  try {
    const raw = localStorage.getItem(lsKey(slug, "addresses"));
    if (raw) return JSON.parse(raw) as Address[];
  } catch {
    // ignore
  }
  return [];
}

export function ProfilePage({ storeSlug, tenantName, telegramUser, operatorTelegram, apiBase, initialView }: ProfilePageProps) {
  const [view, setView] = useState<ProfileView>(initialView ?? "menu");
  const [profile, setProfile] = useState<ProfileData>(() => loadProfile(storeSlug, telegramUser));
  const [lang, setLang] = useState<Lang>(() => loadLang(storeSlug));
  const { t, setLang: setGlobalLang } = useT();
  const [addresses, setAddresses] = useState<Address[]>(() => loadAddresses(storeSlug));
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [notifyPrefs, setNotifyPrefs] = useState<NotificationPrefs>({
    orderUpdates: true,
    cartAbandonment: true,
    promotions: true,
  });
  const [referrals, setReferrals] = useState<ReferralStats | null>(null);

  const tgUserId = telegramUser?.userId;
  const isOnline = !!tgUserId;
  const profileUrl = `${apiBase}/storefront/${encodeURIComponent(storeSlug)}/profile`;
  const addressesUrl = `${apiBase}/storefront/${encodeURIComponent(storeSlug)}/addresses`;

  // Serverdan profilni va manzillarni yuklash (telegramUser bo'lsa)
  useEffect(() => {
    if (!isOnline || profileLoaded) return;
    const params = new URLSearchParams({
      tgUserId: String(tgUserId),
      ...(telegramUser?.firstName && { firstName: telegramUser.firstName }),
      ...(telegramUser?.lastName && { lastName: telegramUser.lastName }),
      ...(telegramUser?.username && { username: telegramUser.username }),
    });
    fetch(`${profileUrl}?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { customer: Partial<ProfileData> & { firstName: string | null; lastName: string | null; patronymic: string | null; phone: string | null; birthDate: string | null; gender: string | null; language?: string; notifyOrderUpdates?: boolean; notifyCartAbandonment?: boolean; notifyPromotions?: boolean }; addresses: Address[] }) => {
        const c = data.customer;
        const next: ProfileData = {
          firstName: c.firstName ?? "",
          lastName: c.lastName ?? "",
          patronymic: c.patronymic ?? "",
          phone: c.phone ? formatUzPhone(c.phone) : "",
          birthDate: c.birthDate ?? "",
          gender: (c.gender === "male" || c.gender === "female") ? c.gender : "",
        };
        setProfile(next);
        try { localStorage.setItem(lsKey(storeSlug, "profile"), JSON.stringify(next)); } catch { /* ignore */ }
        if (c.language === "uz" || c.language === "ru") {
          setLang(c.language);
          try { localStorage.setItem(lsKey(storeSlug, "lang"), c.language); } catch { /* ignore */ }
        }
        setNotifyPrefs({
          orderUpdates: c.notifyOrderUpdates ?? true,
          cartAbandonment: c.notifyCartAbandonment ?? true,
          promotions: c.notifyPromotions ?? true,
        });
        const serverAddrs = (data.addresses ?? []).map((a) => ({
          id: a.id, label: a.label, city: a.city ?? "", street: a.street,
          apartment: a.apartment ?? "", notes: a.notes ?? "", isDefault: a.isDefault,
        }));
        setAddresses(serverAddrs);
        try { localStorage.setItem(lsKey(storeSlug, "addresses"), JSON.stringify(serverAddrs)); } catch { /* ignore */ }
      })
      .catch(() => { /* offline fallback — localStorage allaqachon yuklangan */ })
      .finally(() => setProfileLoaded(true));
  }, [isOnline, profileLoaded, tgUserId, profileUrl, telegramUser, storeSlug]);

  // Save handlers — server PATCH + localStorage cache
  const saveProfile = useCallback(async (next: ProfileData) => {
    setProfile(next);
    try { localStorage.setItem(lsKey(storeSlug, "profile"), JSON.stringify(next)); } catch { /* ignore */ }
    if (!isOnline) return;
    try {
      await fetch(profileUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tgUserId,
          firstName: next.firstName || null,
          lastName: next.lastName || null,
          patronymic: next.patronymic || null,
          phone: next.phone ? next.phone.replace(/\D/g, "") : null,
          birthDate: next.birthDate || null,
          gender: next.gender || null,
        }),
      });
    } catch {
      // Tarmoq xatosi — localStorage'da saqlandi
    }
  }, [storeSlug, isOnline, profileUrl, tgUserId]);

  // Notification preferences saqlash — har bir toggle alohida PATCH
  const saveNotifyPref = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
    setNotifyPrefs((prev) => ({ ...prev, [key]: value }));
    if (!isOnline) return;
    const fieldMap = {
      orderUpdates: "notifyOrderUpdates",
      cartAbandonment: "notifyCartAbandonment",
      promotions: "notifyPromotions",
    } as const;
    try {
      await fetch(profileUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tgUserId, [fieldMap[key]]: value }),
      });
    } catch { /* offline */ }
  }, [isOnline, profileUrl, tgUserId]);

  const saveLang = useCallback(async (next: Lang) => {
    setLang(next);
    setGlobalLang(next); // i18n context'ni ham yangilash — butun UI darhol almashadi
    try { localStorage.setItem(lsKey(storeSlug, "lang"), next); } catch { /* ignore */ }
    if (!isOnline) return;
    try {
      await fetch(profileUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tgUserId, language: next }),
      });
    } catch { /* offline cache only */ }
  }, [storeSlug, isOnline, profileUrl, tgUserId, setGlobalLang]);

  // Manzillar — server CRUD bilan
  const addAddress = useCallback(async (draft: Omit<Address, "id">) => {
    if (!isOnline) {
      const local: Address = { ...draft, id: `addr-${Date.now()}` };
      const next = [...addresses, local];
      setAddresses(next);
      try { localStorage.setItem(lsKey(storeSlug, "addresses"), JSON.stringify(next)); } catch { /* ignore */ }
      return;
    }
    try {
      const res = await fetch(addressesUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tgUserId,
          label: draft.label,
          city: draft.city || null,
          street: draft.street,
          apartment: draft.apartment || null,
          notes: draft.notes || null,
          isDefault: draft.isDefault ?? false,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { address: Address };
      const next = [...addresses, {
        id: json.address.id, label: json.address.label, city: json.address.city ?? "",
        street: json.address.street, apartment: json.address.apartment ?? "",
        notes: json.address.notes ?? "", isDefault: json.address.isDefault,
      }];
      setAddresses(next);
      try { localStorage.setItem(lsKey(storeSlug, "addresses"), JSON.stringify(next)); } catch { /* ignore */ }
    } catch { /* show error in form ideally */ }
  }, [isOnline, addressesUrl, tgUserId, addresses, storeSlug]);

  const removeAddress = useCallback(async (id: string) => {
    const next = addresses.filter((x) => x.id !== id);
    setAddresses(next);
    try { localStorage.setItem(lsKey(storeSlug, "addresses"), JSON.stringify(next)); } catch { /* ignore */ }
    if (!isOnline || id.startsWith("addr-")) return; // localStorage IDsi server'da yo'q
    try {
      await fetch(`${addressesUrl}/${id}?tgUserId=${tgUserId}`, { method: "DELETE" });
    } catch { /* ignore */ }
  }, [addresses, isOnline, addressesUrl, tgUserId, storeSlug]);

  // Fetch orders when entering orders view
  useEffect(() => {
    if (view !== "orders" || orders !== null) return;
    if (!tgUserId) {
      setOrders([]);
      return;
    }
    setOrdersLoading(true);
    fetch(`${apiBase}/storefront/${encodeURIComponent(storeSlug)}/orders?tgUserId=${tgUserId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { orders: CustomerOrder[] }) => setOrders(data.orders ?? []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [view, orders, tgUserId, storeSlug, apiBase]);

  // Fetch referrals stats when entering referrals view
  useEffect(() => {
    if (view !== "referrals" || referrals !== null || !tgUserId) return;
    fetch(`${apiBase}/storefront/${encodeURIComponent(storeSlug)}/referrals?tgUserId=${tgUserId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { totals: { invitedCount: number; withOrdersCount: number }; invited: ReferralStats["invited"] }) => {
        setReferrals({
          invitedCount: data.totals.invitedCount,
          withOrdersCount: data.totals.withOrdersCount,
          invited: data.invited,
        });
      })
      .catch(() => setReferrals({ invitedCount: 0, withOrdersCount: 0, invited: [] }));
  }, [view, referrals, tgUserId, storeSlug, apiBase]);

  if (view === "menu") {
    return (
      <ProfileMenu
        profile={profile}
        tenantName={tenantName}
        onSelect={(v) => setView(v)}
        operatorTelegram={operatorTelegram}
      />
    );
  }

  return (
    <div className="pb-24">
      <SubHeader title={titleFor(view, t)} onBack={() => setView("menu")} />
      <div className="px-4 py-4">
        {view === "info" && <InfoForm profile={profile} onSave={saveProfile} isOnline={isOnline} />}
        {view === "orders" && <OrdersList orders={orders} loading={ordersLoading} />}
        {view === "reviews" && <PlaceholderTwoTab labelA="Baholanishi kutilmoqda" labelB="Barcha fikrlarim" />}
        {view === "promocodes" && <PromocodeForm storeSlug={storeSlug} />}
        {view === "referrals" && <ReferralsView telegramUser={telegramUser} stats={referrals} />}
        {view === "language" && <LanguagePicker lang={lang} onChange={saveLang} />}
        {view === "addresses" && <AddressesList addresses={addresses} onAdd={addAddress} onRemove={removeAddress} />}
        {view === "notifications" && <NotificationsView prefs={notifyPrefs} onChange={saveNotifyPref} isOnline={isOnline} />}
      </div>
    </div>
  );
}

function titleFor(v: ProfileView, t: (k: string) => string): string {
  switch (v) {
    case "info": return t("profile.info");
    case "orders": return t("profile.orders");
    case "reviews": return t("profile.reviews");
    case "promocodes": return t("profile.promo");
    case "referrals": return t("profile.referrals");
    case "language": return t("profile.language");
    case "addresses": return t("profile.addresses");
    case "notifications": return t("profile.notifications");
    default: return t("profile.title");
  }
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 px-3 py-3 flex items-center gap-2">
      <button
        onClick={onBack}
        className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
    </div>
  );
}

function ProfileMenu({
  profile,
  tenantName,
  onSelect,
  operatorTelegram,
}: {
  profile: ProfileData;
  tenantName: string;
  onSelect: (v: ProfileView) => void;
  operatorTelegram?: string;
}) {
  const { t } = useT();
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || t("profile.guest");

  const items: Array<{ id: ProfileView; label: string; Icon: typeof UserIcon; sub?: string }> = [
    { id: "info", label: t("profile.info"), Icon: UserIcon, sub: profile.phone || t("profile.notFilled") },
    { id: "orders", label: t("profile.orders"), Icon: ShoppingBag },
    { id: "addresses", label: t("profile.addresses"), Icon: MapPin },
    { id: "notifications", label: t("profile.notifications"), Icon: BellIcon },
    { id: "referrals", label: t("profile.referrals"), Icon: Users },
    { id: "reviews", label: t("profile.reviews"), Icon: Star },
    { id: "promocodes", label: t("profile.promo"), Icon: Ticket },
    { id: "language", label: t("profile.language"), Icon: Globe, sub: "uz/ru" },
  ];

  return (
    <div className="pb-24">
      {/* Avatar header */}
      <div className="px-4 pt-6 pb-4 bg-gradient-to-b from-emerald-50 to-transparent dark:from-emerald-900/20">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl font-semibold">
            {(displayName[0] || "M").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold text-slate-900 dark:text-white truncate">{displayName}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{tenantName}</div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="px-4 mt-2 space-y-1">
        {items.map(({ id, label, Icon, sub }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="w-full flex items-center gap-3 px-3 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4.5 h-4.5" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white">{label}</div>
              {sub && <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{sub}</div>}
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </button>
        ))}

        {/* Operator — alohida (tashqi link Telegram'ga) */}
        {operatorTelegram && (
          <a
            href={`https://t.me/${operatorTelegram.replace(/^@/, "")}`}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 px-3 py-3 mt-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-left hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4.5 h-4.5" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-emerald-900 dark:text-emerald-100">{t("profile.contactOperator")}</div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-300 truncate">{t("profile.contactOperatorSub")}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          </a>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", icon: Icon,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; icon?: typeof UserIcon;
}) {
  return (
    <label className="block">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 ${
            Icon ? "pl-9 pr-3" : "px-3"
          }`}
        />
      </div>
    </label>
  );
}

function InfoForm({ profile, onSave, isOnline }: { profile: ProfileData; onSave: (p: ProfileData) => void | Promise<void>; isOnline: boolean }) {
  const [draft, setDraft] = useState<ProfileData>(profile);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);

  // Profil tashqi (server) yangilanishlardan keyin draft'ni sinxronlash
  useEffect(() => { setDraft(profile); }, [profile]);

  const requestContact = () => {
    const twa = (window as unknown as { Telegram?: { WebApp?: TwaApi } }).Telegram?.WebApp;
    if (!twa?.requestContact) {
      // Telegram'da bu API yo'q — foydalanuvchi qo'lda yozadi
      return;
    }
    setContactBusy(true);
    try {
      twa.requestContact((ok: boolean, ev?: TwaContactResponse) => {
        setContactBusy(false);
        if (!ok) return;
        const phoneRaw = ev?.response?.contact?.phone_number;
        if (phoneRaw) {
          setDraft((d) => ({ ...d, phone: formatUzPhone(phoneRaw) }));
          twa.HapticFeedback?.notificationOccurred?.("success");
        }
      });
    } catch {
      setContactBusy(false);
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave(draft);
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 1500);
        } finally {
          setSaving(false);
        }
      }}
    >
      <Field label="Ism" value={draft.firstName} onChange={(v) => setDraft({ ...draft, firstName: v })} />
      <Field label="Familiya" value={draft.lastName} onChange={(v) => setDraft({ ...draft, lastName: v })} />
      <Field label="Otasining ismi" value={draft.patronymic} onChange={(v) => setDraft({ ...draft, patronymic: v })} />
      <div className="space-y-1.5">
        <Field
          label="Telefon raqam"
          value={draft.phone}
          onChange={(v) => setDraft({ ...draft, phone: formatUzPhone(v) })}
          type="tel"
          icon={Phone}
        />
        <button
          type="button"
          onClick={requestContact}
          disabled={contactBusy}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/15 rounded-lg disabled:opacity-50 transition-colors"
        >
          {contactBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Telefonni Telegram'dan olish
        </button>
      </div>
      <Field
        label="Tug'ilgan kun"
        value={draft.birthDate}
        onChange={(v) => setDraft({ ...draft, birthDate: v })}
        type="date"
        icon={Calendar}
      />
      <div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Jins</div>
        <div className="grid grid-cols-2 gap-2">
          {(["male", "female"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setDraft({ ...draft, gender: g })}
              className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                draft.gender === g
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              }`}
            >
              {g === "male" ? "Erkak" : "Ayol"}
            </button>
          ))}
        </div>
      </div>
      {!isOnline && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
          ⓘ Telegram bot ichida ochilmagan — ma'lumotlar faqat shu qurilmada saqlanadi
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 mt-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedFlash ? "✓ Saqlandi" : "Saqlash"}
      </button>
    </form>
  );
}

function OrdersList({ orders, loading }: { orders: CustomerOrder[] | null; loading: boolean }) {
  const [tab, setTab] = useState<"active" | "all">("active");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda…</div>
    );
  }
  if (!orders) return null;
  const isActive = (o: CustomerOrder) => ["PENDING", "PROCESSING"].includes(o.status);
  const filtered = tab === "active" ? orders.filter(isActive) : orders;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
        <button
          onClick={() => setTab("active")}
          className={`py-2 text-xs font-medium rounded-lg ${
            tab === "active"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          Active ({orders.filter(isActive).length})
        </button>
        <button
          onClick={() => setTab("all")}
          className={`py-2 text-xs font-medium rounded-lg ${
            tab === "all"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          Barchasi ({orders.length})
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {tab === "active" ? "Aktiv buyurtmalar yo'q" : "Hali buyurtma yo'q"}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const isOpen = expanded.has(o.id);
            const currencyStr = o.currency === "UZS" ? "so'm" : o.currency;
            return (
              <div
                key={o.id}
                className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(o.id)}
                  className="w-full p-3 text-left active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">#{o.code}</div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={o.status} />
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(o.createdAt).toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{o.items.length} mahsulot</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {Number(o.total).toLocaleString("uz-UZ")} {currencyStr}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-3 bg-slate-50/60 dark:bg-slate-900/40">
                    <div className="space-y-2">
                      {o.items.map((it) => (
                        <div key={it.id} className="flex items-center gap-3">
                          {it.product.imageUrl ? (
                            <img
                              src={it.product.imageUrl}
                              alt={it.product.name}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-100 dark:bg-slate-800"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                              <ShoppingBag className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-900 dark:text-white truncate">{it.product.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {it.qty} × {Number(it.price).toLocaleString("uz-UZ")} {currencyStr}
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                            {(it.qty * Number(it.price)).toLocaleString("uz-UZ")}
                          </div>
                        </div>
                      ))}
                    </div>
                    {o.notes && (
                      <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Eslatma</div>
                        <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{o.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useT();
  const clsMap: Record<string, string> = {
    PENDING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    PROCESSING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    CANCELLED: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    REFUNDED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  };
  const label = t(`order.status.${status}`);
  const cls = clsMap[status] ?? "bg-slate-200 text-slate-700";
  // Agar kalit dictionary'da topilmasa, t() kalit'ning o'zini qaytaradi —
  // shu holatda raw status kodi ko'rinmasligi uchun fallback
  const safeLabel = label.startsWith("order.status.") ? status : label;
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls}`}>{safeLabel}</span>;
}

function PromocodeForm({ storeSlug }: { storeSlug: string }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  return (
    <div>
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-3">
        <label className="text-xs text-slate-500 dark:text-slate-400">Promokod</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="MASALAN: SALE2026"
          className="w-full mt-1 bg-transparent border-0 border-b border-slate-200 dark:border-slate-700 py-2 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
        />
        <button
          onClick={() => {
            if (!code.trim()) return;
            // MVP: server endpointi yo'q — localStorage'ga qo'shib qo'yamiz, tasdiq xato beradi
            try {
              const key = `shopflow:store:${storeSlug}:promocodes`;
              const list = JSON.parse(localStorage.getItem(key) || "[]") as string[];
              if (!list.includes(code.trim())) {
                list.push(code.trim());
                localStorage.setItem(key, JSON.stringify(list));
                setMsg({ kind: "ok", text: "Promokod saqlandi (checkout vaqtida qo'llaniladi)" });
              } else {
                setMsg({ kind: "err", text: "Bu promokod allaqachon kiritilgan" });
              }
            } catch {
              setMsg({ kind: "err", text: "Saqlashda xato" });
            }
            setCode("");
          }}
          className="w-full mt-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg"
        >
          Qo'llash
        </button>
        {msg && (
          <div className={`mt-3 text-xs ${msg.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}>
            {msg.text}
          </div>
        )}
      </div>
      <div className="py-8 text-center">
        <Ticket className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
        <div className="text-sm text-slate-500 dark:text-slate-400">Hali faol promokod yo'q</div>
      </div>
    </div>
  );
}

function ReferralsView({ telegramUser, stats }: { telegramUser?: ProfilePageProps["telegramUser"]; stats: ReferralStats | null }) {
  const refLink = telegramUser?.userId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${window.location.pathname}?ref=${telegramUser.userId}`
    : "";
  const [copied, setCopied] = useState(false);

  const copyRef = () => {
    if (!refLink) return;
    navigator.clipboard?.writeText(refLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => null);
  };

  return (
    <div>
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 mb-3">
        <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-1">
          Do'stlaringizni taklif qiling
        </div>
        <div className="text-xs text-emerald-700 dark:text-emerald-300">
          Havolani ulashing — do'stingiz Mini App'ni ochganida ro'yxat sizga bog'lanadi
        </div>
      </div>

      {/* Statistika kartochkalari */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.invitedCount}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Taklif qilingan</div>
          </div>
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.withOrdersCount}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Buyurtma qildi</div>
          </div>
        </div>
      )}

      {refLink && (
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3 mb-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sizning referal havolangiz</div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={refLink}
              className="flex-1 bg-transparent text-xs text-slate-700 dark:text-slate-200 truncate focus:outline-none"
            />
            <button
              onClick={copyRef}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
            >
              {copied ? "✓ Nusxa olindi" : "Nusxa"}
            </button>
          </div>
        </div>
      )}

      {/* Taklif qilinganlar ro'yxati */}
      {stats && stats.invited.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 px-1 mb-1.5">Taklif qilinganlar</div>
          {stats.invited.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                {(r.displayName[0] || "M").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{r.displayName}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {new Date(r.createdAt).toLocaleDateString("uz-UZ", { year: "numeric", month: "short", day: "numeric" })}
                </div>
              </div>
              {r.ordersCount > 0 ? (
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-1 rounded-full">
                  {r.ordersCount} buyurtma
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Yangi</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center">
          <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
          <div className="text-sm text-slate-500 dark:text-slate-400">Hali taklif qilingan do'stlar yo'q</div>
        </div>
      )}
    </div>
  );
}

function NotificationsView({
  prefs,
  onChange,
  isOnline,
}: {
  prefs: NotificationPrefs;
  onChange: (key: keyof NotificationPrefs, value: boolean) => void;
  isOnline: boolean;
}) {
  const items: Array<{ key: keyof NotificationPrefs; label: string; desc: string; emoji: string }> = [
    { key: "orderUpdates", label: "Buyurtma yangiliklari", desc: "Buyurtmangiz statusi o'zgarganda xabar", emoji: "📦" },
    { key: "cartAbandonment", label: "Savat eslatmalari", desc: "Savatingizda mahsulot qolsa, bir soatdan keyin eslatma", emoji: "🛒" },
    { key: "promotions", label: "Aksiyalar va chegirmalar", desc: "Yangi aksiyalar va maxsus takliflar", emoji: "🎁" },
  ];

  return (
    <div className="space-y-2">
      {!isOnline && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mb-2">
          ⓘ Telegram bot ichida ochilmagan — bildirishnoma sozlamalari faqat shu qurilmada saqlanadi
        </p>
      )}
      {items.map(({ key, label, desc, emoji }) => (
        <label
          key={key}
          className="flex items-start gap-3 px-3 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer active:bg-slate-50 dark:active:bg-slate-800"
        >
          <div className="text-xl flex-shrink-0">{emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-white">{label}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{desc}</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs[key]}
            onClick={(e) => {
              e.preventDefault();
              onChange(key, !prefs[key]);
            }}
            className={`flex-shrink-0 mt-0.5 w-10 h-6 rounded-full transition-colors relative ${
              prefs[key] ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                prefs[key] ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
        </label>
      ))}
    </div>
  );
}

function LanguagePicker({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const options: Array<{ id: Lang; label: string; flag: string }> = [
    { id: "uz", label: "O'zbekcha", flag: "🇺🇿" },
    { id: "ru", label: "Русский", flag: "🇷🇺" },
  ];
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
            lang === o.id
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"
              : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{o.flag}</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{o.label}</span>
          </div>
          {lang === o.id && (
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function AddressesList({ addresses, onAdd, onRemove }: { addresses: Address[]; onAdd: (a: Omit<Address, "id">) => Promise<void> | void; onRemove: (id: string) => Promise<void> | void }) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Omit<Address, "id">>({ label: "", city: "", street: "", apartment: "", notes: "" });

  if (adding) {
    return (
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onAdd(draft);
            setDraft({ label: "", city: "", street: "", apartment: "", notes: "" });
            setAdding(false);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nomi (uy / ish / ...)" value={draft.label} onChange={(v) => setDraft({ ...draft, label: v })} />
        <Field label="Shahar" value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} />
        <Field label="Ko'cha va uy raqami" value={draft.street} onChange={(v) => setDraft({ ...draft, street: v })} />
        <Field label="Kvartira / qavat" value={draft.apartment ?? ""} onChange={(v) => setDraft({ ...draft, apartment: v })} />
        <Field label="Eslatma (qo'shimcha)" value={draft.notes ?? ""} onChange={(v) => setDraft({ ...draft, notes: v })} />
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg"
          >
            Bekor
          </button>
          <button
            type="submit"
            disabled={busy || !draft.label.trim() || !draft.street.trim()}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Saqlash"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <button
        onClick={() => setAdding(true)}
        className="w-full mb-3 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600"
      >
        <Plus className="w-4 h-4" />
        Manzil qo'shish
      </button>
      {addresses.length === 0 ? (
        <div className="py-8 text-center">
          <MapPin className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
          <div className="text-sm text-slate-500 dark:text-slate-400">Saqlangan manzillar yo'q</div>
        </div>
      ) : (
        <div className="space-y-2">
          {addresses.map((a) => (
            <div key={a.id} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{a.label}</div>
                    {a.isDefault && (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded">
                        ASOSIY
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {a.city && `${a.city}, `}{a.street}
                    {a.apartment && `, ${a.apartment}`}
                  </div>
                  {a.notes && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{a.notes}</div>}
                </div>
                <button
                  onClick={() => onRemove(a.id)}
                  className="p-1.5 -mr-1 text-slate-400 hover:text-rose-500 rounded"
                  aria-label="O'chirish"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceholderTwoTab({ labelA, labelB }: { labelA: string; labelB: string }) {
  const [tab, setTab] = useState<"a" | "b">("a");
  return (
    <div>
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
        <button
          onClick={() => setTab("a")}
          className={`py-2 text-xs font-medium rounded-lg ${
            tab === "a" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {labelA}
        </button>
        <button
          onClick={() => setTab("b")}
          className={`py-2 text-xs font-medium rounded-lg ${
            tab === "b" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {labelB}
        </button>
      </div>
      <div className="py-12 text-center">
        <Star className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
        <div className="text-sm text-slate-500 dark:text-slate-400">Hech narsa yo'q</div>
      </div>
    </div>
  );
}
