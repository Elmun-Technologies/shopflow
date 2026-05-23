// Platforma uchun umumiy skeleton komponentlar.

// Eng kichik primitive — className orqali shape va o'lcham berish mumkin.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-cream-100 rounded animate-pulse ${className}`} />;
}

export function SkelLine({ w = "100%", h = 12 }: { w?: string | number; h?: number }) {
  return (
    <div
      className="bg-cream-100 rounded-full animate-pulse"
      style={{ width: typeof w === "number" ? `${w}px` : w, height: h }}
    />
  );
}

export function SkelBox({ h = 80, className = "" }: { h?: number | string; className?: string }) {
  return (
    <div
      className={`bg-cream-100 rounded-xl animate-pulse ${className}`}
      style={{ height: typeof h === "number" ? `${h}px` : h }}
    />
  );
}

/** KPI cards skeleton — 4 ta card */
export function KPICardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-cream-100/50 border border-cream-300 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-cream-100 rounded-xl animate-pulse" />
            <div className="h-5 w-12 bg-cream-100 rounded-full animate-pulse" />
          </div>
          <SkelLine w={120} h={14} />
          <div className="h-7 mt-2 mb-1 bg-cream-100 rounded-full w-3/4 animate-pulse" />
          <SkelLine w="50%" h={10} />
        </div>
      ))}
    </div>
  );
}

/** Jadval qatorlari skeleton */
export function TableRowsSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, ri) => (
        <div
          key={ri}
          className="grid gap-3 py-3 px-4 border-b border-cream-300/40"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, ci) => (
            <SkelLine key={ci} w={`${60 + ((ri + ci) % 4) * 10}%`} h={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Universal sahifa loader — header + cards + jadval */
export function PageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-cream-100 rounded-lg animate-pulse" />
          <SkelLine w={200} h={12} />
        </div>
        <div className="h-9 w-32 bg-cream-100 rounded-lg animate-pulse" />
      </div>
      <KPICardsSkeleton />
      <div className="bg-cream-100/30 border border-cream-300 rounded-2xl p-5">
        <div className="h-5 w-32 bg-cream-100 rounded-lg animate-pulse mb-4" />
        <TableRowsSkeleton rows={6} cols={5} />
      </div>
    </div>
  );
}

/** Bitta katta panel skeleton (chart yoki katta tab uchun) */
export function PanelSkeleton({ h = 280 }: { h?: number }) {
  return (
    <div className="bg-cream-100/30 border border-cream-300 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <div className="h-4 w-32 bg-cream-100 rounded animate-pulse" />
          <SkelLine w={120} h={10} />
        </div>
        <div className="h-7 w-20 bg-cream-100 rounded-lg animate-pulse" />
      </div>
      <div className="bg-cream-100/40 rounded-xl animate-pulse" style={{ height: h }} />
    </div>
  );
}
