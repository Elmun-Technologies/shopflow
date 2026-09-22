import { useCallback, useEffect, useRef, useState } from "react";
import { Car, CircleDot, Loader2, MapPinned, Navigation, Plus, Radio, RefreshCw, UserRound } from "lucide-react";
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
type LogisticsTab = "live" | "couriers" | "fleet";

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

function LiveMap({ couriers }: { couriers: LiveCourier[] }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<YMap | null>(null);
  const key = import.meta.env.VITE_YANDEX_MAPS_API_KEY as string | undefined;

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
      <p className="text-sm text-amber-700 mt-1">Frontend environment’ga VITE_YANDEX_MAPS_API_KEY qo‘shing. Kuryerlarning GPS ro‘yxati pastda ishlashda davom etadi.</p>
    </div>
  );
  return <div ref={host} className="h-96 rounded-2xl overflow-hidden border border-cream-300 bg-cream-100" />;
}

export default function LogisticsControl() {
  const toast = useAppToast();
  const [tab, setTab] = useState<LogisticsTab>("live");
  const [live, setLive] = useState<LiveCourier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicleForm, setVehicleForm] = useState(false);
  const [courierForm, setCourierForm] = useState(false);
  const [courierDraft, setCourierDraft] = useState({ userId: "", position: "COURIER", phone: "", employeeCode: "", canDrive: true });
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ plateNumber: "", make: "", model: "", color: "", defaultDriverId: "" });

  const reload = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [liveRows, employeeRows, vehicleRows, userRows] = await Promise.all([
        api<LiveCourier[]>("/logistics/live"), api<Employee[]>("/logistics/employees"), api<Vehicle[]>("/logistics/vehicles"), api<TeamUser[]>("/settings/users"),
      ]);
      setLive(liveRows); setEmployees(employeeRows); setVehicles(vehicleRows); setUsers(userRows);
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
        <Stat icon={Car} label="Mashinalar" value={vehicles.length} color="text-violet-600 bg-violet-50" />
        <Stat icon={CircleDot} label="Band mashinalar" value={vehicles.filter((v) => v.status === "IN_USE").length} color="text-amber-600 bg-amber-50" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 bg-cream-100 p-1 rounded-xl border border-cream-300">
          {(["live", "couriers", "fleet"] as LogisticsTab[]).map((value) => <button key={value} onClick={() => setTab(value)} className={`px-3 py-2 rounded-lg text-sm ${tab === value ? "bg-white text-forest-800 shadow-sm" : "text-slate-500"}`}>{value === "live" ? "Jonli xarita" : value === "couriers" ? "Kuryerlar" : "Avtopark"}</button>)}
        </div>
        <button onClick={() => void reload()} className="p-2 rounded-lg border border-cream-300 text-slate-500 hover:bg-cream-50"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      {loading ? <div className="h-64 grid place-items-center"><Loader2 className="w-7 h-7 animate-spin text-leaf-500" /></div> : tab === "live" ? <>
        <LiveMap couriers={live} />
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{live.map((courier) => <CourierCard key={courier.id} courier={courier} />)}</div>
      </> : tab === "couriers" ? (
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
          <div className="rounded-2xl border border-cream-300 bg-white divide-y divide-cream-200">{employees.filter((e) => e.canDrive || e.position === "COURIER" || e.position === "DRIVER").map((employee) => <div key={employee.id} className="p-4 flex items-center justify-between"><div><p className="font-medium text-forest-800">{employee.user.name}</p><p className="text-xs text-slate-500">{employee.phone || employee.user.email}</p></div><span className={`text-xs px-2 py-1 rounded-full ${employee.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{employee.position}</span></div>)}</div>
        </div>
      ) : <>
        <div className="flex justify-end"><button onClick={() => setVehicleForm((v) => !v)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-forest-700 text-white text-sm"><Plus className="w-4 h-4" /> Mashina qo‘shish</button></div>
        {vehicleForm && <form onSubmit={createVehicle} className="grid md:grid-cols-3 gap-3 rounded-2xl border border-cream-300 bg-white p-4"><input required placeholder="Davlat raqami" value={draft.plateNumber} onChange={(e) => setDraft({ ...draft, plateNumber: e.target.value.toUpperCase() })} className="input" /><input placeholder="Marka" value={draft.make} onChange={(e) => setDraft({ ...draft, make: e.target.value })} className="input" /><input placeholder="Model" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} className="input" /><input placeholder="Rang" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="input" /><select value={draft.defaultDriverId} onChange={(e) => setDraft({ ...draft, defaultDriverId: e.target.value })} className="input"><option value="">Haydovchi tanlanmagan</option>{employees.filter((e) => e.canDrive && e.active).map((e) => <option key={e.id} value={e.id}>{e.user.name}</option>)}</select><button disabled={saving} className="rounded-xl bg-leaf-500 text-forest-900 font-medium disabled:opacity-50">{saving ? "Saqlanmoqda…" : "Saqlash"}</button></form>}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{vehicles.map((vehicle) => <div key={vehicle.id} className="rounded-2xl border border-cream-300 bg-white p-4"><div className="flex justify-between"><div><p className="font-bold text-forest-800">{vehicle.plateNumber}</p><p className="text-sm text-slate-500">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}</p></div><Car className="w-6 h-6 text-leaf-500" /></div><div className="mt-3 text-xs text-slate-500">Haydovchi: {vehicle.defaultDriver?.user.name ?? "biriktirilmagan"}</div><span className="inline-block mt-2 text-[11px] px-2 py-1 rounded-full bg-cream-100 text-slate-600">{vehicle.status}</span></div>)}</div>
      </>}
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: typeof Car; label: string; value: number; color: string }) { return <div className="rounded-2xl border border-cream-300 bg-white p-4 flex items-center gap-3"><div className={`w-10 h-10 rounded-xl grid place-items-center ${color}`}><Icon className="w-5 h-5" /></div><div><p className="text-xl font-bold text-forest-800">{value}</p><p className="text-xs text-slate-500">{label}</p></div></div>; }
function CourierCard({ courier }: { courier: LiveCourier }) { const age = courier.location ? Math.max(0, Math.round((Date.now() - new Date(courier.location.capturedAt).getTime()) / 1000)) : null; return <div className="rounded-2xl border border-cream-300 bg-white p-4"><div className="flex justify-between"><div><p className="font-semibold text-forest-800">{courier.name}</p><p className="text-xs text-slate-500">{courier.shift?.vehicle?.plateNumber ?? "Mashina biriktirilmagan"}</p></div><Navigation className={`w-5 h-5 ${courier.location ? "text-emerald-500" : "text-slate-300"}`} /></div><div className="mt-3 text-xs text-slate-500">{courier.location ? `Oxirgi signal: ${age} soniya oldin${courier.location.speed != null ? ` · ${Math.round(courier.location.speed * 3.6)} km/soat` : ""}` : "GPS signali yo‘q"}</div></div>; }
