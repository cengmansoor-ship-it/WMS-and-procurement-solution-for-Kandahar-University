import { Component, ErrorInfo, ReactNode } from "react";
import Button from "../ui/button/Button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
  errorStack: string;
}

const HMR_ERRORS = [
  "useAuth must be used within an AuthProvider",
  "useLanguage must be used within",
  "useCalendar must be used within",
  "useTheme must be used within",
  "Cannot read properties of undefined (reading 'user')",
  "Cannot read properties of undefined (reading 'profile')",
];

function isHmrContextError(msg: string): boolean {
  return HMR_ERRORS.some(e => msg.includes(e));
}

function isStaleAssetError(msg: string): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(msg);
}

async function clearBrowserRuntimeCaches() {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});
  }
  if ("caches" in window) {
    await caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  }
}

class ErrorBoundary extends Component<Props, State> {
  private _reloadTimer: ReturnType<typeof setTimeout> | null = null;

  public state: State = {
    hasError: false,
    errorMsg: "",
    errorStack: "",
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error?.message || String(error), errorStack: error?.stack || "" };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    if (isStaleAssetError(error?.message || "")) {
      const reloadAt = Number(sessionStorage.getItem("_stale_asset_reload_at") || "0");
      if (Date.now() - reloadAt > 15000) {
        sessionStorage.setItem("_stale_asset_reload_at", String(Date.now()));
        clearBrowserRuntimeCaches().finally(() => {
          this._reloadTimer = setTimeout(() => window.location.reload(), 300);
        });
      }
      return;
    }
    if (isHmrContextError(error?.message || "")) {
      const reloadCount = parseInt(sessionStorage.getItem("_eb_reloads") || "0", 10);
      if (reloadCount < 2) {
        sessionStorage.setItem("_eb_reloads", String(reloadCount + 1));
        this._reloadTimer = setTimeout(() => window.location.reload(), 800);
      }
    }
  }

  public componentWillUnmount() {
    if (this._reloadTimer) clearTimeout(this._reloadTimer);
  }

  public render() {
    if (this.state.hasError) {
      const isHmr = isHmrContextError(this.state.errorMsg);
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50 dark:bg-gray-900 text-center">
          <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6 text-3xl">
            ⚠️
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">د سیسټم په ښکاره کولو کې ستونزه رامنځته شوه</h1>
          <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
            {isHmr
              ? "سیسټم اتوماتیک بیا پیل کیږي…"
              : "مهرباني وکړئ صفحه بیا تازه کړئ یا د سیسټم اډمین سره اړیکه ونیسئ. ستاسو ډاټا خوندي ده."}
          </p>
          {!isHmr && this.state.errorMsg && (
            <div className="mb-6 max-w-xl w-full text-left bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs font-bold text-red-700 mb-1">Error:</p>
              <p className="text-xs text-red-600 font-mono break-all">{this.state.errorMsg}</p>
              {this.state.errorStack && (
                <details className="mt-2">
                  <summary className="text-xs text-red-500 cursor-pointer">Stack trace</summary>
                  <pre className="text-xs text-red-400 mt-1 overflow-auto max-h-40 whitespace-pre-wrap">{this.state.errorStack}</pre>
                </details>
              )}
            </div>
          )}
          {isHmr ? (
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          ) : (
            <div className="flex gap-4">
              <Button onClick={() => window.location.reload()}>صفحه تازه کول</Button>
              <Button variant="outline" onClick={() => window.location.href = "/"}>لوحه اصلي ته تلل</Button>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
