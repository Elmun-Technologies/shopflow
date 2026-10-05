function shimmer(w: string, h: string, radius = 12) {
  return (
    <div
      className="animate-pulse"
      style={{ width: w, height: h, borderRadius: radius, backgroundColor: "#f2f3f6" }}
    />
  );
}

export function ProductSkeleton() {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 20,
        border: "1px solid rgba(17,24,39,0.05)",
        overflow: "hidden",
      }}
    >
      {/* Image placeholder 4:3 */}
      <div
        className="animate-pulse"
        style={{ aspectRatio: "4/3", backgroundColor: "#f2f3f6" }}
      />
      <div className="p-3 flex flex-col gap-2">
        {shimmer("60%", "13px", 8)}
        {shimmer("85%", "11px", 8)}
        {shimmer("40%", "11px", 8)}
        {shimmer("100%", "30px", 10)}
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
    <div className="px-4 py-2 flex gap-2 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse flex-shrink-0 rounded-full"
          style={{ width: 60 + (i % 3) * 24, height: 30, backgroundColor: "#f2f3f6" }}
        />
      ))}
    </div>
  );
}
