import { Home, LayoutGrid, ShoppingBag, Tag, User } from "lucide-react";
import { haptic } from "./storefront-theme";
import { useT } from "../../i18n";

export type StoreTab = "home" | "catalog" | "cart" | "promotions" | "profile";

const TABS: Array<{ id: StoreTab; labelKey: string; Icon: typeof Home }> = [
  { id: "home",       labelKey: "store.tab.home",    Icon: Home },
  { id: "catalog",    labelKey: "store.tab.catalog",  Icon: LayoutGrid },
  { id: "cart",       labelKey: "store.tab.cart",     Icon: ShoppingBag },
  { id: "promotions", labelKey: "store.tab.promo",    Icon: Tag },
  { id: "profile",    labelKey: "store.tab.profile",  Icon: User },
];

export function BottomNav({
  active,
  cartCount,
  primaryColor,
  hideCart,
  onChange,
}: {
  active: StoreTab;
  cartCount: number;
  primaryColor?: string;
  /** B2B rejimida savat yo'q — tab ham ko'rsatilmaydi. */
  hideCart?: boolean;
  onChange: (tab: StoreTab) => void;
}) {
  const accent = primaryColor || "#10b981";
  const { t } = useT();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Gradient fade behind nav */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: 90,
          background: "linear-gradient(to top, #0d0d14 60%, transparent)",
        }}
      />

      {/* Nav pill container */}
      <div className="relative px-4 pb-3">
        <div
          className="flex items-center justify-around rounded-2xl"
          style={{
            backgroundColor: "#1a1a26",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {TABS.filter((tab) => !(hideCart && tab.id === "cart")).map(({ id, labelKey, Icon }) => {
            const isActive = active === id;
            const showBadge = id === "cart" && cartCount > 0;
            const label = t(labelKey);

            return (
              <button
                key={id}
                onClick={() => {
                  if (!isActive) haptic.light();
                  onChange(id);
                }}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className="relative flex flex-col items-center justify-center gap-0.5 py-2.5 flex-1 min-h-[52px] active:opacity-70 transition-opacity"
              >
                {/* Active pill background */}
                {isActive && (
                  <span
                    className="absolute inset-x-2 inset-y-1.5 rounded-xl pointer-events-none"
                    style={{ backgroundColor: accent + "18" }}
                  />
                )}

                {/* Icon with badge */}
                <div className="relative z-10">
                  <Icon
                    className="transition-all"
                    style={{
                      width: 20, height: 20,
                      color: isActive ? accent : "#52526a",
                      strokeWidth: isActive ? 2.5 : 2,
                      transform: isActive ? "scale(1.08)" : "scale(1)",
                    }}
                  />
                  {showBadge && (
                    <span
                      className="absolute -top-1.5 -right-2 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5"
                      style={{ backgroundColor: accent, lineHeight: 1 }}
                    >
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span
                  className="text-[9px] leading-none z-10 transition-all"
                  style={{
                    color: isActive ? accent : "#52526a",
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
