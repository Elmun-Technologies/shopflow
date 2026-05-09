import { ChevronLeft, Minus, Plus } from "lucide-react";
import { fmtMoney } from "../lib/format";
import type { Product } from "../lib/api";

interface Props {
  product: Product | null;
  inCart: number;
  currency: string;
  onAdd: () => void;
  onSetQty: (q: number) => void;
  onBack: () => void;
}

export default function ProductPage({ product, inCart, currency, onAdd, onSetQty, onBack }: Props) {
  if (!product) {
    return <div className="p-6 text-center text-slate-500 text-sm">Mahsulot topilmadi</div>;
  }
  const stockOk = product.stock > 0;
  return (
    <div>
      <div className="relative">
        <div className="aspect-square bg-slate-900 overflow-hidden">
          {product.images[0] ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl text-slate-700">📦</div>
          )}
        </div>
        <button onClick={onBack} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 pt-4 pb-32 space-y-4">
        <div>
          <h1 className="text-xl font-bold">{product.name}</h1>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{fmtMoney(product.price, currency)}</p>
          {product.stock <= 5 && product.stock > 0 && <p className="text-xs text-amber-400 mt-1">Atigi {product.stock} ta qoldi</p>}
          {!stockOk && <p className="text-xs text-red-400 mt-1">Mavjud emas</p>}
        </div>

        {product.description && (
          <div>
            <p className="text-xs uppercase text-slate-500 mb-2">Tavsifi</p>
            <p className="text-sm text-slate-300 leading-relaxed">{product.description}</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur border-t border-slate-900 p-4">
        <div className="max-w-md mx-auto">
          {inCart > 0 ? (
            <div className="flex items-center gap-3 bg-slate-900 rounded-xl p-2">
              <button onClick={() => onSetQty(inCart - 1)} className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center">
                <p className="text-xs text-slate-500">Savatda</p>
                <p className="text-sm font-semibold">{inCart} dona</p>
              </div>
              <button
                onClick={() => onSetQty(Math.min(inCart + 1, product.stock))}
                disabled={inCart >= product.stock}
                className="w-10 h-10 rounded-lg bg-emerald-600 disabled:bg-slate-700 flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onAdd}
              disabled={!stockOk}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl"
            >
              {stockOk ? "Savatga qo'shish" : "Mavjud emas"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
