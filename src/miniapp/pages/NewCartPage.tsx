import { ChevronLeft, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { fmtMoney } from "../lib/format";
import type { Product } from "../lib/api";
import type { CartItem } from "../MiniApp";

interface Props {
  items: CartItem[];
  productMap: Map<string, Product>;
  currency: string;
  onSetQty: (productId: string, qty: number) => void;
  onCheckout: () => void;
  onBack: () => void;
}

export default function NewCartPage({ items, productMap, currency, onSetQty, onCheckout, onBack }: Props) {
  const enriched = items.map((it) => ({ ...it, product: productMap.get(it.productId) })).filter((it) => it.product);
  const total = enriched.reduce((s, it) => s + (it.product!.price * it.quantity), 0);
  const totalSavings = enriched.reduce((s, it) => {
    const compare = it.product!.compareAtPrice ?? 0;
    return s + Math.max(0, (compare - it.product!.price) * it.quantity);
  }, 0);

  return (
    <div className="bg-gray-50 min-h-screen pb-32">
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-30 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-bold text-gray-900">Savatim</h1>
      </div>

      {enriched.length === 0 ? (
        <div className="px-4 pt-20 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ShoppingBag className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-gray-900 font-semibold">Savat bo'sh</p>
          <p className="text-gray-500 text-sm mt-1">Katalogdan mahsulot qo'shing</p>
          <button onClick={onBack} className="mt-6 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl">
            Katalogga
          </button>
        </div>
      ) : (
        <>
          <div className="p-4 space-y-3">
            {enriched.map((it) => {
              const compare = it.product!.compareAtPrice;
              return (
                <div key={it.productId} className="bg-white rounded-2xl p-3 flex gap-3 border border-gray-100">
                  <div className="w-20 h-20 rounded-xl bg-gray-50 overflow-hidden shrink-0">
                    {it.product!.images[0] && <img src={it.product!.images[0]} alt="" className="w-full h-full object-contain p-1" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{it.product!.name}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      {compare && compare > it.product!.price && (
                        <span className="text-xs text-gray-400 line-through">{fmtMoney(compare, currency)}</span>
                      )}
                      <span className="text-sm font-bold text-gray-900">{fmtMoney(it.product!.price, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 bg-gray-100 rounded-lg">
                        <button onClick={() => onSetQty(it.productId, it.quantity - 1)} className="w-7 h-7 flex items-center justify-center text-gray-600">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-semibold text-gray-900 min-w-[24px] text-center">{it.quantity}</span>
                        <button
                          onClick={() => onSetQty(it.productId, it.quantity + 1)}
                          disabled={it.quantity >= it.product!.stock}
                          className="w-7 h-7 flex items-center justify-center text-gray-600 disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button onClick={() => onSetQty(it.productId, 0)} className="text-gray-400 hover:text-red-500 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="fixed bottom-[68px] left-0 right-0 bg-white border-t border-gray-100 p-4 z-30">
            <div className="max-w-md mx-auto">
              {totalSavings > 0 && (
                <div className="flex justify-between mb-2 text-xs">
                  <span className="text-gray-500">Tejovingiz</span>
                  <span className="text-emerald-600 font-semibold">{fmtMoney(totalSavings, currency)}</span>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Jami:</span>
                <span className="text-xl font-bold text-gray-900">{fmtMoney(total, currency)}</span>
              </div>
              <button onClick={onCheckout} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3.5 rounded-xl">
                Buyurtma berish
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
