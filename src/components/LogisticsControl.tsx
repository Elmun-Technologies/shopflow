import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Car, CircleDot, Copy, Eye, Loader2, MapPinned, Navigation, Plus, Radio, RefreshCw, Send, SlidersHorizontal, Sparkles, UserRound, X } from "lucide-react";
import { api } from "../api/client";
import { useAppToast } from "./ui/Toast";

type Location = { lat: number; lng: number; accuracy?: number | null; speed?: number | null; heading?: number | null; capturedAt: string };
type LiveCourier = {
  id: string; name: string; position: string;
  shift: { id: string; status: string; startedAt: string; vehicle?: Vehicle | null } | null;
  location: Location | null;
};
type Employee = { id: string; position: string; phone: string | null; canDrive: boolean; active: boolean; user: { id: string; name: string; email: string; active: boolean } };
type Vehicle = { id: string; plateNumber: string; make: string | null; model: string | null; color: string | null; status: string; defaultDriver?: { id: string; user: { name: string; email: string } } | null };
type TeamUser = { id: string; name: string; email: string; active: boolean };
type PoolDelivery = { id: string; status: string; scheduledAt: string | null; priority: number; weightKg: number | null; volumeM3: number | null; windowStartAt: string | null; windowEndAt: string | null; serviceMinutes: number; lat: number; lng: number; order: { code: string; shippingAddress: string | null; customer: { name: string; phone: string | null } | null } };
type LogisticsAnalytics = { total: number; delivered: number; failed: number; successRate: number; averageDeliveryMinutes: number | null; couriers: Array<{ id: string; name: string; delivered: number; failed: number }> };
type DeliveryProof = { id: string; type: string; fileUrl: string | null; note: string | null; createdByName: string | null; createdAt: string };
type DeliveryRun = { id: string; code: string; status: string; totalDistanceMeters: number | null; driver: { user: { name: string } }; vehicle: Vehicle | null; stops: Array<{ id: string; sequence: number; status: string; deliveryOrder: { id: string; trackingToken: string | null; order: { code: string; shippingAddress: string | null; customer: { name: string } | null } } }> };
type PlanningDraft = { id: string; code: string; priority: number; weightKg: string; volumeM3: string; windowStartAt: string; windowEndAt: string; serviceMinutes: number };
type LogisticsTab = "live" | "routes" | "couriers" | "fleet";

type YMap = { geoObjects: { removeAll(): void; add(object: unknown): void }; setBounds(bounds: number[][], options?: object): void; destroy(): void };
type YMapsApi = {
  ready(callback: () => void): void;
  Map: new (element: HTMLElement, state: object, options?: object) => YMap;
  Placemark: new (coordinates: number[], properties?: object, options?: object) => unknown;
};
declare global { interface Window { ymaps?: YMapsApi; } }

