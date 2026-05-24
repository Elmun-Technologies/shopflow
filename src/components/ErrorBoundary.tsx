import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          className="min-h-screen flex items-center justify-center bg-cream-50 p-6"
        >
          <div className="max-w-md w-full bg-white border border-cream-300 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-rose-600" />
            </div>
            <h1 className="text-xl font-bold text-forest-800 mb-2">Nimadir xato ketdi</h1>
            <p className="text-sm text-slate-500 mb-6">
              Kutilmagan xato yuz berdi. Iltimos, sahifani qayta yuklang yoki bosh sahifaga qayting.
            </p>
            {this.state.error && (
              <pre className="text-xs text-left text-red-300 bg-cream-50 border border-cream-300 rounded-lg p-3 mb-6 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100 transition-colors"
              >
                Qayta urinish
              </button>
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-leaf-400 text-forest-800 font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Sahifani yangilash
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
