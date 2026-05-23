import { memo } from "react";
import { CheckCircle2, Truck, Bell, ShoppingBag } from "lucide-react";
import { useT } from "../../i18n";

const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
function formatUzDate(d: Date): string {
  return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}`;
}
function estimatedDeliveryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d;
}
function formatPrice(price: number, currency: string): string {
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

function SuccessViewInner({ orderResult, primaryColor, hasTelegram, onViewOrders, onContinueShopping }: SuccessViewProps) {
  const { t } = useT();
  const deliveryStr = formatUzDate(estimatedDeliveryDate());

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="flex-1 overflow-y-auto px-5 py-8" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
        <div className="max-w-md mx-auto">
          {/* Hero */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4 animate-in zoom-in duration-300"
              style={{ backgroundColor: primaryColor + "20" }}
            >
              <CheckCircle2 className="w-11 h-11" style={{ color: primaryColor }} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">{t("success.title")}</h2>
            <p className="text-sm text-slate-400">{t("success.subtitle")}</p>
          </div>

          {/* Order card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Buyurtma</p>
                <p className="text-lg font-bold text-white">#{orderResult.code}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Jami</p>
                <p className="text-lg font-bold" style={{ color: primaryColor }}>
                  {formatPrice(orderResult.total, orderResult.currency)}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
              <Truck className="w-4 h-4 text-sky-400 flex-shrink-0" />
              <span className="text-xs text-slate-300">
                Yetkazib berish: <span className="font-medium text-white">{deliveryStr}</span>
              </span>
            </div>
          </div>

          {/* Status timeline */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 mb-4">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-3">Keyingi qadamlar</p>
            <div className="space-y-3">
              {[
                { label: t("success.step.received"), desc: t("success.step.receivedDesc"), done: true },
                { label: t("success.step.processing"), desc: t("success.step.processingDesc"), done: false, active: true },
                { label: t("success.step.shipping"), desc: t("success.step.shippingDesc"), done: false },
                { label: t("success.step.delivered"), desc: deliveryStr, done: false },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      s.done
                        ? "bg-emerald-500 text-white"
                        : (s as { active?: boolean }).active
                          ? "bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/40"
                          : "bg-slate-800 text-slate-600"
                    }`}
                  >
                    {s.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0 pb-0.5">
                    <p className={`text-sm font-medium ${s.done || (s as { active?: boolean }).active ? "text-white" : "text-slate-500"}`}>
                      {s.label}
                    </p>
                    <p className="text-[11px] text-slate-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notification tip */}
          {hasTelegram ? (
            <div className="flex items-start gap-2.5 p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl mb-6">
              <Bell className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-sky-200 leading-relaxed">{t("success.notify.tg")}</p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl mb-6">
              <Bell className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300 leading-relaxed">
                Buyurtma raqamingizni <span className="font-semibold">#{orderResult.code}</span> saqlab qo'ying.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={onViewOrders}
              className="w-full py-3.5 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingBag className="w-5 h-5" />
              {t("success.viewOrder")}
            </button>
            <button
              onClick={onContinueShopping}
              className="w-full py-3 rounded-2xl font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all"
            >
              {t("success.continueShopping")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const SuccessView = memo(SuccessViewInner);
