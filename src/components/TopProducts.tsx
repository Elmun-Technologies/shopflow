import { motion } from "framer-motion";
import { Star, Package } from "lucide-react";
import { topProducts } from "../data/dashboardData";

export default function TopProducts() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.8 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Top Products</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Best performing products this month
          </p>
        </div>
        <button className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
          See All
        </button>
      </div>

      <div className="space-y-3">
        {topProducts.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group"
          >
            {/* Product Image Placeholder */}
            <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-slate-600 transition-colors">
              <Package className="w-5 h-5 text-slate-400" />
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {product.name}
              </p>
              <p className="text-xs text-slate-500">{product.category}</p>
            </div>

            {/* Stats */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-white">
                ${product.price.toFixed(2)}
              </p>
              <div className="flex items-center gap-1 mt-0.5 justify-end">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="text-xs text-slate-400">{product.rating}</span>
              </div>
            </div>

            {/* Sold / Stock */}
            <div className="text-right flex-shrink-0 w-16">
              <p className="text-xs text-slate-400">Sold</p>
              <p className="text-sm font-medium text-emerald-400">
                {product.sold}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
