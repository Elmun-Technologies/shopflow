import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { categoryData } from "../data/dashboardData";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-sm font-medium text-white">{payload[0].name}</p>
        <p className="text-xs text-slate-400">
          {payload[0].value}% of sales
        </p>
        <p className="text-sm font-semibold text-emerald-400 mt-0.5">
          ${payload[0].payload.sales.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export default function SalesByCategory() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <h3 className="text-base font-semibold text-white mb-1">
        Sales by Category
      </h3>
      <p className="text-sm text-slate-500 mb-4">
        Distribution across product categories
      </p>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {categoryData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2 mt-2">
        {categoryData.map((cat, index) => (
          <div key={cat.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: COLORS[index] }}
              />
              <span className="text-sm text-slate-300">{cat.name}</span>
            </div>
            <span className="text-sm font-medium text-white">{cat.value}%</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
