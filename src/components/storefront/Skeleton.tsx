export function ProductSkeleton() {
  return (
    <div className="bg-slate-900 rounded-2xl overflow-hidden">
      <div className="aspect-square bg-slate-800 animate-pulse" />
      <div className="p-2.5 space-y-2">
        <div className="h-3 bg-slate-800 rounded-full w-3/4 animate-pulse" />
        <div className="h-3 bg-slate-800 rounded-full w-1/2 animate-pulse" />
        <div className="h-4 bg-slate-800 rounded-full w-2/3 mt-2 animate-pulse" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </div>
  );
}

export function CategoryChipsSkeleton() {
  return (
    <div className="px-3 py-2 flex gap-2 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-7 bg-slate-800 rounded-lg animate-pulse flex-shrink-0"
          style={{ width: 60 + (i % 3) * 20 }}
        />
      ))}
    </div>
  );
}
