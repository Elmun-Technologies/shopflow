import { memo } from "react";
import { CheckCircle2, Truck, Bell, ShoppingBag, ArrowRight } from "lucide-react";
import { useT } from "../../i18n";

const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
function formatUzDate(d: Date) {
  return `${d.getDate()} ${UZ_MONTHS[d.getMonth()]}`;
}
function deliveryDate() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d;
}
function formatPrice(price: number, currency: string) {
  if (currency === "UZS") return price.toLocaleString("uz-UZ") + " so'm";
  if (currency === "USD") return "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2 });
  return price.toLocaleString() + " " + currency;
}

interface SuccessViewProps {
  orderResult: { code: string; total: number; currency: string };
  primaryColor: string;
  hasTelegram: boolean;
  onViewOrders: () => void;
  onContinueShopping: () => void;
}

const STEPS: Array<{ key: string; done: boolean; active?: boolean }> = [
  { key: "received", done: true },
  { key: "processing", done: false, active: true },
  { key: "shipping", done: false },
  { key: "delivered", done: false },
];

function SuccessViewInner({ orderResult, primaryColor, hasTelegram, onViewOrders, onContinueShopping }: SuccessViewProps) {
  const { t } = useT();
  const delivStr = formatUzDate(deliveryDate());

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d14" }}>
      <div
        className="flex-1 overflow-y-auto px-5"
        style={{ paddingTop: "max(2.5rem, env(safe-area-inset-top))" }}
      >
        <div className="max-w-md mx-auto pb-8">

          {/* Hero checkmark */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="relative flex items-center justify-center mb-5"
              style={{ width: 88, height: 88 }}
            >
              {/* Outer ring */}
              <div
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: primaryColor + "12" }}
              />
              <div
                className="absolute inset-3 rounded-full"
                style={{ backgroundColor: primaryColor + "1e" }}
              />
              <CheckCircle2
                className="relative z-10"
                style={{ width: 40, height: 40, color: primaryColor }}
                strokeWidth={2}
              />
            </div>
            <h2 className="text-2xl font-bold mb-1" style={{ color: "#f4f4f8" }}>
              {t("success.title")}
            </h2>
            <p className="text-sm text-center" style={{ color: "#52526a" }}>
              {t("success.subtitle")}
            </p>
          </div>

          {/* Order card */}
          <div
            className="p-4 rounded-2xl mb-4"
            style={{
              backgroundColor: "#16161f",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#3a3a56" }}>{t("success.orderNumber")}</p>
                <p className="text-lg font-bold" style={{ color: "#f4f4f8" }}>#{orderResult.code}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#3a3a56" }}>{t("success.total")}</p>
                <p className="text-lg font-bold" style={{ color: primaryColor }}>
                  {formatPrice(orderResult.total, orderResult.currency)}
                </p>
              </div>
            </div>
            <div
              className="flex items-center gap-2 pt-3 mt-1 border-t"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <Truck className="w-4 h-4 flex-shrink-0" style={{ color: "#38bdf8" }} />
              <span className="text-xs" style={{ color: "#94a3b8" }}>
                {t("success.estimatedDelivery")}: <span className="font-semibold" style={{ color: "#f4f4f8" }}>{delivStr}</span>
              </span>
            </div>
          </div>

          {/* Status timeline */}
          <div
            className="p-4 rounded-2xl mb-4"
            style={{
              backgroundColor: "#16161f",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <p className="text-[10px] uppercase tracking-wider mb-4" style={{ color: "#3a3a56" }}>
              {t("success.orderStatus")}
            </p>
            <div className="relative">
              {/* Vertical line */}
              <div
                className="absolute left-3 top-3 bottom-3 w-px"
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
              />
              <div className="space-y-4">
                {STEPS.map((step, i) => {
                  const label = t(`success.step.${step.key}` as Parameters<typeof t>[0]);
                  const desc = step.key === "delivered"
                    ? delivStr
                    : t(`success.step.${step.key}Desc` as Parameters<typeof t>[0]);
                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div
                        className="relative z-10 flex items-center justify-center flex-shrink-0"
                        style={{
                          width: 24, height: 24, borderRadius: "50%",
                          backgroundColor: step.done
                            ? primaryColor
                            : step.active
                              ? "rgba(245,158,11,0.15)"
                              : "#1e1e2a",
                          border: step.active ? "2px solid rgba(245,158,11,0.5)" : "none",
                          marginTop: 1,
                        }}
                      >
                        {step.done
                          ? <CheckCircle2 className="w-3 h-3" style={{ color: "#fff" }} />
                          : <span className="text-[9px] font-bold" style={{ color: step.active ? "#f59e0b" : "#3a3a56" }}>{i + 1}</span>
                        }
                      </div>
                      <div className="flex-1 pb-1">
                        <p
                          className="text-sm font-medium"
                          style={{ color: step.done || step.active ? "#f4f4f8" : "#3a3a56" }}
                        >
                          {label}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "#52526a" }}>{desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Notification tip */}
          <div
            className="flex items-start gap-3 p-4 rounded-2xl mb-6"
            style={{
              backgroundColor: hasTelegram ? "rgba(56,189,248,0.08)" : "#16161f",
              border: hasTelegram ? "1px solid rgba(56,189,248,0.15)" : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Bell className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: hasTelegram ? "#38bdf8" : "#52526a" }} />
            <p className="text-xs leading-relaxed" style={{ color: hasTelegram ? "#bae6fd" : "#52526a" }}>
              {hasTelegram
                ? t("success.notify.tg")
                : t("success.saveOrderNumber", { code: orderResult.code })}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={onViewOrders}
              className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor, color: "#fff" }}
            >
              <ShoppingBag className="w-5 h-5" />
              {t("success.viewOrder")}
            </button>
            <button
              onClick={onContinueShopping}
              className="w-full py-3.5 rounded-2xl font-medium text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              style={{
                backgroundColor: "#16161f",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "#94a3b8",
              }}
            >
              {t("success.continueShopping")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const SuccessView = memo(SuccessViewInner);
