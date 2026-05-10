import { useEffect, useState } from "react";
import { User, Store as StoreIcon, Bell, Globe, Plus, Trash2, MapPin, Languages, Share2, Clock, Image as ImageIcon, Bold, Italic, Underline as UnderlineIcon } from "lucide-react";
import { api } from "../lib/api";
import { useShopSetting } from "../lib/useShopSetting";

interface ProfileData {
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string;
}

type LangCode = "uz" | "ru" | "en" | "tr";

interface ShopData {
  name: string;
  description: string;
  descriptions: Partial<Record<LangCode, string>>;
  logoUrl: string;
  domain: string;
  currency: string;
  timezone: string;
  contactPhone: string;
  contactEmail: string;
  languages: LangCode[];
  mainLanguage: LangCode;
  socialLinks: {
    instagram: string;
    telegram: string;
    facebook: string;
    youtube: string;
    tiktok: string;
    whatsapp: string;
  };
}

interface DayHours { enabled: boolean; intervals: Array<{ from: string; to: string }> }
type WeekHours = Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", DayHours>;

interface Branch { id: string; name: string; address: string; phone: string; lat?: number; lng?: number }

interface NotifData {
  newOrder: boolean;
  newCustomer: boolean;
  paymentReceived: boolean;
  lowStock: boolean;
  dailyReport: boolean;
}

const defaultProfile: ProfileData = { fullName: "", email: "", phone: "", avatarUrl: "" };
const defaultShop: ShopData = {
  name: "", description: "", descriptions: {}, logoUrl: "", domain: "", currency: "UZS", timezone: "Asia/Tashkent",
  contactPhone: "", contactEmail: "",
  languages: ["uz", "ru"], mainLanguage: "uz",
  socialLinks: { instagram: "", telegram: "", facebook: "", youtube: "", tiktok: "", whatsapp: "" },
};
const defaultHours: WeekHours = {
  mon: { enabled: true, intervals: [{ from: "09:00", to: "21:00" }] },
  tue: { enabled: true, intervals: [{ from: "09:00", to: "21:00" }] },
  wed: { enabled: true, intervals: [{ from: "09:00", to: "21:00" }] },
  thu: { enabled: true, intervals: [{ from: "09:00", to: "21:00" }] },
  fri: { enabled: true, intervals: [{ from: "09:00", to: "21:00" }] },
  sat: { enabled: true, intervals: [{ from: "10:00", to: "22:00" }] },
  sun: { enabled: false, intervals: [{ from: "10:00", to: "20:00" }] },
};
const defaultNotif: NotifData = { newOrder: true, newCustomer: false, paymentReceived: true, lowStock: true, dailyReport: false };

const langLabels: Record<LangCode, string> = { uz: "🇺🇿 O'zbek", ru: "🇷🇺 Pyccкий", en: "🇬🇧 English", tr: "🇹🇷 Türkçe" };
const days: Array<{ key: keyof WeekHours; label: string }> = [
  { key: "mon", label: "Dushanba" }, { key: "tue", label: "Seshanba" }, { key: "wed", label: "Chorshanba" },
  { key: "thu", label: "Payshanba" }, { key: "fri", label: "Juma" }, { key: "sat", label: "Shanba" }, { key: "sun", label: "Yakshanba" },
];

