import { memo } from "react";
import { ArrowLeft, User, Phone, MapPin, CheckCircle2, Loader2, NavigationIcon } from "lucide-react";
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

function InputField({
  label,
  icon,
  error,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: "#52526a" }}>{label}</label>
      <div
        className="flex items-center gap-2 rounded-xl px-3"
        style={{
          backgroundColor: "#1e1e2a",
          border: error ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.07)",
          height: 48,
        }}
      >
        <span style={{ color: "#3a3a56", flexShrink: 0 }}>{icon}</span>
        {children}
      </div>
      {error && <p className="text-[11px]" style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}

function CheckoutViewInner({
  cart, cartTotal, currency, primaryColor, form,
  savedAddresses, gpsBusy, submitting, submitError,
  onBack, onFormChange, onGpsBusy, onSubmit,
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
        onFormChange((f) => ({ ...f, lat, lng, address: f.address.trim() || `GPS: ${lat}, ${lng}` }));
        haptic.medium();
        onGpsBusy(false);
      },
      (err) => {
        onGpsBusy(false);
        alert(err.code === err.PERMISSION_DENIED ? t("checkout.gpsDenied") : t("checkout.gpsError"));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const canSubmit = !submitting && form.name.trim().length > 0 && isValidUzPhone(form.phone);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d14" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pb-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={onBack}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#1e1e2a", color: "#94a3b8" }}
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div>
          <h2 className="text-base font-bold" style={{ color: "#f4f4f8" }}>{t("checkout.title")}</h2>
          <p className="text-xs" style={{ color: "#52526a" }}>{formatPrice(cartTotal, currency)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {/* Order summary */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: "#16161f", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#3a3a56" }}>
              {t("checkout.orderSummary")}
            </p>
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span className="text-sm" style={{ color: "#94a3b8" }}>
                  {item.name}
                  <span className="ml-1 text-xs" style={{ color: "#3a3a56" }}>×{item.qty}</span>
                </span>
                <span className="text-sm font-semibold" style={{ color: primaryColor }}>
                  {formatPrice(item.price * item.qty, currency)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm font-semibold" style={{ color: "#f4f4f8" }}>{t("checkout.total")}</span>
              <span className="text-base font-bold" style={{ color: primaryColor }}>
                {formatPrice(cartTotal, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Customer info */}
        <div
          className="rounded-2xl p-4 space-y-4"
          style={{ backgroundColor: "#16161f", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#3a3a56" }}>
            {t("checkout.yourInfo")}
          </p>

          {/* Name */}
          <InputField label={`${t("checkout.name")} *`} icon={<User className="w-4 h-4" />}>
            <input
              type="text"
              placeholder={t("checkout.namePlaceholder")}
              value={form.name}
              onChange={(e) => onFormChange((f) => ({ ...f, name: e.target.value }))}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "#f4f4f8" }}
            />
          </InputField>

          {/* Phone */}
          <InputField
            label={`${t("checkout.phone")} *`}
            icon={<Phone className="w-4 h-4" />}
            error={form.phone && !isValidUzPhone(form.phone) ? t("checkout.phoneInvalid") : undefined}
          >
            <input
              type="tel"
              placeholder="+998 90 123 45 67"
              value={form.phone}
              onChange={(e) => onFormChange((f) => ({ ...f, phone: formatUzPhone(e.target.value) }))}
              inputMode="tel"
              autoComplete="tel"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "#f4f4f8" }}
            />
          </InputField>

          {/* Saved addresses chips */}
          {savedAddresses.length > 0 && (
            <div>
              <p className="text-xs mb-2" style={{ color: "#52526a" }}>{t("checkout.savedAddresses")}</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {savedAddresses.map((a) => {
                  const full = formatAddress(a);
                  const isActive = form.address === full;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onFormChange((f) => ({ ...f, address: full }))}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                      style={{
                        backgroundColor: isActive ? primaryColor + "20" : "#1e1e2a",
                        color: isActive ? primaryColor : "#94a3b8",
                        border: isActive ? `1px solid ${primaryColor}40` : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Address */}
          <InputField label={t("checkout.addressLabel")} icon={<MapPin className="w-4 h-4" />}>
            <input
              type="text"
              placeholder={t("checkout.address")}
              value={form.address}
              onChange={(e) => onFormChange((f) => ({ ...f, address: e.target.value, lat: null, lng: null }))}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "#f4f4f8" }}
            />
            <button
              type="button"
              onClick={handleGps}
              disabled={gpsBusy}
              className="flex-shrink-0 active:scale-90 transition-transform disabled:opacity-50"
              aria-label="GPS joylashuv"
              style={{ color: "#3b82f6" }}
            >
              {gpsBusy
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <NavigationIcon className="w-4 h-4" />
              }
            </button>
          </InputField>

          {form.lat != null && form.lng != null && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#4ade80" }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              GPS aniqlandi: {form.lat.toFixed(4)}, {form.lng.toFixed(4)}
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "#52526a" }}>{t("checkout.note")}</label>
            <textarea
              placeholder={t("checkout.notePlaceholder")}
              value={form.notes}
              onChange={(e) => onFormChange((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full text-sm px-3 py-3 rounded-xl resize-none outline-none"
              style={{
                backgroundColor: "#1e1e2a",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "#f4f4f8",
              }}
            />
          </div>
        </div>

        {/* Error */}
        {submitError && (
          <div
            className="flex items-start gap-2 p-3 rounded-xl text-sm"
            style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171" }}
          >
            {submitError}
          </div>
        )}
      </div>

      {/* Submit */}
      <div
        className="px-4 pt-3"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{
            backgroundColor: canSubmit ? primaryColor : "#1e1e2a",
            color: canSubmit ? "#fff" : "#3a3a56",
          }}
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
