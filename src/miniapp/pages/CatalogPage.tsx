import { useMemo, useState } from "react";
import { ShoppingCart, Search, Receipt } from "lucide-react";
import { fmtMoney } from "../lib/format";
import type { Category, Product, UISchemaShape, BannerBlock, SectionBlock } from "../lib/api";

interface Props {
  shop: { id: string; name: string; currency: string } | null;
  categories: Category[];
  products: Product[];
  cartCount: number;
  uiSchema: UISchemaShape | null;
  onProduct: (id: string) => void;
  onCart: () => void;
  onOrders: () => void;
}

export default function CatalogPage({ shop, categories, products, cartCount, uiSchema, onProduct, onCart, onOrders }: Props) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Agar kategoriya/qidiruv tanlangan bo'lsa - fallback flat ko'rinish, aks holda schema bo'yicha
  const filterMode = activeCat !== null || search.trim() !== "";
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeCat && p.categoryId !== activeCat) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, activeCat, search]);

  return (
    <div>
      <div className="px-4 pt-4 pb-3 sticky top-0 bg-slate-950/95 backdrop-blur z-10 border-b border-slate-900">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold">{shop?.name ?? "Do'kon"}</h1>
          <div className="flex items-center gap-2">
            <button onClick={onOrders} className="p-2 rounded-lg bg-slate-900 text-slate-300" title="Buyurtmalarim">
              <Receipt className="w-5 h-5" />
            </button>
            <button onClick={onCart} className="relative p-2 rounded-lg bg-slate-900 text-slate-300">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-semibold">{cartCount}</span>
              )}
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mahsulot izlash..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pt-3 -mx-4 px-4 no-scrollbar">
            <button
              onClick={() => setActiveCat(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${activeCat === null ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-400"}`}
            >Hammasi</button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${activeCat === c.id ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-400"}`}
              >{c.name}</button>
            ))}
          </div>
        )}
      </div>

      {filterMode || !uiSchema ? (
        <FlatProductGrid products={filteredProducts} currency={shop?.currency ?? "UZS"} onProduct={onProduct} />
      ) : (
        <SchemaRenderer
          schema={uiSchema}
          categories={categories}
          products={products}
          productMap={productMap}
          currency={shop?.currency ?? "UZS"}
          onProduct={onProduct}
          onCategory={(id) => setActiveCat(id)}
        />
      )}
    </div>
  );
}

function FlatProductGrid({ products, currency, onProduct }: { products: Product[]; currency: string; onProduct: (id: string) => void }) {
  return (
    <div className="px-4 pt-4">
      {products.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-12">Mahsulot topilmadi</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => <ProductCard key={p.id} product={p} currency={currency} onClick={() => onProduct(p.id)} />)}
        </div>
      )}
    </div>
  );
}

function SchemaRenderer({
  schema, categories, products, productMap, currency, onProduct, onCategory,
}: {
  schema: UISchemaShape;
  categories: Category[];
  products: Product[];
  productMap: Map<string, Product>;
  currency: string;
  onProduct: (id: string) => void;
  onCategory: (id: string) => void;
}) {
  return (
    <div className="space-y-6 pt-4 pb-4">
      {schema.banners.length > 0 && (
        <div className="flex gap-3 overflow-x-auto px-4 -mx-4 no-scrollbar">
          {schema.banners.map((b) => (
            <BannerCard key={b.id} banner={b} onAction={(a) => {
              if (a.kind === "category") onCategory(a.categoryId);
              else if (a.kind === "product") onProduct(a.productId);
              else if (a.kind === "url") window.open(a.url, "_blank", "noopener,noreferrer");
            }} />
          ))}
        </div>
      )}

      {schema.sections.map((s) => (
        <SectionRenderer
          key={s.id}
          section={s}
          categories={categories}
          products={products}
          productMap={productMap}
          currency={currency}
          onProduct={onProduct}
          onCategory={onCategory}
        />
      ))}

      {schema.banners.length === 0 && schema.sections.length === 0 && (
        <FlatProductGrid products={products} currency={currency} onProduct={onProduct} />
      )}
    </div>
  );
}

function BannerCard({ banner, onAction }: { banner: BannerBlock; onAction: (a: BannerBlock["action"]) => void }) {
  const clickable = banner.action.kind !== "none";
  return (
    <button
      onClick={() => clickable && onAction(banner.action)}
      disabled={!clickable}
      className="shrink-0 w-[80%] rounded-2xl overflow-hidden relative bg-slate-900 border border-slate-800"
    >
      <div className="aspect-[16/9] bg-gradient-to-br from-emerald-600/30 to-blue-600/30">
        {banner.imageUrl && <img src={banner.imageUrl} alt={banner.title} className="absolute inset-0 w-full h-full object-cover" />}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
        {banner.title && <p className="text-white font-bold">{banner.title}</p>}
        {banner.subtitle && <p className="text-white/80 text-xs mt-0.5">{banner.subtitle}</p>}
      </div>
    </button>
  );
}

function SectionRenderer({
  section, categories, products, productMap, currency, onProduct, onCategory,
}: {
  section: SectionBlock;
  categories: Category[];
  products: Product[];
  productMap: Map<string, Product>;
  currency: string;
  onProduct: (id: string) => void;
  onCategory: (id: string) => void;
}) {
  if (section.type === "categories") {
    const visible = section.visibleIds && section.visibleIds.length > 0
      ? categories.filter((c) => section.visibleIds!.includes(c.id))
      : categories;
    if (visible.length === 0) return null;
    return (
      <div className="px-4">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">{section.title}</p>
        <div className={`flex gap-3 overflow-x-auto -mx-4 px-4 no-scrollbar ${section.layout === "grid" ? "!grid grid-cols-3 !overflow-visible" : ""}`}>
          {visible.map((c) => (
            <button
              key={c.id}
              onClick={() => onCategory(c.id)}
              className="shrink-0 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-medium hover:border-emerald-500/40"
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (section.type === "products") {
    let list: Product[];
    if (section.filter.productIds && section.filter.productIds.length > 0) {
      list = section.filter.productIds.map((id) => productMap.get(id)).filter((p): p is Product => !!p);
    } else if (section.filter.categoryId) {
      list = products.filter((p) => p.categoryId === section.filter.categoryId);
    } else {
      list = products;
    }
    list = list.slice(0, section.filter.limit);
    if (list.length === 0) return null;
    return (
      <div className="px-4">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">{section.title}</p>
        <div className="grid grid-cols-2 gap-3">
          {list.map((p) => <ProductCard key={p.id} product={p} currency={currency} onClick={() => onProduct(p.id)} />)}
        </div>
      </div>
    );
  }
  if (section.type === "text") {
    return (
      <div className="px-4">
        {section.title && <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">{section.title}</p>}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 whitespace-pre-line">{section.body}</div>
      </div>
    );
  }
  return null;
}

function ProductCard({ product, currency, onClick }: { product: Product; currency: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-left hover:border-emerald-500/40 active:scale-[0.98] transition-transform">
      <div className="aspect-square bg-slate-800 overflow-hidden">
        {product.images[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600 text-3xl">📦</div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium line-clamp-2">{product.name}</p>
        <p className="text-emerald-400 font-semibold mt-1.5 text-sm">{fmtMoney(product.price, currency)}</p>
        {product.stock <= 5 && product.stock > 0 && <p className="text-[10px] text-amber-400 mt-0.5">Atigi {product.stock} ta qoldi</p>}
        {product.stock === 0 && <p className="text-[10px] text-red-400 mt-0.5">Mavjud emas</p>}
      </div>
    </button>
  );
}
