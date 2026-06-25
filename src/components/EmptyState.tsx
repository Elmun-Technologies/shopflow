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
  iconColor = "text-cream-300",
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 px-6"
    >
      <div className={`p-6 rounded-2xl bg-cream-100 mb-6`}>
        <Icon className={`w-16 h-16 ${iconColor}`} />
      </div>
      <h3 className="text-2xl font-bold text-forest-800 text-center mb-2">{title}</h3>
      <p className="text-slate-500 text-center mb-8 max-w-md">{description}</p>
      <button
        onClick={onButtonClick}
        className="px-6 py-3 bg-leaf-400 hover:bg-leaf-500 text-forest-800 rounded-lg font-medium transition-all"
      >
        {buttonText}
      </button>
    </motion.div>
  );
}
