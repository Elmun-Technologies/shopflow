import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { haptic } from "./storefront-theme";
import { useT } from "../../i18n";

interface ProductImageCarouselProps {
  imageUrl: string | null;
  images: string[];
  alt: string;
  badges?: ReactNode;
}

/**
 * Mahsulot rasmi karuseli — Mini App quick view'da ishlatiladi.
 * - Bir nechta rasm bo'lsa: gorizontal swipe + dots indicator + chevron tugmalari
 * - Bitta rasm: oddiy ko'rinish, karusel kontroli ko'rinmaydi
 * - Rasm umuman yo'q: Package placeholder
 */
export function ProductImageCarousel({ imageUrl, images, alt, badges }: ProductImageCarouselProps) {
  const { t } = useT();
  const allImages = useMemo(() => {
    const set = new Set<string>();
    if (imageUrl) set.add(imageUrl);
    for (const img of images) if (img) set.add(img);
    return Array.from(set);
  }, [imageUrl, images]);

  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Reset to first image when product changes
  useEffect(() => {
    setIndex(0);
    scrollerRef.current?.scrollTo({ left: 0, behavior: "instant" as ScrollBehavior });
  }, [imageUrl, images]);

  // Sync index with scroll position
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || allImages.length < 2) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth;
        if (w === 0) return;
        const next = Math.round(el.scrollLeft / w);
        setIndex((prev) => (prev === next ? prev : Math.max(0, Math.min(allImages.length - 1, next))));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [allImages.length]);

  const goTo = (next: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: w * next, behavior: "smooth" });
    haptic.soft();
  };

  if (allImages.length === 0) {
    return (
      <div className="w-full aspect-square bg-slate-900 flex items-center justify-center overflow-hidden relative">
        {badges}
        <Package className="w-20 h-20 text-slate-600" />
      </div>
    );
  }

  if (allImages.length === 1) {
    return (
      <div className="w-full aspect-square bg-slate-900 flex items-center justify-center overflow-hidden relative">
        {badges}
        <img src={allImages[0]} alt={alt} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className="w-full aspect-square bg-slate-900 overflow-hidden relative">
      {badges}

      {/* Image track — native horizontal scroll-snap (silliq mobil) */}
      <div
        ref={scrollerRef}
        className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {allImages.map((src, i) => (
          <div key={`${src}-${i}`} className="snap-start flex-shrink-0 w-full h-full">
            <img
              src={src}
              alt={`${alt} ${i + 1}/${allImages.length}`}
              className="w-full h-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Prev / Next tugmalari — desktop'da yordamchi, mobile'da kerak emas */}
      {index > 0 && (
        <button
          onClick={() => goTo(index - 1)}
          aria-label={t("carousel.previous")}
          className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {index < allImages.length - 1 && (
        <button
          onClick={() => goTo(index + 1)}
          aria-label={t("carousel.next")}
          className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Dots indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/40 backdrop-blur rounded-full px-2 py-1">
        {allImages.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={t("carousel.image", { index: i + 1 })}
            className={`transition-all rounded-full ${
              i === index ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"
            }`}
          />
        ))}
      </div>

      {/* Counter (1/N) */}
      <div className="absolute top-3 right-3 bg-black/50 backdrop-blur text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
        {index + 1} / {allImages.length}
      </div>
    </div>
  );
}
