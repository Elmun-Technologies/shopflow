import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

export function ErrorRetry({ error, onRetry, className = "" }: Props) {
  const message = extractMessage(error);
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 py-12 px-6 text-center rounded-xl border border-red-900/50 bg-red-950/20 ${className}`}
    >
      <AlertTriangle className="h-8 w-8 text-red-400" />
      <div>
        <h3 className="text-base font-semibold text-red-200">Xatolik yuz berdi</h3>
        <p className="mt-1 max-w-md text-sm text-red-300/80">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-800 px-4 py-2 text-sm text-red-100 transition"
        >
          <RefreshCw className="h-4 w-4" />
          Qayta urinish
        </button>
      )}
    </div>
  );
}

function extractMessage(err: unknown): string {
  if (!err) return "Noma'lum xatolik";
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null) {
    const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
    return (
      anyErr.response?.data?.message ??
      anyErr.message ??
      "Server bilan bog'lanishda xatolik"
    );
  }
  return String(err);
}
