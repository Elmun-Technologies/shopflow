import { Search, ChevronDown, Menu, LogOut, Settings } from "lucide-react";
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
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setProfileOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const initials = (user?.name ?? "?")
    .split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const roleColor: Record<string, string> = {
    OWNER: "#5FA340", ADMIN: "#3b82f6", MANAGER: "#8b5cf6", AGENT: "#f59e0b",
  };
  const accentColor = roleColor[user?.role ?? ""] ?? "#5FA340";

  return (
    <header
      className="h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40"
      style={{
        backgroundColor: "rgba(250,250,245,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #E5E5DA",
      }}
    >
      {/* Left: mobile menu + search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {onMobileMenuOpen && (
          <button
            onClick={onMobileMenuOpen}
            aria-label={t("header.menu")}
            className="md:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Search */}
        <label className="relative flex-1 group">
          <span className="sr-only">{t("header.search")}</span>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors"
            style={{ color: "#94a3b8" }}
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={t("header.searchPlaceholder")}
            aria-label={t("header.search")}
            className="w-full rounded-xl pl-9 pr-4 py-2 text-sm transition-all focus:outline-none"
            style={{
              backgroundColor: "#F4F4ED",
              border: "1px solid #E5E5DA",
              color: "#1F3327",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#7BC056";
              e.target.style.boxShadow = "0 0 0 3px rgba(123,192,86,0.12)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#E5E5DA";
              e.target.style.boxShadow = "none";
            }}
          />
        </label>
      </div>

      {/* Right: notifs + profile */}
      <div className="flex items-center gap-2">
        <NotificationsPanel onNavigate={onNotifNavigate} />

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            aria-label={t("header.profileMenu")}
            aria-expanded={profileOpen}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl hover:bg-cream-100 transition-all group"
          >
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {initials || "?"}
            </div>

            {/* Name + tenant */}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold leading-tight" style={{ color: "#1F3327" }}>
                {user?.name ?? "—"}
              </p>
              <p className="text-[10px] leading-tight" style={{ color: "#94a3b8" }}>
                {tenant?.name ?? user?.role ?? ""}
              </p>
            </div>

            <ChevronDown
              className="w-3.5 h-3.5 transition-transform"
              style={{
                color: "#94a3b8",
                transform: profileOpen ? "rotate(180deg)" : undefined,
              }}
            />
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                role="menu"
                className="absolute right-0 top-full mt-2 w-60 rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: "#FAFAF5",
                  border: "1px solid #E5E5DA",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                }}
              >
                {/* User info */}
                <div className="px-4 py-3.5" style={{ borderBottom: "1px solid #E5E5DA" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: accentColor }}
                    >
                      {initials || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#1F3327" }}>
                        {user?.name}
                      </p>
                      <p className="text-xs truncate" style={{ color: "#94a3b8" }}>
                        {user?.email}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: accentColor + "20", color: accentColor }}
                        >
                          {user?.role}
                        </span>
                        {tenant?.slug && (
                          <span className="text-[10px]" style={{ color: "#cbd5e1" }}>
                            /{tenant.slug}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="py-1">
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-cream-100"
                    style={{ color: "#475569" }}
                  >
                    <Settings className="w-4 h-4" style={{ color: "#94a3b8" }} />
                    Sozlamalar
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-red-50"
                    style={{ color: "#ef4444" }}
                  >
                    <LogOut className="w-4 h-4" />
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