let yandexLoader: Promise<YMapsApi> | null = null;
function loadYandexMaps(apiKey: string): Promise<YMapsApi> {
  if (window.ymaps) return Promise.resolve(window.ymaps);
  if (yandexLoader) return yandexLoader;
  yandexLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=uz_UZ`;
    script.async = true;
    script.onload = () => window.ymaps?.ready(() => window.ymaps ? resolve(window.ymaps) : reject(new Error("Yandex Maps yuklanmadi")));
    script.onerror = () => reject(new Error("Yandex Maps skripti yuklanmadi"));
    document.head.appendChild(script);
  });
  return yandexLoader;
}

function LiveMap({ couriers, apiKey }: { couriers: LiveCourier[]; apiKey?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<YMap | null>(null);
  const key = apiKey || (import.meta.env.VITE_YANDEX_MAPS_API_KEY as string | undefined);

  useEffect(() => {
    if (!key || !host.current) return;
    let cancelled = false;
    loadYandexMaps(key).then((ymaps) => {
      if (cancelled || !host.current) return;
      if (!map.current) map.current = new ymaps.Map(host.current, { center: [41.3111, 69.2797], zoom: 11, controls: ["zoomControl"] });
      map.current.geoObjects.removeAll();
      const points = couriers.filter((c) => c.location).map((c) => [c.location!.lat, c.location!.lng]);
      for (const courier of couriers) {
        if (!courier.location) continue;
        map.current.geoObjects.add(new ymaps.Placemark(
          [courier.location.lat, courier.location.lng],
          { balloonContentHeader: courier.name, balloonContentBody: `${courier.shift?.vehicle?.plateNumber ?? "Mashinasiz"}<br/>${new Date(courier.location.capturedAt).toLocaleString()}` },
          { preset: courier.shift?.status === "ACTIVE" ? "islands#greenAutoIcon" : "islands#grayAutoIcon" },
        ));
      }
      if (points.length > 1) map.current.setBounds(points, { checkZoomRange: true, zoomMargin: 45 });
      else if (points.length === 1) map.current.setBounds(points, { maxZoom: 15 });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [couriers, key]);

  useEffect(() => () => { map.current?.destroy(); map.current = null; }, []);

  if (!key) return (
    <div className="h-96 rounded-2xl border border-dashed border-amber-300 bg-amber-50 flex flex-col items-center justify-center text-center p-6">
      <MapPinned className="w-10 h-10 text-amber-500 mb-3" />
      <p className="font-semibold text-amber-900">Yandex Maps API kaliti kiritilmagan</p>
      <p className="text-sm text-amber-700 mt-1">Sozlamalar → Integratsiyalar bo‘limida tenant uchun Yandex Maps kalitini kiriting.</p>
    </div>
  );
  return <div ref={host} className="h-96 rounded-2xl overflow-hidden border border-cream-300 bg-cream-100" />;
}

export default function LogisticsControl() {
  const toast = useAppToast();
  const [tab, setTab] = useState<LogisticsTab>("live");
  const [live, setLive] = useState<LiveCourier[]>([]);
  const [yandexKey, setYandexKey] = useState<string>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [pool, setPool] = useState<PoolDelivery[]>([]);
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [analytics, setAnalytics] = useState<LogisticsAnalytics | null>(null);
  const [proofAudit, setProofAudit] = useState<{ code: string; proofs: DeliveryProof[] } | null>(null);
  const [planningDraft, setPlanningDraft] = useState<PlanningDraft | null>(null);
  const [selectedDeliveries, setSelectedDeliveries] = useState<Set<string>>(new Set());
  const [routeDraft, setRouteDraft] = useState({ driverId: "", vehicleId: "", startLat: "41.3111", startLng: "69.2797" });
  const [loading, setLoading] = useState(true);
  const [vehicleForm, setVehicleForm] = useState(false);
  const [courierForm, setCourierForm] = useState(false);
  const [courierDraft, setCourierDraft] = useState({ userId: "", position: "COURIER", phone: "", employeeCode: "", canDrive: true });
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ plateNumber: "", make: "", model: "", color: "", defaultDriverId: "" });

  const reload = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [liveRows, employeeRows, vehicleRows, userRows, poolRows, runRows, analyticsRow, runtime] = await Promise.all([
        api<LiveCourier[]>("/logistics/live"), api<Employee[]>("/logistics/employees"), api<Vehicle[]>("/logistics/vehicles"), api<TeamUser[]>("/settings/users"), api<PoolDelivery[]>("/logistics/dispatch/pool"), api<DeliveryRun[]>("/logistics/runs"), api<LogisticsAnalytics>("/logistics/analytics"), api<{ YANDEX_MAPS_API_KEY?: string }>("/tenant-secrets/runtime"),
      ]);
      setLive(liveRows); setEmployees(employeeRows); setVehicles(vehicleRows); setUsers(userRows); setPool(poolRows); setRuns(runRows); setAnalytics(analyticsRow); setYandexKey(runtime.YANDEX_MAPS_API_KEY);
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : "Logistika ma’lumotlari yuklanmadi");
    } finally { if (!quiet) setLoading(false); }
  }, [toast]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (tab !== "live") return;
    const timer = window.setInterval(() => void reload(true), 15_000);
    return () => window.clearInterval(timer);
  }, [reload, tab]);

  const copyTrackingLink = async (token: string) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/track/${token}`); toast.success("Tracking havolasi nusxalandi"); }
    catch { toast.error("Havolani nusxalab bo‘lmadi"); }
  };
  const openProofAudit = async (deliveryId: string, code: string) => {
    try { const proofs = await api<DeliveryProof[]>(`/logistics/deliveries/${deliveryId}/proofs`); setProofAudit({ code, proofs }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Tasdiqlar yuklanmadi"); }
  };
  const sendTrackingLink = async (deliveryId: string) => {
    try { await api(`/logistics/deliveries/${deliveryId}/send-tracking`, { method: "POST", body: { origin: window.location.origin } }); toast.success("Tracking havolasi mijozga yuborildi"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Tracking havolasi yuborilmadi"); }
  };
  const retryDelivery = async (deliveryId: string) => {
    if (!window.confirm("Buyurtmani qayta yetkazish navbatiga qaytarasizmi?")) return;
    try { await api(`/logistics/deliveries/${deliveryId}/retry`, { method: "POST" }); await reload(true); toast.success("Buyurtma qayta rejalashtirishga yuborildi"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Buyurtma qaytarilmadi"); }
  };

  const moveStop = async (run: DeliveryRun, index: number, direction: -1 | 1) => {
    const target = index + direction; if (target < 0 || target >= run.stops.length) return;
    const stopIds = run.stops.map((stop) => stop.id); [stopIds[index], stopIds[target]] = [stopIds[target], stopIds[index]];
    try { await api(`/logistics/runs/${run.id}/reorder`, { method: "PATCH", body: { stopIds } }); await reload(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Tartib o‘zgarmadi"); }
  };

  const cancelRoute = async (run: DeliveryRun) => {
    if (!window.confirm(`${run.code} marshrutini bekor qilasizmi?`)) return;
    try { await api(`/logistics/runs/${run.id}/cancel`, { method: "PATCH" }); await reload(true); toast.success("Marshrut bekor qilindi"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Marshrut bekor qilinmadi"); }
  };

  const updateDeliveryPriority = async (deliveryId: string, priority: number) => {
    try { await api(`/logistics/deliveries/${deliveryId}/planning`, { method: "PATCH", body: { priority } }); setPool((rows) => rows.map((row) => row.id === deliveryId ? { ...row, priority } : row)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Prioritet saqlanmadi"); }
  };
  const openPlanning = (delivery: PoolDelivery) => setPlanningDraft({ id: delivery.id, code: delivery.order.code, priority: delivery.priority, weightKg: delivery.weightKg?.toString() ?? "", volumeM3: delivery.volumeM3?.toString() ?? "", windowStartAt: delivery.windowStartAt?.slice(0, 16) ?? "", windowEndAt: delivery.windowEndAt?.slice(0, 16) ?? "", serviceMinutes: delivery.serviceMinutes });
  const savePlanning = async () => {
    if (!planningDraft) return; setSaving(true);
    try { await api(`/logistics/deliveries/${planningDraft.id}/planning`, { method: "PATCH", body: { priority: planningDraft.priority, weightKg: planningDraft.weightKg ? Number(planningDraft.weightKg) : null, volumeM3: planningDraft.volumeM3 ? Number(planningDraft.volumeM3) : null, windowStartAt: planningDraft.windowStartAt ? new Date(planningDraft.windowStartAt).toISOString() : null, windowEndAt: planningDraft.windowEndAt ? new Date(planningDraft.windowEndAt).toISOString() : null, serviceMinutes: planningDraft.serviceMinutes } }); setPlanningDraft(null); await reload(true); toast.success("Rejalashtirish parametrlari saqlandi"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Parametrlar saqlanmadi"); }
    finally { setSaving(false); }
  };

  const autoDispatch = async () => {
    const deliveryOrderIds = selectedDeliveries.size ? [...selectedDeliveries] : pool.map((delivery) => delivery.id);
    if (!deliveryOrderIds.length) return;
    if (!window.confirm(`${deliveryOrderIds.length} ta buyurtmani faol kuryerlarga avtomatik taqsimlaysizmi?`)) return;
    setSaving(true);
    try {
      const result = await api<{ runs: Array<{ id: string }>; unassigned: Array<{ id: string; reason: string }> }>("/logistics/dispatch/auto-create", { method: "POST", body: { deliveryOrderIds, startLat: Number(routeDraft.startLat), startLng: Number(routeDraft.startLng) } });
      setSelectedDeliveries(new Set()); await reload(true);
      toast.success(`${result.runs.length} ta marshrut atomik yaratildi${result.unassigned.length ? `, ${result.unassigned.length} ta buyurtma sig‘madi` : ""}`);
    } catch (error) { await reload(true); toast.error(error instanceof Error ? error.message : "Avtomatik taqsimlash bajarilmadi"); }
    finally { setSaving(false); }
  };

  const createRoute = async () => {
    if (!routeDraft.driverId || selectedDeliveries.size === 0) return toast.error("Haydovchi va buyurtmalarni tanlang");
    setSaving(true);
    try {
      await api("/logistics/runs", { method: "POST", body: { driverId: routeDraft.driverId, vehicleId: routeDraft.vehicleId || null, deliveryOrderIds: [...selectedDeliveries], startLat: Number(routeDraft.startLat), startLng: Number(routeDraft.startLng), serviceMinutes: 10 } });
      setSelectedDeliveries(new Set()); await reload(true); toast.success("Optimal marshrut yaratildi");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Marshrut yaratilmadi"); }
    finally { setSaving(false); }
  };

  const createCourier = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      await api("/logistics/employees", { method: "POST", body: { ...courierDraft, phone: courierDraft.phone || null, employeeCode: courierDraft.employeeCode || null } });
      setCourierDraft({ userId: "", position: "COURIER", phone: "", employeeCode: "", canDrive: true }); setCourierForm(false);
      await reload(true); toast.success("Kuryer profili yaratildi");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Kuryer saqlanmadi"); }
    finally { setSaving(false); }
  };

  const createVehicle = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      await api("/logistics/vehicles", { method: "POST", body: { ...draft, defaultDriverId: draft.defaultDriverId || null } });
      setDraft({ plateNumber: "", make: "", model: "", color: "", defaultDriverId: "" }); setVehicleForm(false);
      await reload(true); toast.success("Mashina qo‘shildi");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Mashina saqlanmadi"); }
    finally { setSaving(false); }
  };

  const activeCount = live.filter((c) => c.shift?.status === "ACTIVE" && c.location).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Radio} label="Jonli kuryerlar" value={activeCount} color="text-emerald-600 bg-emerald-50" />
        <Stat icon={UserRound} label="Haydovchilar" value={employees.filter((e) => e.canDrive && e.active).length} color="text-blue-600 bg-blue-50" />
        <Stat icon={Car} label="Yetkazildi (30 kun)" value={analytics?.delivered ?? 0} color="text-violet-600 bg-violet-50" />
        <Stat icon={CircleDot} label="Muvaffaqiyat foizi" value={analytics?.successRate ?? 0} suffix="%" color="text-amber-600 bg-amber-50" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 bg-cream-100 p-1 rounded-xl border border-cream-300">
          {(["live", "routes", "couriers", "fleet"] as LogisticsTab[]).map((value) => <button key={value} onClick={() => setTab(value)} className={`px-3 py-2 rounded-lg text-sm ${tab === value ? "bg-white text-forest-800 shadow-sm" : "text-slate-500"}`}>{value === "live" ? "Jonli xarita" : value === "routes" ? "Marshrutlar" : value === "couriers" ? "Kuryerlar" : "Avtopark"}</button>)}
        </div>
        <button onClick={() => void reload()} className="p-2 rounded-lg border border-cream-300 text-slate-500 hover:bg-cream-50"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      {loading ? <div className="h-64 grid place-items-center"><Loader2 className="w-7 h-7 animate-spin text-leaf-500" /></div> : tab === "live" ? <>
        <LiveMap couriers={live} apiKey={yandexKey} />
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{live.map((courier) => <CourierCard key={courier.id} courier={courier} />)}</div>
      </> : tab === "routes" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-cream-300 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between"><div><h3 className="font-semibold text-forest-800">Yangi marshrut</h3><p className="text-xs text-slate-500">Prioritet, vaqt oynasi, GPS va transport sig‘imi hisobga olinadi.</p></div><div className="flex gap-2"><button disabled={saving || pool.length === 0} onClick={() => void autoDispatch()} className="px-3 py-2 rounded-xl bg-leaf-100 text-forest-800 text-sm font-medium disabled:opacity-40 flex items-center gap-1"><Sparkles className="w-4 h-4" /> Avto taqsimlash</button><button disabled={saving || selectedDeliveries.size === 0 || !routeDraft.driverId} onClick={() => void createRoute()} className="px-4 py-2 rounded-xl bg-forest-700 text-white text-sm disabled:opacity-40">Marshrut yaratish ({selectedDeliveries.size})</button></div></div>
            <div className="grid md:grid-cols-4 gap-2">
              <select value={routeDraft.driverId} onChange={(e) => setRouteDraft({ ...routeDraft, driverId: e.target.value })} className="input"><option value="">Haydovchini tanlang</option>{employees.filter((e) => e.canDrive && e.active).map((e) => <option key={e.id} value={e.id}>{e.user.name}</option>)}</select>
              <select value={routeDraft.vehicleId} onChange={(e) => setRouteDraft({ ...routeDraft, vehicleId: e.target.value })} className="input"><option value="">Mashinasiz</option>{vehicles.filter((v) => ["AVAILABLE", "IN_USE"].includes(v.status)).map((v) => <option key={v.id} value={v.id}>{v.plateNumber}</option>)}</select>
              <input type="number" step="0.000001" value={routeDraft.startLat} onChange={(e) => setRouteDraft({ ...routeDraft, startLat: e.target.value })} className="input" placeholder="Boshlanish lat" />
              <input type="number" step="0.000001" value={routeDraft.startLng} onChange={(e) => setRouteDraft({ ...routeDraft, startLng: e.target.value })} className="input" placeholder="Boshlanish lng" />
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-cream-200 border border-cream-200 rounded-xl">{pool.length === 0 ? <p className="p-4 text-sm text-slate-500">Koordinatali, taqsimlanmagan buyurtma yo‘q</p> : pool.map((delivery) => <label key={delivery.id} className="p-3 flex items-start gap-3 cursor-pointer hover:bg-cream-50"><input type="checkbox" className="mt-1" checked={selectedDeliveries.has(delivery.id)} onChange={(e) => setSelectedDeliveries((old) => { const next = new Set(old); if (e.target.checked) next.add(delivery.id); else next.delete(delivery.id); return next; })} /><div><p className="text-sm font-medium text-forest-800">#{delivery.order.code} · {delivery.order.customer?.name ?? "—"}</p><p className="text-xs text-slate-500">{delivery.order.shippingAddress ?? `${delivery.lat}, ${delivery.lng}`}</p><div className="flex items-center gap-2 mt-1"><select aria-label="Yetkazish prioriteti" value={delivery.priority} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); void updateDeliveryPriority(delivery.id, Number(e.target.value)); }} className="text-[11px] rounded border border-cream-300 bg-white px-1 py-0.5"><option value={0}>Oddiy</option><option value={5}>Muhim</option><option value={10}>Shoshilinch</option></select>{delivery.weightKg != null && <span className="text-[11px] text-slate-400">{delivery.weightKg} kg</span>}{delivery.windowEndAt && <span className="text-[11px] text-slate-400">gacha {new Date(delivery.windowEndAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}<button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPlanning(delivery); }} className="text-[11px] text-blue-600 inline-flex items-center gap-1"><SlidersHorizontal className="w-3 h-3" /> Sozlash</button></div></div></label>)}</div>
          </div>
          <div className="space-y-3">{runs.map((run) => <div key={run.id} className="rounded-2xl border border-cream-300 bg-white p-4"><div className="flex items-center justify-between"><div><p className="font-semibold text-forest-800">{run.code}</p><p className="text-xs text-slate-500">{run.driver.user.name} · {run.vehicle?.plateNumber ?? "Mashinasiz"} · {run.totalDistanceMeters ? `${(run.totalDistanceMeters / 1000).toFixed(1)} km` : "—"}</p></div><div className="flex items-center gap-2"><span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">{run.status}</span>{run.status === "PLANNED" && <button onClick={() => void cancelRoute(run)} className="text-xs px-2 py-1 rounded-lg bg-rose-50 text-rose-600">Bekor qilish</button>}</div></div><ol className="mt-3 space-y-2">{run.stops.map((stop, stopIndex) => <li key={stop.id} className="flex gap-3 text-sm"><span className="w-6 h-6 rounded-full bg-leaf-100 text-forest-700 grid place-items-center text-xs font-bold">{stop.sequence}</span><div><p className="text-forest-800">#{stop.deliveryOrder.order.code} · {stop.deliveryOrder.order.customer?.name ?? "—"}</p><p className="text-xs text-slate-500">{stop.deliveryOrder.order.shippingAddress ?? "Manzil yo‘q"}</p></div><div className="ml-auto flex gap-1"><button title="Tasdiqlar" onClick={() => void openProofAudit(stop.deliveryOrder.id, stop.deliveryOrder.order.code)} className="p-1 rounded bg-cream-100"><Eye className="w-3 h-3" /></button>{stop.status === "FAILED" && <button title="Qayta yetkazish" onClick={() => void retryDelivery(stop.deliveryOrder.id)} className="p-1 rounded bg-rose-50 text-rose-600"><RefreshCw className="w-3 h-3" /></button>}{stop.deliveryOrder.trackingToken && <><button title="Tracking havolasini nusxalash" onClick={() => void copyTrackingLink(stop.deliveryOrder.trackingToken!)} className="p-1 rounded bg-cream-100"><Copy className="w-3 h-3" /></button><button title="Tracking havolasini mijozga yuborish" onClick={() => void sendTrackingLink(stop.deliveryOrder.id)} className="p-1 rounded bg-cream-100"><Send className="w-3 h-3" /></button></>}{run.status === "PLANNED" && <><button disabled={stopIndex === 0} onClick={() => void moveStop(run, stopIndex, -1)} className="p-1 rounded bg-cream-100 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button><button disabled={stopIndex === run.stops.length - 1} onClick={() => void moveStop(run, stopIndex, 1)} className="p-1 rounded bg-cream-100 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button></>}</div></li>)}</ol></div>)}</div>
        </div>
      ) : tab === "couriers" ? (
        <div className="space-y-3">
          <div className="flex justify-end"><button onClick={() => setCourierForm((v) => !v)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-forest-700 text-white text-sm"><Plus className="w-4 h-4" /> Kuryer qo‘shish</button></div>
          {courierForm && <form onSubmit={createCourier} className="grid md:grid-cols-3 gap-3 rounded-2xl border border-cream-300 bg-white p-4">
            <select required value={courierDraft.userId} onChange={(e) => setCourierDraft({ ...courierDraft, userId: e.target.value })} className="input"><option value="">Xodimni tanlang</option>{users.filter((u) => u.active && !employees.some((e) => e.user.id === u.id)).map((u) => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}</select>
            <select value={courierDraft.position} onChange={(e) => setCourierDraft({ ...courierDraft, position: e.target.value })} className="input"><option value="COURIER">Kuryer</option><option value="DRIVER">Haydovchi</option></select>
            <input placeholder="Telefon" value={courierDraft.phone} onChange={(e) => setCourierDraft({ ...courierDraft, phone: e.target.value })} className="input" />
            <input placeholder="Xodim kodi" value={courierDraft.employeeCode} onChange={(e) => setCourierDraft({ ...courierDraft, employeeCode: e.target.value })} className="input" />
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={courierDraft.canDrive} onChange={(e) => setCourierDraft({ ...courierDraft, canDrive: e.target.checked })} /> Mashina boshqaradi</label>
            <button disabled={saving} className="rounded-xl bg-leaf-500 text-forest-900 font-medium disabled:opacity-50 min-h-10">{saving ? "Saqlanmoqda…" : "Saqlash"}</button>
          </form>}
          <div className="rounded-2xl border border-cream-300 bg-white divide-y divide-cream-200">{employees.filter((e) => e.canDrive || e.position === "COURIER" || e.position === "DRIVER").map((employee) => <div key={employee.id} className="p-4 flex items-center justify-between"><div><p className="font-medium text-forest-800">{employee.user.name}</p><p className="text-xs text-slate-500">{employee.phone || employee.user.email}</p>{analytics?.couriers.find((row) => row.id === employee.id) && <p className="text-xs text-slate-500 mt-1">30 kun: <b className="text-emerald-600">{analytics.couriers.find((row) => row.id === employee.id)!.delivered} yetkazildi</b> · <b className="text-rose-500">{analytics.couriers.find((row) => row.id === employee.id)!.failed} xato</b></p>}</div><span className={`text-xs px-2 py-1 rounded-full ${employee.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{employee.position}</span></div>)}</div>
        </div>
      ) : <>
        <div className="flex justify-end"><button onClick={() => setVehicleForm((v) => !v)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-forest-700 text-white text-sm"><Plus className="w-4 h-4" /> Mashina qo‘shish</button></div>
        {vehicleForm && <form onSubmit={createVehicle} className="grid md:grid-cols-3 gap-3 rounded-2xl border border-cream-300 bg-white p-4"><input required placeholder="Davlat raqami" value={draft.plateNumber} onChange={(e) => setDraft({ ...draft, plateNumber: e.target.value.toUpperCase() })} className="input" /><input placeholder="Marka" value={draft.make} onChange={(e) => setDraft({ ...draft, make: e.target.value })} className="input" /><input placeholder="Model" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} className="input" /><input placeholder="Rang" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="input" /><select value={draft.defaultDriverId} onChange={(e) => setDraft({ ...draft, defaultDriverId: e.target.value })} className="input"><option value="">Haydovchi tanlanmagan</option>{employees.filter((e) => e.canDrive && e.active).map((e) => <option key={e.id} value={e.id}>{e.user.name}</option>)}</select><button disabled={saving} className="rounded-xl bg-leaf-500 text-forest-900 font-medium disabled:opacity-50">{saving ? "Saqlanmoqda…" : "Saqlash"}</button></form>}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{vehicles.map((vehicle) => <div key={vehicle.id} className="rounded-2xl border border-cream-300 bg-white p-4"><div className="flex justify-between"><div><p className="font-bold text-forest-800">{vehicle.plateNumber}</p><p className="text-sm text-slate-500">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}</p></div><Car className="w-6 h-6 text-leaf-500" /></div><div className="mt-3 text-xs text-slate-500">Haydovchi: {vehicle.defaultDriver?.user.name ?? "biriktirilmagan"}</div><span className="inline-block mt-2 text-[11px] px-2 py-1 rounded-full bg-cream-100 text-slate-600">{vehicle.status}</span></div>)}</div>
      </>}
      {planningDraft && <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="flex justify-between"><div><h3 className="font-bold text-forest-800">#{planningDraft.code} rejalashtirish</h3><p className="text-xs text-slate-500">Sig‘im, vaqt oynasi va xizmat davomiyligi</p></div><button onClick={() => setPlanningDraft(null)} className="p-2 rounded-xl bg-cream-100"><X className="w-4 h-4" /></button></div><div className="grid grid-cols-2 gap-3 mt-4"><label className="text-xs text-slate-500">Prioritet<input type="number" min={0} max={100} value={planningDraft.priority} onChange={(e) => setPlanningDraft({ ...planningDraft, priority: Number(e.target.value) })} className="input mt-1 w-full" /></label><label className="text-xs text-slate-500">Xizmat vaqti, daqiqa<input type="number" min={1} max={240} value={planningDraft.serviceMinutes} onChange={(e) => setPlanningDraft({ ...planningDraft, serviceMinutes: Number(e.target.value) })} className="input mt-1 w-full" /></label><label className="text-xs text-slate-500">Og‘irlik, kg<input type="number" min={0} step="0.001" value={planningDraft.weightKg} onChange={(e) => setPlanningDraft({ ...planningDraft, weightKg: e.target.value })} className="input mt-1 w-full" /></label><label className="text-xs text-slate-500">Hajm, m³<input type="number" min={0} step="0.0001" value={planningDraft.volumeM3} onChange={(e) => setPlanningDraft({ ...planningDraft, volumeM3: e.target.value })} className="input mt-1 w-full" /></label><label className="text-xs text-slate-500">Qabul boshlanishi<input type="datetime-local" value={planningDraft.windowStartAt} onChange={(e) => setPlanningDraft({ ...planningDraft, windowStartAt: e.target.value })} className="input mt-1 w-full" /></label><label className="text-xs text-slate-500">Oxirgi muddat<input type="datetime-local" value={planningDraft.windowEndAt} onChange={(e) => setPlanningDraft({ ...planningDraft, windowEndAt: e.target.value })} className="input mt-1 w-full" /></label></div><div className="grid grid-cols-2 gap-2 mt-5"><button onClick={() => setPlanningDraft(null)} className="py-3 rounded-xl bg-slate-100 text-slate-600">Bekor</button><button disabled={saving} onClick={() => void savePlanning()} className="py-3 rounded-xl bg-forest-700 text-white font-medium disabled:opacity-50">Saqlash</button></div></div></div>}
      {proofAudit && <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center"><div className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-2xl bg-white p-4 shadow-2xl"><div className="flex items-center justify-between"><div><h3 className="font-bold text-forest-800">#{proofAudit.code} tasdiqlari</h3><p className="text-xs text-slate-500">Yetkazish auditi va isbotlar</p></div><button onClick={() => setProofAudit(null)} className="p-2 rounded-xl bg-cream-100"><X className="w-4 h-4" /></button></div><div className="mt-4 space-y-3">{proofAudit.proofs.length === 0 ? <p className="text-sm text-slate-500 py-8 text-center">Tasdiqlar hali mavjud emas</p> : proofAudit.proofs.map((proof) => <div key={proof.id} className="rounded-xl border border-cream-300 p-3"><div className="flex justify-between gap-2"><span className="text-xs font-bold text-forest-700">{proof.type}</span><time className="text-xs text-slate-400">{new Date(proof.createdAt).toLocaleString()}</time></div>{proof.note && <p className="text-sm text-slate-600 mt-2">{proof.note}</p>}{proof.fileUrl && <a href={proof.fileUrl} target="_blank" rel="noreferrer"><img src={proof.fileUrl} alt={`${proof.type} tasdig‘i`} className="mt-2 max-h-56 w-full object-contain rounded-lg bg-cream-50" /></a>}<p className="text-xs text-slate-400 mt-2">{proof.createdByName ?? "Tizim"}</p></div>)}</div></div></div>}
    </div>
  );
}

function Stat({ icon: Icon, label, value, suffix = "", color }: { icon: typeof Car; label: string; value: number; suffix?: string; color: string }) { return <div className="rounded-2xl border border-cream-300 bg-white p-4 flex items-center gap-3"><div className={`w-10 h-10 rounded-xl grid place-items-center ${color}`}><Icon className="w-5 h-5" /></div><div><p className="text-xl font-bold text-forest-800">{value}{suffix}</p><p className="text-xs text-slate-500">{label}</p></div></div>; }
function CourierCard({ courier }: { courier: LiveCourier }) { const age = courier.location ? Math.max(0, Math.round((Date.now() - new Date(courier.location.capturedAt).getTime()) / 1000)) : null; return <div className="rounded-2xl border border-cream-300 bg-white p-4"><div className="flex justify-between"><div><p className="font-semibold text-forest-800">{courier.name}</p><p className="text-xs text-slate-500">{courier.shift?.vehicle?.plateNumber ?? "Mashina biriktirilmagan"}</p></div><Navigation className={`w-5 h-5 ${courier.location ? "text-emerald-500" : "text-slate-300"}`} /></div><div className="mt-3 text-xs text-slate-500">{courier.location ? `Oxirgi signal: ${age} soniya oldin${courier.location.speed != null ? ` · ${Math.round(courier.location.speed * 3.6)} km/soat` : ""}` : "GPS signali yo‘q"}</div></div>; }
