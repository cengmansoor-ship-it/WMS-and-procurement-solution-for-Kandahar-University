export const DATA_CHANGED_EVENT = "wms:data-changed";

export interface DataChangeDetail {
  id: string;
  path: string;
  method: "POST" | "PUT" | "DELETE";
  timestamp: number;
  remote: boolean;
}

const STORAGE_KEY = "wms:last-data-change";
const CHANNEL_NAME = "wms-data-sync";
const sourceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const seen = new Set<string>();

let channel: BroadcastChannel | null = null;

const dispatch = (detail: DataChangeDetail) => {
  if (seen.has(detail.id)) return;
  seen.add(detail.id);
  if (seen.size > 200) {
    const first = seen.values().next().value;
    if (first) seen.delete(first);
  }
  window.dispatchEvent(new CustomEvent<DataChangeDetail>(DATA_CHANGED_EVENT, { detail }));
};

if (typeof window !== "undefined") {
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = event => {
      if (!event.data || event.data.sourceId === sourceId) return;
      dispatch({ ...event.data.detail, remote: true });
    };
  }

  window.addEventListener("storage", event => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue);
      if (payload.sourceId === sourceId) return;
      dispatch({ ...payload.detail, remote: true });
    } catch {
      // Ignore malformed or legacy storage values.
    }
  });
}

export function publishDataChange(
  path: string,
  method: DataChangeDetail["method"]
) {
  if (typeof window === "undefined") return;
  const detail: DataChangeDetail = {
    id: `${sourceId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    path,
    method,
    timestamp: Date.now(),
    remote: false,
  };
  dispatch(detail);
  const payload = { sourceId, detail };
  channel?.postMessage(payload);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // BroadcastChannel and same-window events still keep synchronization alive.
  }
}

export function subscribeDataChanges(
  listener: (detail: DataChangeDetail) => void
) {
  const handler = (event: Event) => {
    listener((event as CustomEvent<DataChangeDetail>).detail);
  };
  window.addEventListener(DATA_CHANGED_EVENT, handler);
  return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
}

const SHARED_REFERENCE_PATHS = [
  "/management/faculties",
  "/management/departments",
  "/management/people",
  "/inventory/items",
  "/inventory/categories",
  "/inventory/units",
  "/inventory/warehouses",
  "/users",
  "/budget/babs",
  "/budget/fasls",
  "/checklist",
];

export function isSharedReferenceChange(path: string) {
  return SHARED_REFERENCE_PATHS.some(prefix =>
    path === prefix ||
    path.startsWith(`${prefix}/`) ||
    path.startsWith(`${prefix}?`)
  );
}
