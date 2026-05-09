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

export default function CartPage({ items, productMap, currency, onSetQty, onCheckout, onBack }: Props) {
  const enriched = items.map((it) => ({ ...it, product: productMap.get(it.productId) })).filter((it) => it.product);
  const total = enriched.reduce((s, it) => s + (it.product!.price * it.quantity), 0);

  return (
    <div>
      <div className="px-4 pt-4 pb-3 sticky top-0 bg-slate-950/95 backdrop-blur z-10 border-b border-slate-900 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-900"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-lg font-bold">Savat</h1>
      </div>

      {enriched.length === 0 ? (
        <div className="px-4 pt-20 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-slate-900 flex items-center justify-center mb-4">
            <ShoppingBag className="w-10 h-10 text-slate-600" />
          </div>
          <p className="text-slate-300 font-medium">Savat bo'sh</p>
          <p className="text-slate-500 text-sm mt-1">Katalogdan mahsulot tanlang</p>
          <button onClick={onBack} className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-6 py-2.5 rounded-lg">
            Katalogga o'tish
          </button>
        </div>
      ) : (
        <>
          <div className="px-4 pt-4 pb-32 space-y-3">
            {enriched.map((it) => (
              <div key={it.productId} className="flex gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="w-16 h-16 rounded-lg bg-slate-800 overflow-hidden shrink-0">
                  {it.product!.images[0] && <img src={it.product!.images[0]} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2">{it.product!.name}</p>
                  <p className="text-emerald-400 text-sm font-semibold mt-1">{fmtMoney(it.product!.price, currency)}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 bg-slate-800 rounded-lg">
                      <button onClick={() => onSetQty(it.productId, it.quantity - 1)} className="w-7 h-7 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="text-sm font-medium min-w-[20px] text-center">{it.quantity}</span>
                      <button
                        onClick={() => onSetQty(it.productId, it.quantity + 1)}
                        disabled={it.quantity >= it.product!.stock}
                        className="w-7 h-7 flex items-center justify-center disabled:opacity-40"
                      ><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                    <button onClick={() => onSetQty(it.productId, 0)} className="text-slate-500 hover:text-red-400 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur border-t border-slate-900 p-4">
            <div className="max-w-md mx-auto">
              <div className="flex justify-between mb-3">
                <span className="text-slate-400 text-sm">Jami:</span>
                <span className="text-lg font-bold">{fmtMoney(total, currency)}</span>
              </div>
              <button onClick={onCheckout} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl">
                Buyurtma berish
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
