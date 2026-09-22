import { useState } from "react";
import { Camera, Loader2, X, XCircle } from "lucide-react";

const reasons = ["Mijoz manzilda yo‘q", "Mijoz buyurtmani rad etdi", "Manzil noto‘g‘ri", "Mijoz bilan bog‘lanib bo‘lmadi", "Transport muammosi", "Boshqa sabab"];

export function DeliveryFailureReport({ busy, onCancel, onSubmit }: { busy: boolean; onCancel: () => void; onSubmit: (reason: string, photo: File) => void }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const note = reason === "Boshqa sabab" ? details.trim() : `${reason}${details.trim() ? ` — ${details.trim()}` : ""}`;
  return <div className="fixed inset-0 z-50 bg-black/80 p-4 flex items-end sm:items-center justify-center">
    <div className="w-full max-w-lg rounded-3xl bg-white text-forest-900 p-4 shadow-2xl">
      <div className="flex justify-between gap-3"><div><h2 className="font-bold flex items-center gap-2 text-rose-700"><XCircle className="w-5 h-5"/> Yetkazilmadi</h2><p className="text-xs text-slate-500 mt-1">Sabab va holatni tasdiqlovchi surat majburiy</p></div><button onClick={onCancel} className="p-2 rounded-xl bg-cream-100"><X className="w-5 h-5"/></button></div>
      <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-4 w-full rounded-xl border border-cream-300 px-3 py-3 bg-white"><option value="">Sababni tanlang</option>{reasons.map((item) => <option key={item}>{item}</option>)}</select>
      <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 400))} placeholder={reason === "Boshqa sabab" ? "Sababni yozing" : "Qo‘shimcha izoh (ixtiyoriy)"} rows={3} className="mt-3 w-full rounded-xl border border-cream-300 px-3 py-2 resize-none" />
      <label className={`mt-3 w-full min-h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer ${photo ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-cream-300 text-slate-500"}`}><Camera className="w-6 h-6 mb-1"/><span className="text-sm font-medium">{photo ? photo.name : "Tasdiqlovchi surat olish"}</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
      <div className="grid grid-cols-2 gap-2 mt-4"><button onClick={onCancel} className="py-3 rounded-xl bg-slate-100 text-slate-600">Bekor</button><button disabled={busy || !photo || !reason || note.length < 3} onClick={() => photo && onSubmit(note, photo)} className="py-3 rounded-xl bg-rose-600 text-white font-bold disabled:opacity-40">{busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : "Tasdiqlash"}</button></div>
    </div>
  </div>;
}