export default function LiveSettingsPanel() {
  const [me, setMe] = useState<{ userId: string; shopId: string } | null>(null);
  const [profile, setProfile] = useShopSetting<ProfileData>("settings.profile", defaultProfile);
  const [shop, setShop] = useShopSetting<ShopData>("settings.shop", defaultShop);
  const [hours, setHours] = useShopSetting<WeekHours>("settings.hours", defaultHours);
  const [branches, setBranches] = useShopSetting<Branch[]>("settings.branches", []);
  const [notif, setNotif] = useShopSetting<NotifData>("settings.notifications", defaultNotif);
  const [activeLang, setActiveLang] = useState<LangCode>("uz");

  useEffect(() => {
    void api.me().then(setMe).catch(() => {});
  }, []);

  // Migration: ensure all shop fields exist
  useEffect(() => {
    if (!shop.languages) setShop({ ...shop, ...defaultShop, ...shop, languages: defaultShop.languages });
    if (!shop.socialLinks) setShop({ ...shop, socialLinks: defaultShop.socialLinks });
    if (!shop.descriptions) setShop({ ...shop, descriptions: {} });
  }, []);

  const safeShop: ShopData = {
    ...defaultShop,
    ...shop,
    socialLinks: { ...defaultShop.socialLinks, ...(shop.socialLinks ?? {}) },
    languages: shop.languages?.length ? shop.languages : defaultShop.languages,
    descriptions: shop.descriptions ?? {},
  };

  function toggleLang(code: LangCode) {
    const has = safeShop.languages.includes(code);
    const next = has ? safeShop.languages.filter((c) => c !== code) : [...safeShop.languages, code];
    if (next.length === 0) return;
    let mainLang = safeShop.mainLanguage;
    if (!next.includes(mainLang)) mainLang = next[0];
    setShop({ ...safeShop, languages: next, mainLanguage: mainLang });
  }

  return (
    <div className="space-y-4">
      {/* Profile */}
      <Section icon={User} title="Profil" subtitle="Shaxsiy ma'lumotlaringiz">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="To'liq ism">
            <input value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} className={input} />
          </Field>
          <Field label="Email">
            <input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className={input} />
          </Field>
          <Field label="Telefon">
            <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+998..." className={input} />
          </Field>
          <Field label="Avatar URL">
            <input type="url" value={profile.avatarUrl} onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })} placeholder="https://..." className={input} />
          </Field>
        </div>
        <p className="text-[10px] text-slate-600 mt-3">User ID: {me?.userId ?? "..."}</p>
      </Section>

      {/* Logo */}
      <Section icon={ImageIcon} title="Logo" subtitle="Brendingiz logosi (URL)">
        <div className="grid md:grid-cols-2 gap-4 items-center">
          <Field label="Logo URL">
            <input type="url" value={safeShop.logoUrl} onChange={(e) => setShop({ ...safeShop, logoUrl: e.target.value })} placeholder="https://..." className={input} />
            <p className="text-[10px] text-slate-500 mt-1.5">10MB gacha rasm. Kelajakda S3 upload ham qo'shiladi.</p>
          </Field>
          <div className="flex items-center justify-center bg-slate-800/40 rounded-xl py-4">
            {safeShop.logoUrl ? (
              <img src={safeShop.logoUrl} alt="logo" className="w-20 h-20 object-contain rounded-xl" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-slate-700 flex items-center justify-center text-slate-500 text-xs">Logo</div>
            )}
          </div>
        </div>
      </Section>

      {/* Languages */}
      <Section icon={Languages} title="Tillar" subtitle="Saytda qaysi tillar qo'llab-quvvatlanadi">
        <div className="space-y-2">
          {(Object.keys(langLabels) as LangCode[]).map((code) => {
            const active = safeShop.languages.includes(code);
            const isMain = safeShop.mainLanguage === code;
            return (
              <div key={code} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/40">
                <button onClick={() => toggleLang(code)} className="flex items-center gap-2 flex-1 text-left">
                  <div className={`w-4 h-4 rounded border-2 ${active ? "bg-emerald-600 border-emerald-500" : "border-slate-600"} flex items-center justify-center`}>
                    {active && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  <span className="text-sm text-slate-300">{langLabels[code]}</span>
                </button>
                {active && (
                  <button
                    onClick={() => setShop({ ...safeShop, mainLanguage: code })}
                    className={`flex items-center gap-1.5 text-xs ${isMain ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full border-2 ${isMain ? "border-emerald-500" : "border-slate-600"} flex items-center justify-center`}>
                      {isMain && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                    </div>
                    Asosiy til
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Shop info + multilingual about */}
      <Section icon={StoreIcon} title="Do'kon" subtitle="Asosiy do'kon ma'lumotlari">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Field label="Do'kon nomi">
            <input value={safeShop.name} onChange={(e) => setShop({ ...safeShop, name: e.target.value })} className={input} />
          </Field>
          <Field label="Domen">
            <input value={safeShop.domain} onChange={(e) => setShop({ ...safeShop, domain: e.target.value })} placeholder="myshop.uz" className={input} />
          </Field>
          <Field label="Pul birligi">
            <select value={safeShop.currency} onChange={(e) => setShop({ ...safeShop, currency: e.target.value })} className={input}>
              <option value="UZS">UZS — so'm</option>
              <option value="USD">USD — dollar</option>
              <option value="RUB">RUB — rubl</option>
            </select>
          </Field>
          <Field label="Aloqa telefoni">
            <input type="tel" value={safeShop.contactPhone} onChange={(e) => setShop({ ...safeShop, contactPhone: e.target.value })} placeholder="+998..." className={input} />
          </Field>
        </div>

        <Field label="Biz haqimizda">
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-700">
              <button className="p-1 hover:bg-slate-700 rounded" title="Qalin"><Bold className="w-3.5 h-3.5 text-slate-400" /></button>
              <button className="p-1 hover:bg-slate-700 rounded" title="Qiyshiq"><Italic className="w-3.5 h-3.5 text-slate-400" /></button>
              <button className="p-1 hover:bg-slate-700 rounded" title="Tagiga chiziqli"><UnderlineIcon className="w-3.5 h-3.5 text-slate-400" /></button>
              <div className="ml-auto flex gap-1">
                {safeShop.languages.map((code) => (
                  <button
                    key={code}
                    onClick={() => setActiveLang(code)}
                    className={`px-2 py-0.5 text-[10px] rounded ${activeLang === code ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400"}`}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={safeShop.descriptions[activeLang] ?? ""}
              onChange={(e) => setShop({ ...safeShop, descriptions: { ...safeShop.descriptions, [activeLang]: e.target.value } })}
              rows={3}
              placeholder={`${langLabels[activeLang]} tilida sayt haqida ma'lumot kiriting...`}
              className="w-full bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none min-h-[80px]"
            />
          </div>
        </Field>
      </Section>

      {/* Social links */}
      <Section icon={Share2} title="Ijtimoiy tarmoqlar" subtitle="Sayt va botda ko'rsatiladigan link'lar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(safeShop.socialLinks) as Array<keyof typeof safeShop.socialLinks>).map((platform) => (
            <Field key={platform} label={platform.charAt(0).toUpperCase() + platform.slice(1)}>
              <input
                type="url"
                value={safeShop.socialLinks[platform]}
                onChange={(e) => setShop({ ...safeShop, socialLinks: { ...safeShop.socialLinks, [platform]: e.target.value } })}
                placeholder={`${platform} URL`}
                className={input}
              />
            </Field>
          ))}
        </div>
      </Section>

      {/* Working hours */}
      <Section icon={Clock} title="Ish vaqti" subtitle="Har kun uchun bir nechta interval qo'shish mumkin">
        <div className="space-y-3">
          {days.map((d) => {
            const day = hours[d.key] ?? { enabled: false, intervals: [{ from: "09:00", to: "21:00" }] };
            return (
              <div key={d.key} className="bg-slate-800/40 rounded-lg p-3">
                <div className="flex items-center gap-3 mb-2">
                  <button onClick={() => setHours({ ...hours, [d.key]: { ...day, enabled: !day.enabled } })}
                    className={`w-9 h-5 rounded-full ${day.enabled ? "bg-emerald-600" : "bg-slate-700"} relative`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${day.enabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                  </button>
                  <span className="text-sm font-medium text-slate-300 flex-1">{d.label}</span>
                  {!day.enabled && <span className="text-xs text-slate-500">Yopiq</span>}
                </div>
                {day.enabled && (
                  <div className="space-y-2 ml-12">
                    {day.intervals.map((iv, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="time" value={iv.from} onChange={(e) => {
                          const next = [...day.intervals];
                          next[i] = { ...iv, from: e.target.value };
                          setHours({ ...hours, [d.key]: { ...day, intervals: next } });
                        }} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                        <span className="text-slate-500 text-xs">—</span>
                        <input type="time" value={iv.to} onChange={(e) => {
                          const next = [...day.intervals];
                          next[i] = { ...iv, to: e.target.value };
                          setHours({ ...hours, [d.key]: { ...day, intervals: next } });
                        }} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                        {day.intervals.length > 1 && (
                          <button onClick={() => {
                            const next = day.intervals.filter((_, idx) => idx !== i);
                            setHours({ ...hours, [d.key]: { ...day, intervals: next } });
                          }} className="p-1 text-slate-500 hover:text-red-400">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setHours({ ...hours, [d.key]: { ...day, intervals: [...day.intervals, { from: "14:00", to: "18:00" }] } })}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Yana interval
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Branches */}
      <Section icon={MapPin} title="Filiallar" subtitle={`${branches.length} ta filial`}>
        <div className="space-y-3">
          {branches.map((b) => (
            <div key={b.id} className="bg-slate-800/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <input value={b.name} onChange={(e) => setBranches(branches.map((x) => x.id === b.id ? { ...x, name: e.target.value } : x))}
                  placeholder="Filial nomi" className={`${input} flex-1`} />
                <button onClick={() => setBranches(branches.filter((x) => x.id !== b.id))} className="ml-2 p-2 text-slate-500 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <input value={b.address} onChange={(e) => setBranches(branches.map((x) => x.id === b.id ? { ...x, address: e.target.value } : x))}
                placeholder="Manzil (ko'cha, uy)" className={input} />
              <input type="tel" value={b.phone} onChange={(e) => setBranches(branches.map((x) => x.id === b.id ? { ...x, phone: e.target.value } : x))}
                placeholder="Telefon raqam" className={input} />
            </div>
          ))}
          <button onClick={() => setBranches([...branches, { id: `br-${Date.now()}`, name: "", address: "", phone: "" }])}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-dashed border-slate-700 text-slate-400 text-sm py-2.5 rounded-lg flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> Yangi filial
          </button>
        </div>
      </Section>

      {/* Notifications */}
      <Section icon={Bell} title="Bildirishnomalar" subtitle="Qaysi hodisalarda xabar berishni tanlang">
        <div className="space-y-2">
          <Toggle label="Yangi buyurtma" checked={notif.newOrder} onChange={(v) => setNotif({ ...notif, newOrder: v })} />
          <Toggle label="Yangi mijoz ro'yxatdan o'tdi" checked={notif.newCustomer} onChange={(v) => setNotif({ ...notif, newCustomer: v })} />
          <Toggle label="To'lov qabul qilindi" checked={notif.paymentReceived} onChange={(v) => setNotif({ ...notif, paymentReceived: v })} />
          <Toggle label="Mahsulot kam qoldi" checked={notif.lowStock} onChange={(v) => setNotif({ ...notif, lowStock: v })} />
          <Toggle label="Kunlik hisobot" checked={notif.dailyReport} onChange={(v) => setNotif({ ...notif, dailyReport: v })} />
        </div>
      </Section>

      <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
        <Globe className="w-3.5 h-3.5" />
        <span>Avtomatik saqlash yoqilgan — har o'zgarish 800ms keyin saqlanadi</span>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: { icon: React.ElementType; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
          <Icon className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between bg-slate-800/40 px-4 py-2.5 rounded-lg cursor-pointer hover:bg-slate-800/70" onClick={() => onChange(!checked)}>
      <span className="text-sm text-slate-300">{label}</span>
      <div className={`w-9 h-5 rounded-full ${checked ? "bg-emerald-600" : "bg-slate-700"} relative`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </div>
    </label>
  );
}

const input = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50";
