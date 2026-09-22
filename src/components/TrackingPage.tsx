import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, MapPin, Navigation, PackageCheck, Phone, Truck } from "lucide-react";
import { API_BASE } from "../api/client";

type Tracking = { orderCode: string; status: string; address: string | null; courier: { name: string; phone: string | null } | null; vehicle: { plateNumber: string; make: string | null; model: string | null } | null; sequence: number | null; stopsBefore: number | null; estimatedArrivalAt: string | null; location: { lat: number; lng: number; heading: number | null; capturedAt: string } | null; deliveredAt: string | null };
const steps = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];

export default function TrackingPage({ token }: { token: string }) {
  const [data, setData] = useState<Tracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const response = await fetch(`${API_BASE}/tracking/${encodeURIComponent(token)}`); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Buyurtma topilmadi"); if (active) { setData(body); setError(null); } }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Ma’lumot yuklanmadi"); }
    };
    void load(); const timer = window.setInterval(load, 20_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token]);
  if (error) return <div className="min-h-screen bg-cream-50 grid place-items-center p-6"><div className="text-center"><PackageCheck className="w-12 h-12 text-slate-300 mx-auto"/><h1 className="font-bold text-forest-800 mt-3">Kuzatuv mavjud emas</h1><p className="text-sm text-slate-500 mt-1">{error}</p></div></div>;
  if (!data) return <div className="min-h-screen bg-cream-50 grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-leaf-500" /></div>;
  const current = data.status === "PENDING" ? -1 : Math.max(0, steps.indexOf(data.status));
  return <div className="min-h-screen bg-cream-50 p-4"><main className="max-w-md mx-auto space-y-4">
    <header className="py-4 text-center"><p className="text-xs font-bold tracking-widest text-leaf-600 uppercase">ShopFlow Delivery</p><h1 className="text-2xl font-bold text-forest-900 mt-1">#{data.orderCode}</h1></header>
    <section className="rounded-3xl bg-forest-900 text-white p-5 shadow-xl"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-leaf-400 text-forest-900 grid place-items-center">{data.status === "DELIVERED" ? <CheckCircle2/> : <Truck/>}</div><div><p className="text-xs text-white/60">Buyurtma holati</p><h2 className="text-xl font-bold">{data.status === "DELIVERED" ? "Yetkazildi" : data.status === "IN_TRANSIT" ? "Kuryer yo‘lda" : data.status === "ASSIGNED" ? "Kuryer tayinlandi" : "Tayyorlanmoqda"}</h2></div></div>{data.stopsBefore != null && data.status !== "DELIVERED" && <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm">Sizdan oldin <strong>{data.stopsBefore} ta</strong> manzil bor</p>}</section>
    <section className="rounded-2xl border border-cream-300 bg-white p-4 space-y-4">{steps.map((step, index) => <div key={step} className="flex gap-3"><div className={`w-7 h-7 rounded-full grid place-items-center ${index <= current ? "bg-leaf-500 text-white" : "bg-cream-200 text-slate-400"}`}>{index < current || data.status === "DELIVERED" ? <CheckCircle2 className="w-4 h-4"/> : index + 1}</div><div><p className={`text-sm font-medium ${index <= current ? "text-forest-800" : "text-slate-400"}`}>{step === "ASSIGNED" ? "Kuryer tayinlandi" : step === "PICKED_UP" ? "Buyurtma olib ketildi" : step === "IN_TRANSIT" ? "Yo‘lda" : "Yetkazildi"}</p></div></div>)}</section>
    {data.location && data.status !== "DELIVERED" && <a href={`https://yandex.com/maps/?pt=${data.location.lng},${data.location.lat}&z=15&l=map`} target="_blank" rel="noreferrer" className="rounded-2xl border border-cream-300 bg-white p-4 flex items-center justify-between"><div className="flex gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center"><Navigation/></div><div><p className="font-semibold text-forest-800">Kuryerni xaritada ko‘rish</p><p className="text-xs text-slate-500">{new Date(data.location.capturedAt).toLocaleTimeString()} da yangilangan</p></div></div><Navigation className="w-5 h-5 text-slate-400"/></a>}
    <section className="rounded-2xl border border-cream-300 bg-white p-4 space-y-3"><div className="flex gap-3"><MapPin className="w-5 h-5 text-leaf-600 shrink-0"/><p className="text-sm text-forest-800">{data.address || "Manzil ko‘rsatilmagan"}</p></div>{data.estimatedArrivalAt && <div className="flex gap-3"><Clock className="w-5 h-5 text-amber-500"/><p className="text-sm">Taxminiy vaqt: {new Date(data.estimatedArrivalAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div>}{data.courier && <div className="flex items-center justify-between border-t border-cream-200 pt-3"><div><p className="text-xs text-slate-500">Kuryer</p><p className="font-medium text-forest-800">{data.courier.name} {data.vehicle ? `· ${data.vehicle.plateNumber}` : ""}</p></div>{data.courier.phone && <a href={`tel:${data.courier.phone}`} className="w-10 h-10 rounded-xl bg-leaf-100 text-forest-700 grid place-items-center"><Phone className="w-5 h-5"/></a>}</div>}</section>
  </main></div>;
}
