import { Calendar } from "lucide-react";

export type PeriodPreset = "today" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface PeriodRange { from: string; to: string }

interface Props {
  preset: PeriodPreset;
  range: PeriodRange;
  onChange: (preset: PeriodPreset, range: PeriodRange) => void;
}

const presets: Array<{ id: PeriodPreset; label: string; days: number }> = [
  { id: "today", label: "Bugun", days: 0 },
  { id: "weekly", label: "Hafta", days: 7 },
  { id: "monthly", label: "Oy", days: 30 },
  { id: "quarterly", label: "Chorak", days: 90 },
  { id: "yearly", label: "Yil", days: 365 },
];

function toDate(daysAgo: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string { return new Date().toISOString().slice(0, 10); }

export function rangeForPreset(p: PeriodPreset): PeriodRange {
  const def = presets.find((x) => x.id === p)!;
  return { from: toDate(def.days), to: todayStr() };
}

export default function PeriodSelector({ preset, range, onChange }: Props) {
  function setPreset(p: PeriodPreset) {
    onChange(p, rangeForPreset(p));
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
      <span className="text-xs text-slate-500 uppercase tracking-wider lg:mr-2">Davr:</span>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              preset === p.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 lg:ml-auto">
        <div className="relative">
          <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="date"
            value={range.from}
            onChange={(e) => onChange(preset, { ...range, from: e.target.value })}
            className="bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white"
          />
        </div>
        <span className="text-slate-500">—</span>
        <div className="relative">
          <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="date"
            value={range.to}
            onChange={(e) => onChange(preset, { ...range, to: e.target.value })}
            className="bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white"
          />
        </div>
      </div>
    </div>
  );
}
