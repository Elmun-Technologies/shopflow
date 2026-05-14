import { motion } from "framer-motion";

export function LoadingSkeleton({ rows = 5, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.05 }}
          className="h-12 rounded-lg bg-slate-800/60 border border-slate-800"
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0.4 }}
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.4, repeat: Infinity }}
      className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 h-32"
      aria-busy="true"
    />
  );
}
