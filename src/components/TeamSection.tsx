// Settings → Jamoa tab — xodimlarni boshqarish.
// Owner/Admin yangi xodim taklif qiladi, role beradi, deaktivlashtiradi yoki o'chiradi.
// Hozircha SMTP yo'q — taklif javobida temp parol qaytadi, admin xodimga qo'lda yuboradi.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Loader2, Mail, Shield, Trash2, Check, X, Copy, Users } from "lucide-react";
import { api } from "../api/client";
import { useAppToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmDialog";

type Role = "OWNER" | "ADMIN" | "MANAGER" | "AGENT";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<Role, { label: string; color: string; description: string }> = {
  OWNER: { label: "Egasi", color: "bg-purple-100 text-purple-700 border-purple-300", description: "To'liq nazorat" },
  ADMIN: { label: "Admin", color: "bg-leaf-100 text-forest-700 border-leaf-300/60", description: "Xodimlar va sozlamalar" },
  MANAGER: { label: "Menejer", color: "bg-sky-100 text-sky-700 border-sky-300", description: "Buyurtma va mahsulotlar" },
  AGENT: { label: "Agent", color: "bg-cream-200 text-slate-700 border-cream-300", description: "Faqat chat va buyurtmalar" },
};

const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "MANAGER", "AGENT"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("uz-UZ", { dateStyle: "medium" });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

interface Props {
  currentUserId?: string;
  currentUserRole?: Role;
}

export function TeamSection({ currentUserId, currentUserRole }: Props) {
  const toast = useAppToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "AGENT" as Role });
  const [inviting, setInviting] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const canManage = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  const reload = async () => {
    try {
      const res = await api<TeamUser[]>("/settings/users");
      setUsers(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xodimlar ro'yxatini yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRole = async (userId: string, role: Role) => {
    setBusyId(userId);
    try {
      await api(`/settings/users/${userId}`, { method: "PATCH", body: { role } });
      toast.success("Rol yangilandi");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rolni o'zgartirib bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (user: TeamUser) => {
    const ok = await confirm({
      title: user.active ? "Xodimni deaktivlashtirilsinmi?" : "Xodim yana faollashtirilsinmi?",
      description: user.active
        ? "Xodim panel'ga kira olmaydi. Ma'lumotlari saqlanib qoladi."
        : "Xodim panel'ga qaytadan kira oladi.",
      confirmText: user.active ? "Deaktivlashtirish" : "Faollashtirish",
      kind: user.active ? "danger" : "default",
    });
    if (!ok) return;
    setBusyId(user.id);
    try {
      await api(`/settings/users/${user.id}`, { method: "PATCH", body: { active: !user.active } });
      toast.success(user.active ? "Deaktivlashtirildi" : "Faollashtirildi");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (user: TeamUser) => {
    const ok = await confirm({
      title: "Xodim o'chirilsinmi?",
      description: `${user.name} (${user.email}) batamom o'chiriladi. Bu amalni qaytarib bo'lmaydi.`,
      confirmText: "O'chirish",
      kind: "danger",
    });
    if (!ok) return;
    setBusyId(user.id);
    try {
      await api(`/settings/users/${user.id}`, { method: "DELETE" });
      toast.success("Xodim o'chirildi");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O'chirib bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email.trim() || !inviteForm.name.trim()) return;
    setInviting(true);
    try {
      const res = await api<{ user: TeamUser; tempPassword: string }>("/settings/users", {
        method: "POST",
        body: {
          email: inviteForm.email.trim().toLowerCase(),
          name: inviteForm.name.trim(),
          role: inviteForm.role,
        },
      });
      setInviteOpen(false);
      setInviteForm({ email: "", name: "", role: "AGENT" });
      setTempPasswordModal({ email: res.user.email, password: res.tempPassword });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Taklif yuborib bo'lmadi");
    } finally {
      setInviting(false);
    }
  };

  const copyPassword = async () => {
    if (!tempPasswordModal) return;
    try {
      await navigator.clipboard.writeText(tempPasswordModal.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Ko'chirib bo'lmadi");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-forest-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-leaf-500" />
            Jamoa a'zolari
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Xodimlarni taklif qiling, rollar bering yoki deaktivlashtiring.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-leaf-400 hover:bg-leaf-500 rounded-lg text-sm font-medium text-forest-800 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Yangi xodim
          </button>
        )}
      </div>

      <div className="rounded-xl border border-cream-300 bg-white overflow-hidden">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yuklanmoqda…
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-2 text-cream-300" />
            Hali jamoa a'zolari yo'q
          </div>
        ) : (
          <div className="divide-y divide-cream-300/60">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const isOwner = user.role === "OWNER";
              const meta = ROLE_LABELS[user.role];
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-3 p-4 ${!user.active ? "opacity-60" : ""}`}
                >
                  <div className="w-10 h-10 rounded-full bg-leaf-100 text-forest-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {initials(user.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-forest-800 truncate">
                        {user.name}
                        {isSelf && <span className="text-xs text-slate-400 font-normal ml-1.5">(siz)</span>}
                      </p>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.color}`}>
                        {meta.label}
                      </span>
                      {!user.active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cream-200 text-slate-500">Deaktiv</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" /> {user.email}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Qo'shilgan: {formatDate(user.createdAt)}
                    </p>
                  </div>

                  {canManage && !isOwner && !isSelf && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <select
                        value={user.role}
                        onChange={(e) => updateRole(user.id, e.target.value as Role)}
                        disabled={busyId === user.id}
                        className="text-xs bg-cream-100 border border-cream-300 rounded-lg px-2 py-1.5 text-forest-800 focus:outline-none focus:border-leaf-500/60 disabled:opacity-50"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => toggleActive(user)}
                        disabled={busyId === user.id}
                        className={`p-1.5 rounded-lg disabled:opacity-50 ${
                          user.active
                            ? "text-slate-500 hover:text-amber-600 hover:bg-cream-100"
                            : "text-emerald-600 hover:bg-leaf-100"
                        }`}
                        title={user.active ? "Deaktivlashtirish" : "Faollashtirish"}
                      >
                        {busyId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                          user.active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => remove(user)}
                        disabled={busyId === user.id}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        title="O'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-cream-100/50 border border-cream-300 p-3 flex items-start gap-2">
        <Shield className="w-4 h-4 text-leaf-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600">
          <p className="font-medium text-forest-800 mb-1">Rollar haqida</p>
          <ul className="space-y-0.5">
            <li><strong>Egasi (Owner):</strong> to'liq nazorat. O'zgartirib bo'lmaydi.</li>
            <li><strong>Admin:</strong> xodimlar, sozlamalar, integratsiyalar.</li>
            <li><strong>Menejer:</strong> buyurtma, mahsulot, chat, marketing.</li>
            <li><strong>Agent:</strong> faqat chat va buyurtma jarayoni.</li>
          </ul>
        </div>
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={() => setInviteOpen(false)}>
          <motion.form
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onSubmit={invite}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-cream-300 rounded-2xl p-5 max-w-md w-full"
          >
            <h3 className="text-lg font-semibold text-forest-800 mb-1">Yangi xodim taklif qilish</h3>
            <p className="text-xs text-slate-500 mb-4">
              Xodim panel'ga kirishi uchun parol generatsiya qilinadi va sizga ko'rsatiladi.
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-slate-500 mb-1 block">Ism Familya</span>
                <input
                  type="text"
                  required
                  autoFocus
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="Aziza Karimova"
                  className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500 mb-1 block">Email</span>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="aziza@example.com"
                  className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500 mb-1 block">Rol</span>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as Role })}
                  className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r].label} — {ROLE_LABELS[r].description}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="px-3 py-2 rounded-lg text-sm bg-cream-100 hover:bg-cream-200 text-slate-700"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={inviting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 text-forest-800 font-medium"
              >
                {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                Taklif qilish
              </button>
            </div>
          </motion.form>
        </div>
      )}

      {/* Temp password modal */}
      {tempPasswordModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border border-cream-300 rounded-2xl p-5 max-w-md w-full"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-leaf-100 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-forest-700" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-forest-800">Xodim qo'shildi</h3>
                <p className="text-xs text-slate-500">{tempPasswordModal.email}</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              <p className="text-xs font-medium text-amber-800 mb-2">
                ⚠️ Bu parol bir martagina ko'rsatiladi. Xodimga yuboring va ular birinchi kirishdan keyin o'zgartiradi.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border border-amber-300 rounded px-3 py-2 text-sm font-mono text-amber-900 select-all">
                  {tempPasswordModal.password}
                </code>
                <button
                  onClick={copyPassword}
                  className="px-3 py-2 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-medium flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Ko'chirildi" : "Ko'chirish"}
                </button>
              </div>
            </div>
            <button
              onClick={() => setTempPasswordModal(null)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 text-forest-800 font-medium"
            >
              Tushundim, yopish
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
