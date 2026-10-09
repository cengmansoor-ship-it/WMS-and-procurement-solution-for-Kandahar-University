import { createRoot } from "react-dom/client";
import "./index.css";
import "flatpickr/dist/flatpickr.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { LanguageProvider } from "./context/LanguageContext.tsx";
import { CalendarProvider } from "./context/CalendarContext.tsx";
import { installSessionGuard } from "./api/sessionGuard.ts";

installSessionGuard();

const STALE_ASSET_RELOAD_KEY = "kandahar_wms_stale_asset_reload_at";

const clearBrowserRuntimeCaches = async () => {
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
};

const messageFromErrorEvent = (eventOrReason: unknown) => {
  const value = (eventOrReason as any)?.reason || (eventOrReason as any)?.error || eventOrReason;
  return String(value?.message || value || "");
};

const isStaleDynamicImport = (message: string) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(message);

const reloadAfterStaleAsset = () => {
  const previous = Number(sessionStorage.getItem(STALE_ASSET_RELOAD_KEY) || "0");
  if (Date.now() - previous < 15000) return;
  sessionStorage.setItem(STALE_ASSET_RELOAD_KEY, String(Date.now()));
  clearBrowserRuntimeCaches().finally(() => window.location.reload());
};

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadAfterStaleAsset();
});

window.addEventListener("unhandledrejection", (event) => {
  const message = messageFromErrorEvent(event);
  if (isStaleDynamicImport(message)) {
    event.preventDefault();
    reloadAfterStaleAsset();
  }
});

window.addEventListener("error", (event) => {
  const message = messageFromErrorEvent(event);
  if (isStaleDynamicImport(message)) reloadAfterStaleAsset();
});

// Remove the old service worker so it cannot serve stale cached pages.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    clearBrowserRuntimeCaches();
  });
}

// Apply saved font size before first render
const FONT_SIZE_MAP: Record<string, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
  xlarge: "20px",
};
const savedFontSize = localStorage.getItem("wms_font_size") || "medium";
document.documentElement.style.setProperty("--base-font-size", FONT_SIZE_MAP[savedFontSize] ?? "16px");

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <LanguageProvider>
      <CalendarProvider>
        <AuthProvider>
          <AppWrapper>
            <App />
          </AppWrapper>
        </AuthProvider>
      </CalendarProvider>
    </LanguageProvider>
  </ThemeProvider>,
);
