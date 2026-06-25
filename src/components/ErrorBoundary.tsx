import { Component, type ContextType, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/react";
import { LangContext } from "../i18n";

const FALLBACK_TEXT: Record<string, string> = {
  "errorBoundary.title": "Nimadir xato ketdi",
  "errorBoundary.desc": "Kutilmagan xato yuz berdi. Iltimos, sahifani qayta yuklang yoki bosh sahifaga qayting.",
  "errorBoundary.retry": "Qayta urinish",
  "errorBoundary.reload": "Sahifani yangilash",
};

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  static contextType = LangContext;
  declare context: ContextType<typeof LangContext>;

  state: State = { hasError: false, error: null };

  t = (key: string): string => this.context?.t(key) ?? FALLBACK_TEXT[key] ?? key;

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
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-forest-800 mb-2">{this.t("errorBoundary.title")}</h1>
            <p className="text-sm text-slate-500 mb-6">
              {this.t("errorBoundary.desc")}
            </p>
            {this.state.error && (
              <pre className="text-xs text-left text-red-600 bg-cream-50 border border-cream-300 rounded-lg p-3 mb-6 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100 transition-colors"
              >
                {this.t("errorBoundary.retry")}
              </button>
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 text-forest-800 font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {this.t("errorBoundary.reload")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
