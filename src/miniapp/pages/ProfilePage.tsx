import { User, Receipt, Heart, Phone, Globe, ChevronRight } from "lucide-react";
import { fmtMoney, fmtDate } from "../lib/format";
import type { OrderSummary } from "../lib/api";

interface Props {
  user: { firstName: string | null; username: string | null } | null;
  shop: { name: string; currency: string } | null;
  orders: OrderSummary[];
  favoriteCount: number;
  onOrderClick?: (orderId: string) => void;
}

const orderStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Kutilmoqda", color: "text-amber-500 bg-amber-50" },
  confirmed: { label: "Tasdiqlandi", color: "text-blue-500 bg-blue-50" },
  preparing: { label: "Tayyorlanmoqda", color: "text-blue-500 bg-blue-50" },
  shipping: { label: "Yetkazilmoqda", color: "text-violet-500 bg-violet-50" },
  delivered: { label: "Yetkazildi", color: "text-emerald-500 bg-emerald-50" },
  cancelled: { label: "Bekor qilindi", color: "text-red-500 bg-red-50" },
};

export default function ProfilePage({ user, shop, orders, favoriteCount }: Props) {
  const totalSpent = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
  const completed = orders.filter((o) => o.status === "delivered").length;

  const fullName = user?.firstName ?? user?.username ?? "Mehmon";
  const initial = (fullName[0] ?? "M").toUpperCase();

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-br from-violet-600 to-violet-700 px-5 pt-6 pb-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">
            {initial}
          </div>
          <div>
            <h1 className="text-xl font-bold">{fullName}</h1>
            {user?.username && <p className="text-sm text-white/80">@{user.username}</p>}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-7">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <Receipt className="w-5 h-5 mx-auto text-violet-600 mb-1" />
              <p className="text-lg font-bold text-gray-900">{orders.length}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Buyurtma</p>
            </div>
            <div>
              <Heart className="w-5 h-5 mx-auto text-pink-500 mb-1" />
              <p className="text-lg font-bold text-gray-900">{favoriteCount}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Sevimli</p>
            </div>
            <div>
              <User className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
              <p className="text-lg font-bold text-gray-900">{completed}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Yetkazildi</p>
            </div>
          </div>
          {totalSpent > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm text-gray-500">Jami xarid</span>
              <span className="text-base font-bold text-gray-900">{fmtMoney(totalSpent, shop?.currency)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 mt-5 pb-6">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Mening buyurtmalarim</p>
            <span className="text-xs text-gray-400">{orders.length}</span>
          </div>
          {orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">Hali buyurtma yo'q</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {orders.slice(0, 10).map((o) => {
                const st = orderStatusConfig[o.status] ?? { label: o.status, color: "text-gray-500 bg-gray-100" };
                return (
                  <div key={o.id} className="p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-medium text-gray-900">{o.orderNumber}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{fmtDate(o.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      <span className="text-sm font-bold text-gray-900">{fmtMoney(o.total, shop?.currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 mt-4 overflow-hidden">
          <SettingsRow icon={Globe} label="Til" value="O'zbek" />
          <div className="border-t border-gray-100" />
          <SettingsRow icon={Phone} label="Aloqa" value={shop?.name ?? "Do'kon"} />
        </div>
      </div>
    </div>
  );
}

function SettingsRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <button className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50">
      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
        <Icon className="w-4 h-4 text-gray-600" />
      </div>
      <span className="text-sm text-gray-900 flex-1 text-left">{label}</span>
      <span className="text-xs text-gray-500">{value}</span>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </button>
  );
}
