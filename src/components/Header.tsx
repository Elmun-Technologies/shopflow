import { Search, Bell, Mail, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const notifications = [
  { id: 1, text: "New order #7524 received", time: "2 min ago", type: "order" },
  { id: 2, text: "Low stock alert: Wireless Headphones", time: "15 min ago", type: "alert" },
  { id: 3, text: "Customer review submitted", time: "1 hour ago", type: "review" },
];

const messages = [
  { id: 1, name: "Aziz Karimov", text: "Buyurtma qachon yetkaziladi?", time: "5 daq oldin" },
  { id: 2, name: "Malika Tursunova", text: "Rahmat, hammasi yaxshi!", time: "30 daq oldin" },
  { id: 3, name: "Bekzod Yo'ldoshev", text: "Mahsulot mavjudmi?", time: "2 soat oldin" },
];

export default function Header() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (messagesRef.current && !messagesRef.current.contains(target)) {
        setMessagesOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNotificationsOpen(false);
        setMessagesOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <label className="relative flex-1">
          <span className="sr-only">Qidirish</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search orders, products, customers..."
            aria-label="Qidirish"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
        </label>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Messages */}
        <div className="relative" ref={messagesRef}>
          <button
            onClick={() => {
              setMessagesOpen(!messagesOpen);
              setNotificationsOpen(false);
              setProfileOpen(false);
            }}
            aria-label="Xabarlar"
            aria-expanded={messagesOpen}
            className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <Mail className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
          </button>

          <AnimatePresence>
            {messagesOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                role="menu"
                className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-slate-700">
                  <h3 className="text-sm font-semibold text-white">Xabarlar</h3>
                </div>
                <div className="py-1">
                  {messages.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors"
                    >
                      <p className="text-sm text-white font-medium">{m.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{m.text}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{m.time}</p>
                    </button>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-slate-700">
                  <button type="button" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                    Barcha xabarlar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setMessagesOpen(false);
              setProfileOpen(false);
            }}
            aria-label="Bildirishnomalar"
            aria-expanded={notificationsOpen}
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
                role="menu"
                className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-slate-700">
                  <h3 className="text-sm font-semibold text-white">Notifications</h3>
                </div>
                <div className="py-1">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors"
                    >
                      <p className="text-sm text-slate-200">{n.text}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{n.time}</p>
                    </button>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-slate-700">
                  <button type="button" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                    View all notifications
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotificationsOpen(false);
              setMessagesOpen(false);
            }}
            aria-label="Profil menyusi"
            aria-expanded={profileOpen}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all"
          >
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              JD
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-white">John Doe</p>
              <p className="text-xs text-slate-500">Admin</p>
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
                className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => setProfileOpen(false)}
                    className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(false)}
                    className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                  >
                    Account Settings
                  </button>
                  <div className="border-t border-slate-700 my-1" />
                  <button
                    type="button"
                    onClick={() => setProfileOpen(false)}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700/50 transition-colors"
                  >
                    Sign Out
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
