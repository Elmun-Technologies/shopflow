import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight, ArrowLeft, User as UserIcon, ShoppingBag, Star, Ticket, Users,
  Globe, MapPin, MessageCircle, Phone, Calendar, Plus, Trash2,
} from "lucide-react";
import { formatUzPhone } from "../../utils/phone";

type ProfileView =
  | "menu"
  | "info"
  | "orders"
  | "reviews"
  | "promocodes"
  | "referrals"
  | "language"
  | "addresses";

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

interface Address {
  id: string;
  label: string;
  city: string;
  street: string;
  apartment?: string;
  notes?: string;
}

interface CustomerOrder {
  id: string;
  code: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  items: number;
}

interface ProfilePageProps {
  storeSlug: string;
  tenantName: string;
  telegramUser?: { userId?: number; username?: string; firstName?: string; lastName?: string };
  operatorTelegram?: string; // bot username for contact
  apiBase: string;
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

export function ProfilePage({ storeSlug, tenantName, telegramUser, operatorTelegram, apiBase }: ProfilePageProps) {
  const [view, setView] = useState<ProfileView>("menu");
  const [profile, setProfile] = useState<ProfileData>(() => loadProfile(storeSlug, telegramUser));
  const [lang, setLang] = useState<Lang>(() => loadLang(storeSlug));
  const [addresses, setAddresses] = useState<Address[]>(() => loadAddresses(storeSlug));
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Save handlers
  const saveProfile = useCallback((next: ProfileData) => {
    setProfile(next);
    try {
      localStorage.setItem(lsKey(storeSlug, "profile"), JSON.stringify(next));
    } catch {
      // ignore
    }
  }, [storeSlug]);

  const saveLang = useCallback((next: Lang) => {
    setLang(next);
    try {
      localStorage.setItem(lsKey(storeSlug, "lang"), next);
    } catch {
      // ignore
    }
  }, [storeSlug]);

  const saveAddresses = useCallback((next: Address[]) => {
    setAddresses(next);
    try {
      localStorage.setItem(lsKey(storeSlug, "addresses"), JSON.stringify(next));
    } catch {
      // ignore
    }
  }, [storeSlug]);

  // Fetch orders when entering orders view
  useEffect(() => {
    if (view !== "orders" || orders !== null) return;
    if (!telegramUser?.userId) {
      setOrders([]);
      return;
    }
    setOrdersLoading(true);
    fetch(`${apiBase}/storefront/${encodeURIComponent(storeSlug)}/orders?tgUserId=${telegramUser.userId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { orders: CustomerOrder[] }) => setOrders(data.orders ?? []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [view, orders, telegramUser, storeSlug, apiBase]);

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
      <SubHeader title={titleFor(view)} onBack={() => setView("menu")} />
      <div className="px-4 py-4">
        {view === "info" && <InfoForm profile={profile} onSave={saveProfile} />}
        {view === "orders" && <OrdersList orders={orders} loading={ordersLoading} />}
        {view === "reviews" && <PlaceholderTwoTab labelA="Baholanishi kutilmoqda" labelB="Barcha fikrlarim" />}
        {view === "promocodes" && <PromocodeForm storeSlug={storeSlug} />}
        {view === "referrals" && <ReferralsView telegramUser={telegramUser} />}
        {view === "language" && <LanguagePicker lang={lang} onChange={saveLang} />}
        {view === "addresses" && <AddressesList addresses={addresses} onSave={saveAddresses} />}
      </div>
    </div>
  );
}

function titleFor(v: ProfileView): string {
  switch (v) {
    case "info": return "Ma'lumotlarim";
    case "orders": return "Buyurtmalarim";
    case "reviews": return "Sharhlarim";
    case "promocodes": return "Promokodlarim";
    case "referrals": return "Referallarim";
    case "language": return "Ilova tili";
    case "addresses": return "Mening manzillarim";
    default: return "Profile";
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
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Mehmon";

  const items: Array<{ id: ProfileView; label: string; Icon: typeof UserIcon; sub?: string }> = [
    { id: "info", label: "Ma'lumotlarim", Icon: UserIcon, sub: profile.phone || "To'ldirilmagan" },
    { id: "orders", label: "Buyurtmalarim", Icon: ShoppingBag },
    { id: "reviews", label: "Sharhlarim", Icon: Star },
    { id: "promocodes", label: "Promokodlarim", Icon: Ticket },
    { id: "referrals", label: "Referallarim", Icon: Users },
    { id: "language", label: "Ilova tili", Icon: Globe, sub: "uz/ru" },
    { id: "addresses", label: "Mening manzillarim", Icon: MapPin },
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
              <div className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Operatorga murojaat</div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-300 truncate">Telegram orqali yozish</div>
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

function InfoForm({ profile, onSave }: { profile: ProfileData; onSave: (p: ProfileData) => void }) {
  const [draft, setDraft] = useState<ProfileData>(profile);
  const [savedFlash, setSavedFlash] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      }}
    >
      <Field label="Ism" value={draft.firstName} onChange={(v) => setDraft({ ...draft, firstName: v })} />
      <Field label="Familiya" value={draft.lastName} onChange={(v) => setDraft({ ...draft, lastName: v })} />
      <Field label="Otasining ismi" value={draft.patronymic} onChange={(v) => setDraft({ ...draft, patronymic: v })} />
      <Field
        label="Telefon raqam"
        value={draft.phone}
        onChange={(v) => setDraft({ ...draft, phone: formatUzPhone(v) })}
        type="tel"
        icon={Phone}
      />
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
      <button
        type="submit"
        className="w-full py-3 mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors"
      >
        {savedFlash ? "✓ Saqlandi" : "Saqlash"}
      </button>
    </form>
  );
}

function OrdersList({ orders, loading }: { orders: CustomerOrder[] | null; loading: boolean }) {
  const [tab, setTab] = useState<"active" | "all">("active");
  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Yuklanmoqda…</div>
    );
  }
  if (!orders) return null;
  const isActive = (o: CustomerOrder) => ["PENDING", "PROCESSING"].includes(o.status);
  const filtered = tab === "active" ? orders.filter(isActive) : orders;

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
          {filtered.map((o) => (
            <div
              key={o.id}
              className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">#{o.code}</div>
                <StatusBadge status={o.status} />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(o.createdAt).toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" })}
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{o.items} mahsulot</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {Number(o.total).toLocaleString("uz-UZ")} {o.currency === "UZS" ? "so'm" : o.currency}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: "Yangi", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    PROCESSING: { label: "Tayyorlanmoqda", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    COMPLETED: { label: "Yetkazildi", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
    CANCELLED: { label: "Bekor qilindi", cls: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    REFUNDED: { label: "Qaytarildi", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
  };
  const m = map[status] ?? { label: status, cls: "bg-slate-200 text-slate-700" };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${m.cls}`}>{m.label}</span>;
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

function ReferralsView({ telegramUser }: { telegramUser?: ProfilePageProps["telegramUser"] }) {
  const refLink = telegramUser?.userId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${window.location.pathname}?ref=${telegramUser.userId}`
    : "";

  return (
    <div>
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 mb-3">
        <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-1">
          Do'stlaringizni taklif qiling
        </div>
        <div className="text-xs text-emerald-700 dark:text-emerald-300">
          Har bir taklif uchun bonus oling
        </div>
      </div>
      {refLink && (
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sizning referal havolangiz</div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={refLink}
              className="flex-1 bg-transparent text-xs text-slate-700 dark:text-slate-200 truncate focus:outline-none"
            />
            <button
              onClick={() => {
                navigator.clipboard?.writeText(refLink).catch(() => null);
              }}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              Nusxa
            </button>
          </div>
        </div>
      )}
      <div className="py-6 text-center">
        <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
        <div className="text-sm text-slate-500 dark:text-slate-400">Hali taklif qilingan do'stlar yo'q</div>
      </div>
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

function AddressesList({ addresses, onSave }: { addresses: Address[]; onSave: (a: Address[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Address, "id">>({ label: "", city: "", street: "", apartment: "", notes: "" });

  if (adding) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave([...addresses, { ...draft, id: `addr-${Date.now()}` }]);
          setDraft({ label: "", city: "", street: "", apartment: "", notes: "" });
          setAdding(false);
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
            disabled={!draft.label.trim() || !draft.street.trim()}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
          >
            Saqlash
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
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{a.label}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {a.city && `${a.city}, `}{a.street}
                    {a.apartment && `, ${a.apartment}`}
                  </div>
                  {a.notes && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{a.notes}</div>}
                </div>
                <button
                  onClick={() => onSave(addresses.filter((x) => x.id !== a.id))}
                  className="p-1.5 -mr-1 text-slate-400 hover:text-rose-500 rounded"
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
