const PUBLIC_AUTH_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/forgot-password/",
  "/api/delegations/login",
  "/api/health",
  "/api/time/now",
];

const DEMO_AUTH_KEY = "kandahar_wms_demo_auth_user";
const DEMO_AUTH_EXPLICIT_KEY = "kandahar_wms_demo_auth_explicit";
const REDIRECT_GUARD_KEY = "wms_session_redirect_at";

const isApiUrl = (value: string) => {
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
};

const isPublicAuthPath = (value: string) => {
  const url = new URL(value, window.location.origin);
  return PUBLIC_AUTH_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(path));
};

export const installSessionGuard = () => {
  const marker = "__wms_session_guard_installed__";
  const globalState = window as unknown as Record<string, unknown>;
  if (globalState[marker]) return;
  globalState[marker] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl =
      typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const apiRequest = isApiUrl(requestUrl);
    const response = await originalFetch(input, apiRequest
      ? { credentials: "same-origin", ...init }
      : init);

    if (
      apiRequest &&
      response.status === 401 &&
      !isPublicAuthPath(requestUrl) &&
      !window.location.pathname.startsWith("/signin")
    ) {
      window.localStorage.removeItem(DEMO_AUTH_KEY);
      window.localStorage.removeItem(DEMO_AUTH_EXPLICIT_KEY);
      const previous = Number(window.sessionStorage.getItem(REDIRECT_GUARD_KEY) || "0");
      if (Date.now() - previous > 5000) {
        window.sessionStorage.setItem(REDIRECT_GUARD_KEY, String(Date.now()));
        window.location.assign("/signin?reason=session");
      }
    }

    return response;
  };
};

