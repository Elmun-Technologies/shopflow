import { Home, LayoutGrid, ShoppingBag, Tag, User } from "lucide-react";

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
  onChange,
}: {
  active: StoreTab;
  cartCount: number;
  onChange: (tab: StoreTab) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          const showBadge = id === "cart" && cartCount > 0;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 transition-colors relative ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
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
