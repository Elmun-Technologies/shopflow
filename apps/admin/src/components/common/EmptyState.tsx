import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-dashed border-slate-700 bg-slate-900/30 ${className}`}
    >
      {icon && <div className="mb-4 text-slate-500">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
