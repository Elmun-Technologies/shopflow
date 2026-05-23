import { Search, ChevronDown, Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n";
import { NotificationsPanel } from "./NotificationsPanel";

interface HeaderProps {
  onMobileMenuOpen?: () => void;
  onNotifNavigate?: (page: "orders" | "leads") => void;
}

export default function Header({ onMobileMenuOpen, onNotifNavigate }: HeaderProps = {}) {
  const { user, tenant, logout } = useAuth();
  const { t } = useT();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const initials = (user?.name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="h-16 bg-cream-50/80 backdrop-blur-md border-b border-cream-300 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
      {onMobileMenuOpen && (
        <button
          onClick={onMobileMenuOpen}
          aria-label={t("header.menu")}
          className="md:hidden mr-2 p-2 -ml-2 rounded-lg text-slate-700 hover:text-forest-900 hover:bg-cream-100"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <label className="relative flex-1">
          <span className="sr-only">{t("header.search")}</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={t("header.searchPlaceholder")}
            aria-label={t("header.search")}
            className="w-full bg-cream-100 border border-cream-300 rounded-lg pl-10 pr-4 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 focus:ring-1 focus:ring-leaf-500/20 transition-all"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <NotificationsPanel onNavigate={onNotifNavigate} />

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            aria-label={t("header.profileMenu")}
            aria-expanded={profileOpen}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg hover:bg-cream-100 transition-all"
          >
            <div className="w-8 h-8 bg-forest-700 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {initials || "?"}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-forest-800">{user?.name ?? "—"}</p>
              <p className="text-xs text-slate-500">{tenant?.name ?? user?.role ?? ""}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 bg-cream-100 border border-cream-300 rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-cream-300">
                  <p className="text-sm font-medium text-forest-800 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  <p className="text-[10px] text-forest-700 mt-1">
                    {tenant?.slug} · {user?.role}
                  </p>
                </div>
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-cream-200/50 transition-colors"
                  >
                    {t("sidebar.logout")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
