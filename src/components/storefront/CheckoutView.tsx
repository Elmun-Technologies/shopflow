import { memo } from "react";
import { ArrowLeft, User, Phone, MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { useT } from "../../i18n";
import { haptic } from "./storefront-theme";
import { formatUzPhone, isValidUzPhone } from "../../utils/phone";

interface CartItem {
  productId: string;
  qty: number;
  name: string;
  price: number;
  imageUrl: string | null;
}

interface CheckoutForm {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  lat?: number | null;
  lng?: number | null;
}

interface StoredAddress {
  id: string;
  label: string;
  city: string;
  street: string;
  apartment?: string;
  notes?: string;
}

function formatAddress(a: StoredAddress): string {
  return [a.city, a.street, a.apartment].filter(Boolean).join(", ");
}

function formatPrice(price: number, currency: string): string {
  if (currency === "UZS") return price.toLocaleString("uz-UZ") + " so'm";
  if (currency === "USD") return "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2 });
  return price.toLocaleString() + " " + currency;
}

interface CheckoutViewProps {
  cart: CartItem[];
  cartTotal: number;
  currency: string;
  primaryColor: string;
  form: CheckoutForm;
  savedAddresses: StoredAddress[];
  gpsBusy: boolean;
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onFormChange: (updater: (f: CheckoutForm) => CheckoutForm) => void;
  onGpsBusy: (busy: boolean) => void;
  onSubmit: () => void;
}

function CheckoutViewInner({
  cart,
  cartTotal,
  currency,
  primaryColor,
  form,
  savedAddresses,
  gpsBusy,
  submitting,
  submitError,
  onBack,
  onFormChange,
  onGpsBusy,
  onSubmit,
}: CheckoutViewProps) {
  const { t } = useT();

  const handleGps = () => {
    if (!navigator.geolocation) {
      alert(t("checkout.gpsUnsupported"));
      return;
    }
    onGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        onFormChange((f) => ({
          ...f,
          lat,
          lng,
          address: f.address.trim() || `GPS: ${lat}, ${lng}`,
        }));
        haptic.medium();
        onGpsBusy(false);
      },
      (err) => {
        onGpsBusy(false);
        alert(
          err.code === err.PERMISSION_DENIED
            ? t("checkout.gpsDenied")
            : t("checkout.gpsError"),
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-slate-800">
        <button onClick={onBack} className="p-2 rounded-xl text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-semibold text-white">{t("checkout.title")}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Order summary */}
        <div className="bg-slate-900 rounded-2xl p-4">
          <h3 className="text-xs font-medium text-slate-400 mb-3">{t("checkout.orderSummary")}</h3>
          {cart.map((item) => (
            <div key={item.productId} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
              <span className="text-sm text-white">
                {item.name} <span className="text-slate-500">×{item.qty}</span>
              </span>
              <span className="text-sm font-medium" style={{ color: primaryColor }}>
                {formatPrice(item.price * item.qty, currency)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-3 mt-1">
            <span className="text-sm font-semibold text-white">{t("checkout.total")}</span>
            <span className="text-base font-bold" style={{ color: primaryColor }}>
              {formatPrice(cartTotal, currency)}
            </span>
          </div>
        </div>

        {/* Customer form */}
        <div className="bg-slate-900 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-medium text-slate-400 mb-1">{t("checkout.yourInfo")}</h3>

          {/* Name */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t("checkout.name")} *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={t("checkout.namePlaceholder")}
                value={form.name}
                onChange={(e) => onFormChange((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t("checkout.phone")} *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="tel"
                placeholder="+998 90 123 45 67"
                value={form.phone}
                onChange={(e) => onFormChange((f) => ({ ...f, phone: formatUzPhone(e.target.value) }))}
                inputMode="tel"
                autoComplete="tel"
                className={`w-full bg-slate-800 border rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none ${
                  form.phone && !isValidUzPhone(form.phone)
                    ? "border-rose-500/40 focus:border-rose-500/60"
                    : "border-slate-700 focus:border-emerald-500/50"
                }`}
              />
            </div>
            {form.phone && !isValidUzPhone(form.phone) && (
              <p className="text-[11px] text-rose-300 mt-1">{t("checkout.phoneInvalid")}</p>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t("checkout.addressLabel")}</label>
            {savedAddresses.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                {savedAddresses.map((a) => {
                  const full = formatAddress(a);
                  const isActive = form.address === full;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onFormChange((f) => ({ ...f, address: full }))}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                        isActive ? "text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                      style={isActive ? { backgroundColor: primaryColor } : {}}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={t("checkout.address")}
                value={form.address}
                onChange={(e) => onFormChange((f) => ({ ...f, address: e.target.value, lat: null, lng: null }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <button
              type="button"
              onClick={handleGps}
              disabled={gpsBusy}
              className="mt-1.5 w-full flex items-center justify-center gap-2 px-3 py-2 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/15 disabled:opacity-50 rounded-xl text-sm text-sky-300 transition-colors"
            >
              {gpsBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-base leading-none">📍</span>}
              {t("checkout.gps")}
            </button>
            {form.lat != null && form.lng != null && (
              <p className="text-[11px] text-emerald-300 mt-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                {t("checkout.gpsDetected")}: <span className="font-mono">{form.lat.toFixed(5)}, {form.lng.toFixed(5)}</span>
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t("checkout.note")}</label>
            <textarea
              placeholder={t("checkout.notePlaceholder")}
              value={form.notes}
              onChange={(e) => onFormChange((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>
        </div>

        {submitError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <p className="text-sm text-red-400">{submitError}</p>
          </div>
        )}
      </div>

      {/* Submit button */}
      <div className="p-4 border-t border-slate-800 bg-slate-950">
        <button
          onClick={onSubmit}
          disabled={submitting || !form.name.trim() || !isValidUzPhone(form.phone)}
          className="w-full py-4 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryColor }}
        >
          {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
          {submitting
            ? t("checkout.sending")
            : `${t("checkout.submit")} · ${formatPrice(cartTotal, currency)}`}
        </button>
      </div>
    </div>
  );
}

export const CheckoutView = memo(CheckoutViewInner);
