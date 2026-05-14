import { Search, Bell, Mail, ChevronDown, LogOut, Building2 } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../api/auth-context";

export default function Header() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, tenant, logout } = useAuth();
  const initials = user
    ? user.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")
    : "JD";
  const displayName = user?.name ?? "John Doe";
  const displayRole = user?.role ?? "Admin";

  const notifications = [
    { id: 1, text: "New order #7524 received", time: "2 min ago", type: "order" },
    { id: 2, text: "Low stock alert: Wireless Headphones", time: "15 min ago", type: "alert" },
    { id: 3, text: "Customer review submitted", time: "1 hour ago", type: "review" },
  ];

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Search + tenant badge */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        {tenant && (
          <div className="hidden md:flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-800/50 px-2.5 py-1.5 text-xs text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium text-white">{tenant.name}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-500 font-mono">{tenant.slug}</span>
          </div>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Qidirish..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Messages */}
        <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
          <Mail className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setProfileOpen(false);
            }}
            className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-slate-700">
                  <h3 className="text-sm font-semibold text-white">Notifications</h3>
                </div>
                <div className="py-1">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors"
                    >
                      <p className="text-sm text-slate-200">{n.text}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{n.time}</p>
                    </button>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-slate-700">
                  <button className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                    View all notifications
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all"
          >
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-white">{displayName}</p>
              <p className="text-xs text-slate-500">{displayRole}</p>
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
                className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="py-1">
                  {user && (
                    <div className="px-4 py-2 border-b border-slate-700">
                      <p className="text-sm text-white truncate">{user.email}</p>
                      <p className="text-xs text-slate-500">{user.role}</p>
                    </div>
                  )}
                  <button className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors">
                    Profil
                  </button>
                  <button className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors">
                    Sozlamalar
                  </button>
                  <div className="border-t border-slate-700 my-1" />
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      void logout();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700/50 transition-colors inline-flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Chiqish
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
