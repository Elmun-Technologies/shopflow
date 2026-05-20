import { Home, LayoutGrid, ShoppingBag, Tag, User } from "lucide-react";
import { haptic } from "./storefront-theme";

export type StoreTab = "home" | "catalog" | "cart" | "promotions" | "profile";

const TABS: Array<{ id: StoreTab; label: string; Icon: typeof Home }> = [
  { id: "home", label: "Bosh sahifa", Icon: Home },
  { id: "catalog", label: "Katalog", Icon: LayoutGrid },
  { id: "cart", label: "Savat", Icon: ShoppingBag },
  { id: "promotions", label: "Takliflar", Icon: Tag },
  { id: "profile", label: "Profile", Icon: User },
];

export function BottomNav({
  active,
  cartCount,
  primaryColor,
  onChange,
}: {
  active: StoreTab;
  cartCount: number;
  primaryColor?: string;
  onChange: (tab: StoreTab) => void;
}) {
  const accent = primaryColor || "#10b981";
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur border-t bg-slate-900/95 dark:bg-slate-900/95 border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.35)]"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="grid grid-cols-5">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          const showBadge = id === "cart" && cartCount > 0;
          return (
            <button
              key={id}
              onClick={() => {
                if (!isActive) haptic.light();
                onChange(id);
              }}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className="relative flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 min-h-[56px] transition-colors active:opacity-70"
              style={{ color: isActive ? accent : "#94a3b8" }}
            >
              {/* Active indicator pill */}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"
                  style={{ backgroundColor: accent }}
                />
              )}
              <div className="relative">
                <Icon className="w-5 h-5 transition-transform" strokeWidth={isActive ? 2.5 : 2} style={{ transform: isActive ? "scale(1.06)" : undefined }} />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-2.5 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1"
                    style={{ backgroundColor: accent }}
                  >
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-tight ${isActive ? "font-semibold" : "font-medium"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
