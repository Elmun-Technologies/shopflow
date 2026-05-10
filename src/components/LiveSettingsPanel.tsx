import { useEffect, useState } from "react";
import { User, Store as StoreIcon, Bell, Globe } from "lucide-react";
import { api } from "../lib/api";
import { useShopSetting } from "../lib/useShopSetting";

interface ProfileData {
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string;
}

interface ShopData {
  name: string;
  description: string;
  logoUrl: string;
  domain: string;
  currency: string;
  timezone: string;
  workingHours: { from: string; to: string };
  contactPhone: string;
  contactEmail: string;
}

interface NotifData {
  newOrder: boolean;
  newCustomer: boolean;
  paymentReceived: boolean;
  lowStock: boolean;
  dailyReport: boolean;
}

const defaultProfile: ProfileData = { fullName: "", email: "", phone: "", avatarUrl: "" };
const defaultShop: ShopData = {
  name: "", description: "", logoUrl: "", domain: "", currency: "UZS", timezone: "Asia/Tashkent",
  workingHours: { from: "09:00", to: "21:00" }, contactPhone: "", contactEmail: "",
};
const defaultNotif: NotifData = { newOrder: true, newCustomer: false, paymentReceived: true, lowStock: true, dailyReport: false };

export default function LiveSettingsPanel() {
  const [me, setMe] = useState<{ userId: string; shopId: string } | null>(null);
  const [profile, setProfile] = useShopSetting<ProfileData>("settings.profile", defaultProfile);
  const [shop, setShop] = useShopSetting<ShopData>("settings.shop", defaultShop);
  const [notif, setNotif] = useShopSetting<NotifData>("settings.notifications", defaultNotif);

  useEffect(() => {
    void api.me().then(setMe).catch(() => { /* */ });
  }, []);

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

      {/* Shop */}
      <Section icon={StoreIcon} title="Do'kon" subtitle="Asosiy do'kon ma'lumotlari">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Do'kon nomi">
            <input value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} className={input} />
          </Field>
          <Field label="Domen">
            <input value={shop.domain} onChange={(e) => setShop({ ...shop, domain: e.target.value })} placeholder="myshop.uz" className={input} />
          </Field>
          <Field label="Logo URL">
            <input type="url" value={shop.logoUrl} onChange={(e) => setShop({ ...shop, logoUrl: e.target.value })} className={input} />
          </Field>
          <Field label="Pul birligi">
            <select value={shop.currency} onChange={(e) => setShop({ ...shop, currency: e.target.value })} className={input}>
              <option value="UZS">UZS — so'm</option>
              <option value="USD">USD — dollar</option>
              <option value="RUB">RUB — rubl</option>
            </select>
          </Field>
          <Field label="Aloqa telefoni">
            <input type="tel" value={shop.contactPhone} onChange={(e) => setShop({ ...shop, contactPhone: e.target.value })} className={input} />
          </Field>
          <Field label="Aloqa email">
            <input type="email" value={shop.contactEmail} onChange={(e) => setShop({ ...shop, contactEmail: e.target.value })} className={input} />
          </Field>
          <Field label="Ish vaqti boshi">
            <input type="time" value={shop.workingHours.from} onChange={(e) => setShop({ ...shop, workingHours: { ...shop.workingHours, from: e.target.value } })} className={input} />
          </Field>
          <Field label="Ish vaqti oxiri">
            <input type="time" value={shop.workingHours.to} onChange={(e) => setShop({ ...shop, workingHours: { ...shop.workingHours, to: e.target.value } })} className={input} />
          </Field>
        </div>
        <Field label="Tavsifi" className="mt-4">
          <textarea value={shop.description} onChange={(e) => setShop({ ...shop, description: e.target.value })} rows={2} className={`${input} min-h-[60px]`} />
        </Field>
      </Section>

      {/* Notifications */}
      <Section icon={Bell} title="Bildirishnomalar" subtitle="Qanday hodisalar bo'lganda xabar berishni tanlang">
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
    <label className="flex items-center justify-between bg-slate-800/40 px-4 py-2.5 rounded-lg cursor-pointer hover:bg-slate-800/70 transition-colors" onClick={() => onChange(!checked)}>
      <span className="text-sm text-slate-300">{label}</span>
      <div className={`w-9 h-5 rounded-full transition-colors ${checked ? "bg-emerald-600" : "bg-slate-700"} relative`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </div>
    </label>
  );
}

const input = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50";
