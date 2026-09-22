import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, LocateFixed, LogOut, MapPin, Navigation, PackageCheck, Phone, Play, Square, Truck, XCircle } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useAppToast } from "./ui/Toast";

type Vehicle = { id: string; plateNumber: string; make: string | null; model: string | null; status: string };
type Shift = { id: string; status: string; startedAt: string; vehicle: Vehicle | null };
type Stop = { id: string; sequence: number; status: string; lat: string | number; lng: string | number; address: string | null; deliveryOrder: { order: { code: string; shippingAddress: string | null; customer: { name: string; phone: string | null } | null } } };
type Run = { id: string; code: string; status: string; vehicle: Vehicle | null; stops: Stop[] };

export default function DriverPage() {
  const { user, logout } = useAuth();
  const toast = useAppToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [shift, setShift] = useState<Shift | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gps, setGps] = useState<"off" | "waiting" | "active" | "error">("off");
  const watchId = useRef<number | null>(null);
  const lastSentAt = useRef(0);

  const reload = useCallback(async () => {
    try {
      const [vehicleRows, currentShift, currentRun] = await Promise.all([
        api<Vehicle[]>("/logistics/vehicles"), api<Shift | null>("/logistics/driver/shifts/current"), api<Run | null>("/logistics/driver/run"),
      ]);
      setVehicles(vehicleRows.filter((v) => ["AVAILABLE", "IN_USE"].includes(v.status)));
      setShift(currentShift); setRun(currentRun);
      if (currentShift?.vehicle?.id) setVehicleId(currentShift.vehicle.id);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ma’lumot yuklanmadi"); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { void reload(); }, [reload]);

  const stopGps = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null; setGps("off");
  }, []);

  const startGps = useCallback(() => {
    if (!navigator.geolocation) return setGps("error");
    if (watchId.current != null) return;
    setGps("waiting");
    watchId.current = navigator.geolocation.watchPosition((position) => {
      setGps("active");
      const now = Date.now();
      if (now - lastSentAt.current < 10_000) return;
      lastSentAt.current = now;
      void api("/logistics/driver/location", { method: "POST", body: {
        lat: position.coords.latitude, lng: position.coords.longitude,
        accuracy: position.coords.accuracy, speed: position.coords.speed ?? undefined,
        heading: position.coords.heading ?? undefined, altitude: position.coords.altitude ?? undefined,
        capturedAt: new Date(position.timestamp).toISOString(),
      } }).catch(() => setGps("error"));
    }, () => setGps("error"), { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 });
  }, []);

  useEffect(() => { if (shift?.status === "ACTIVE") startGps(); else stopGps(); return stopGps; }, [shift?.status, startGps, stopGps]);

  const startShift = async () => {
    setBusy(true);
    try { const value = await api<Shift>("/logistics/driver/shifts/start", { method: "POST", body: { vehicleId: vehicleId || undefined } }); setShift(value); toast.success("Smena boshlandi"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Smena boshlanmadi"); }
    finally { setBusy(false); }
  };
  const finishShift = async () => {
    setBusy(true);
    try { await api("/logistics/driver/shifts/finish", { method: "POST" }); setShift(null); stopGps(); toast.success("Smena yakunlandi"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Smena yakunlanmadi"); }
    finally { setBusy(false); }
  };
  const updateStop = async (stop: Stop, status: "ARRIVED" | "COMPLETED" | "FAILED") => {
    setBusy(true);
    try { await api(`/logistics/driver/stops/${stop.id}`, { method: "PATCH", body: { status } }); await reload(); toast.success(status === "COMPLETED" ? "Buyurtma topshirildi" : "Holat yangilandi"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Holat yangilanmadi"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-400" /></div>;
  const nextStop = run?.stops.find((s) => ["PENDING", "ARRIVED"].includes(s.status));
  return <div className="min-h-screen bg-slate-950 text-white pb-24">
    <header className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
      <div><p className="font-bold">ShopFlow Driver</p><p className="text-xs text-slate-400">{user?.name}</p></div>
      <button onClick={logout} className="p-2 rounded-xl bg-slate-900 text-slate-400"><LogOut className="w-5 h-5" /></button>
    </header>
    <main className="p-4 max-w-xl mx-auto space-y-4">
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${shift ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} /><span className="font-semibold">{shift ? "Smena faol" : "Smena boshlanmagan"}</span></div>{shift && <span className={`text-xs ${gps === "active" ? "text-emerald-400" : gps === "error" ? "text-rose-400" : "text-amber-400"}`}><LocateFixed className="inline w-4 h-4 mr-1" />GPS {gps}</span>}</div>
        {!shift ? <div className="mt-4 space-y-3"><select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3"><option value="">Mashinasiz ishlash</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber} · {[v.make, v.model].filter(Boolean).join(" ")}</option>)}</select><button disabled={busy} onClick={startShift} className="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold flex items-center justify-center gap-2"><Play className="w-5 h-5" /> Ishni boshlash</button></div> : <div className="mt-4 flex items-center justify-between"><div className="text-sm text-slate-400"><Truck className="inline w-4 h-4 mr-1" />{shift.vehicle?.plateNumber ?? "Mashinasiz"}<br/><Clock className="inline w-4 h-4 mr-1" />{new Date(shift.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} dan</div><button disabled={busy} onClick={finishShift} className="px-4 py-2.5 rounded-xl bg-rose-500/15 text-rose-400 font-medium flex gap-2"><Square className="w-4 h-4" /> Tugatish</button></div>}
      </section>

      {nextStop && <section className="rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-4 text-slate-950">
        <p className="text-xs font-bold uppercase opacity-70">Navbatdagi manzil · {nextStop.sequence}</p><h2 className="text-xl font-bold mt-1">{nextStop.deliveryOrder.order.customer?.name ?? "Mijoz"}</h2><p className="text-sm mt-2 flex gap-2"><MapPin className="w-5 h-5 shrink-0" />{nextStop.address || nextStop.deliveryOrder.order.shippingAddress || "Manzil yo‘q"}</p>
        <div className="grid grid-cols-2 gap-2 mt-4"><a href={`https://yandex.com/maps/?rtext=~${Number(nextStop.lat)},${Number(nextStop.lng)}&rtt=auto`} target="_blank" rel="noreferrer" className="py-3 rounded-xl bg-slate-950 text-white font-semibold flex items-center justify-center gap-2"><Navigation className="w-4 h-4" /> Navigatsiya</a>{nextStop.deliveryOrder.order.customer?.phone ? <a href={`tel:${nextStop.deliveryOrder.order.customer.phone}`} className="py-3 rounded-xl bg-white/80 font-semibold flex items-center justify-center gap-2"><Phone className="w-4 h-4" /> Qo‘ng‘iroq</a> : <span />}</div>
      </section>}

      <section><div className="flex items-center justify-between mb-2"><h2 className="font-semibold">Bugungi marshrut</h2>{run && <span className="text-xs text-slate-500">{run.code}</span>}</div>{!run ? <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-500"><PackageCheck className="w-9 h-9 mx-auto mb-2" />Marshrut hali biriktirilmagan</div> : <div className="space-y-2">{run.stops.map((stop) => <article key={stop.id} className={`rounded-2xl border p-3 ${stop.status === "COMPLETED" ? "bg-emerald-950/30 border-emerald-900" : stop.id === nextStop?.id ? "bg-slate-900 border-emerald-500" : "bg-slate-900 border-slate-800"}`}><div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-slate-800 grid place-items-center text-xs font-bold">{stop.sequence}</span><div className="flex-1"><div className="flex justify-between gap-2"><p className="font-medium">#{stop.deliveryOrder.order.code} · {stop.deliveryOrder.order.customer?.name ?? "—"}</p>{stop.status === "COMPLETED" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}</div><p className="text-xs text-slate-400 mt-1">{stop.address || stop.deliveryOrder.order.shippingAddress}</p>{stop.id === nextStop?.id && <div className="grid grid-cols-3 gap-2 mt-3"><button disabled={busy} onClick={() => updateStop(stop, "ARRIVED")} className="py-2 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-semibold">Yetib keldim</button><button disabled={busy} onClick={() => updateStop(stop, "COMPLETED")} className="py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold">Topshirildi</button><button disabled={busy} onClick={() => updateStop(stop, "FAILED")} className="py-2 rounded-lg bg-rose-500/15 text-rose-400 text-xs font-semibold"><XCircle className="inline w-3 h-3" /> Xato</button></div>}</div></div></article>)}</div>}</section>
    </main>
  </div>;
}
