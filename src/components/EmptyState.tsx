import React from "react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  buttonText: string;
  onButtonClick: () => void;
  iconColor?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  buttonText,
  onButtonClick,
  iconColor = "text-emerald-400",
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 px-6"
    >
      <div className={`p-6 rounded-2xl bg-slate-800/50 mb-6`}>
        <Icon className={`w-16 h-16 ${iconColor}`} />
      </div>
      <h3 className="text-2xl font-bold text-white text-center mb-2">{title}</h3>
      <p className="text-slate-400 text-center mb-8 max-w-md">{description}</p>
      <button
        onClick={onButtonClick}
        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-all"
      >
        {buttonText}
      </button>
    </motion.div>
  );
}
