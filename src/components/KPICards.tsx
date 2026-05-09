import { motion } from "framer-motion";
import { DollarSign, ShoppingBag, Users, TrendingUp, TrendingDown } from "lucide-react";
import { kpiData } from "../data/dashboardData";

const iconMap: Record<string, React.ElementType> = {
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
};

export default function KPICards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpiData.map((kpi, index) => {
        const Icon = iconMap[kpi.icon];
        const isPositive = kpi.changeType === "positive";
        return (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{kpi.title}</p>
                <p className="text-2xl font-bold text-white mt-1.5">{kpi.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  {isPositive ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span
                    className={`text-xs font-semibold ${
                      isPositive ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {kpi.change}
                  </span>
                  <span className="text-xs text-slate-500">vs last month</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
