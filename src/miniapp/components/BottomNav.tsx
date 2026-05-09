import { Home, Grid3x3, ShoppingBag, Heart, User } from "lucide-react";

export type Tab = "home" | "catalog" | "cart" | "favorites" | "profile";

interface Props {
  active: Tab;
  cartCount: number;
  favoriteCount: number;
  onChange: (tab: Tab) => void;
}

export default function BottomNav({ active, cartCount, favoriteCount, onChange }: Props) {
  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType; badge?: number }> = [
    { id: "home", label: "Bosh sahifa", icon: Home },
    { id: "catalog", label: "Katalog", icon: Grid3x3 },
    { id: "cart", label: "Savat", icon: ShoppingBag, badge: cartCount },
    { id: "favorites", label: "Sevimlilar", icon: Heart, badge: favoriteCount },
    { id: "profile", label: "Profil", icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="flex flex-col items-center justify-center py-2.5 px-1 relative"
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? "text-violet-600" : "text-gray-400"}`} />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 ${isActive ? "text-violet-600 font-medium" : "text-gray-500"}`}>
                {tab.label}
              </span>
              {isActive && <div className="absolute top-0 w-8 h-0.5 bg-violet-600 rounded-b-full" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
