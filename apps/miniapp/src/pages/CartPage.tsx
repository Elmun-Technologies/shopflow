import { Link, useParams } from "react-router-dom";
import { useCart } from "../cart.ts";
import { formatMoney } from "../format.ts";

export function CartPage() {
  const { slug } = useParams();
  const cart = useCart();
  return (
    <div className="p-4 pb-32">
      <h1 className="text-xl font-semibold">Savatcha</h1>
      {cart.lines.length === 0 ? (
        <p className="mt-6 text-center text-neutral-500">Savat bo'sh</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {cart.lines.map((l) => (
              <li key={l.productId} className="flex justify-between rounded-lg border border-neutral-200 p-3">
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-sm text-neutral-500">×{l.quantity}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatMoney(l.priceKopecks * l.quantity)}</div>
                  <button
                    type="button"
                    onClick={() => cart.remove(l.productId)}
                    className="mt-1 text-xs text-red-500"
                  >
                    O'chirish
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between text-lg font-semibold">
            <span>Jami:</span>
            <span>{formatMoney(cart.total())}</span>
          </div>
          <Link
            to={`/${slug}/checkout`}
            className="fixed bottom-4 left-4 right-4 rounded-xl bg-emerald-600 py-3 text-center text-white font-semibold"
          >
            Buyurtma berish
          </Link>
        </>
      )}
    </div>
  );
}
