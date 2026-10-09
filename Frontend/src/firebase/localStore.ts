import { ROLES } from "../constants/roles";
import type { UserProfile } from "./firestore";
import type { WarehouseItem, StockTransaction } from "./inventory";
import type { InventoryRequest, PipelineRecord, RequestLevelRecord } from "./requests";

const PREFIX = "kandahar_wms_";

// ── Data version: bump this string to force a full reseed on all clients ──
const DATA_VERSION = "fy1404-clean-v3";

const BASE_TS = new Date(2026, 4, 14, 8, 0, 0).getTime(); // May 14 2026 = "today"
const Y1     = new Date(2025, 4, 14, 8, 0, 0).getTime(); // May 14 2025 = one year ago
const M      = 2629800000; // ≈ one calendar month in ms
const D      = 86400000;   // one day in ms

const now = () => Date.now();
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// timestamp helpers: mo=month offset from Y1, d=day-within-month offset
const ts = (mo: number, d = 0) => Y1 + mo * M + d * D;

// ── Shamsi month labels for 12-month span (1404/03 → 1405/02) ──
const SH = [
  "۱۴۰۴/۰۳/۱۰","۱۴۰۴/۰۴/۱۰","۱۴۰۴/۰۵/۱۰","۱۴۰۴/۰۶/۱۰",
  "۱۴۰۴/۰۷/۱۰","۱۴۰۴/۰۸/۱۰","۱۴۰۴/۰۹/۱۰","۱۴۰۴/۱۰/۱۰",
  "۱۴۰۴/۱۱/۱۰","۱۴۰۴/۱۲/۱۰","۱۴۰۵/۰۱/۱۰","۱۴۰۵/۰۲/۱۰",
];
const QM = [
  "۱۴۴۶/۱۲/۲۲","۱۴۴۷/۰۱/۲۳","۱۴۴۷/۰۲/۲۴","۱۴۴۷/۰۳/۲۴",
  "۱۴۴۷/۰۴/۲۵","۱۴۴۷/۰۵/۲۵","۱۴۴۷/۰۶/۲۵","۱۴۴۷/۰۷/۲۶",
  "۱۴۴۷/۰۸/۲۶","۱۴۴۷/۰۹/۲۶","۱۴۴۷/۱۰/۲۷","۱۴۴۷/۱۱/۲۷",
];

// Per-month request dates (day 5 of each month for request creation)
const REQ_SH = [
  "۱۴۰۴/۰۳/۰۵","۱۴۰۴/۰۴/۰۵","۱۴۰۴/۰۵/۰۵","۱۴۰۴/۰۶/۰۵",
  "۱۴۰۴/۰۷/۰۵","۱۴۰۴/۰۸/۰۵","۱۴۰۴/۰۹/۰۵","۱۴۰۴/۱۰/۰۵",
  "۱۴۰۴/۱۱/۰۵","۱۴۰۴/۱۲/۰۵","۱۴۰۵/۰۱/۰۵","۱۴۰۵/۰۲/۰۵",
];
const REQ_QM = [
  "۱۴۴۶/۱۲/۱۷","۱۴۴۷/۰۱/۱۸","۱۴۴۷/۰۲/۱۸","۱۴۴۷/۰۳/۱۹",
  "۱۴۴۷/۰۴/۱۹","۱۴۴۷/۰۵/۲۰","۱۴۴۷/۰۶/۲۰","۱۴۴۷/۰۷/۲۰",
  "۱۴۴۷/۰۸/۲۱","۱۴۴۷/۰۹/۲۱","۱۴۴۷/۱۰/۲۲","۱۴۴۷/۱۱/۲۲",
];

// ────────────────────────────────────────────────
// LocalStorage helpers
// ────────────────────────────────────────────────
export type DemoEmailLog = {
  id: string; to: string; subject: string; body: string;
  relatedRequestId?: string; requestLevel?: string;
  status: "Draft" | "Sent" | "Queued";
  createdAt: number; createdAtHijriShamsi: string; createdAtHijriQamari: string;
};
export type DemoSeedUser = UserProfile & { password: string };

export const DEMO_USER_PROFILE: UserProfile = {
  uid: "seed_super_admin", name: "Super Admin", email: "superadmin@ku.edu.af",
  phone: "", role: ROLES.SUPER_ADMIN, active: true, forcePasswordChange: false,
  createdAt: now(), updatedAt: now(),
};

export const DEMO_SEED_USERS: DemoSeedUser[] = [
  { uid:"seed_super_admin",        name:"Enayatullah Mansoor",   email:"superadmin@ku.edu.af",   phone:"0700100001", password:"SuperAdmin@1",  role:ROLES.SUPER_ADMIN,            active:true, forcePasswordChange:false, createdAt:Y1, updatedAt:Y1, person_id:1, department_id:1 },
  { uid:"seed_admin",              name:"Fazalrahman Mayar",     email:"admin@ku.edu.af",         phone:"0700100002", password:"Admin@1234",    role:ROLES.ADMIN,                  active:true, forcePasswordChange:false, createdAt:Y1, updatedAt:Y1, person_id:2, department_id:2 },
  { uid:"seed_procurement",        name:"Abdulhadi Rahimi",      email:"procurement@ku.edu.af",   phone:"0700100003", password:"Procure@123",   role:ROLES.PROCUREMENT_DIRECTOR,   active:true, forcePasswordChange:false, createdAt:Y1, updatedAt:Y1, person_id:3, department_id:3 },
  { uid:"seed_warehouse_director", name:"Nazirahmad Bashare",    email:"warehouse@ku.edu.af",     phone:"0700100004", password:"Warehouse@1",   role:ROLES.WAREHOUSE_DIRECTOR,     active:true, forcePasswordChange:false, createdAt:Y1, updatedAt:Y1, person_id:4, department_id:4 },
  { uid:"seed_requester",          name:"Afghan Sahib",          email:"requester@ku.edu.af",     phone:"0700100005", password:"Request@123",   role:ROLES.REQUESTER,              active:true, forcePasswordChange:false, createdAt:Y1, updatedAt:Y1, person_id:5, department_id:6, faculty_id:1 },
  { uid:"seed_confirmer",          name:"Doostyar Sahib",        email:"confirmer@ku.edu.af",     phone:"0700100006", password:"Confirm@123",   role:ROLES.REQUEST_CONFIRMER,      active:true, forcePasswordChange:false, createdAt:Y1, updatedAt:Y1, person_id:6, department_id:6, faculty_id:1 },
  { uid:"seed_entry",              name:"Mansoor Ahmad",         email:"entry@ku.edu.af",         phone:"0700100007", password:"Entry@1234",    role:ROLES.WAREHOUSE_ENTRY_PERSON, active:true, forcePasswordChange:false, createdAt:Y1, updatedAt:Y1, person_id:7, department_id:5 },
];

export function getLocalItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

export function setLocalItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

// ── In-app notification system ──
export type InAppNotification = {
  id: string;
  type: "received" | "delivered" | "approved" | "rejected" | "info";
  titlePs: string;
  titleDr: string;
  bodyPs: string;
  bodyDr: string;
  requestId?: string;
  createdAt: number;
  read: boolean;
};

export function getInAppNotifications(): InAppNotification[] {
  return getLocalItem<InAppNotification[]>("in_app_notifications", []);
}

export function addInAppNotification(n: Omit<InAppNotification, "id" | "read" | "createdAt">): void {
  const notif: InAppNotification = {
    ...n,
    id: uid("notif"),
    read: false,
    createdAt: Date.now(),
  };
  const existing = getInAppNotifications();
  setLocalItem("in_app_notifications", [notif, ...existing].slice(0, 50));
}

export function markAllNotificationsRead(): void {
  const all = getInAppNotifications().map(n => ({ ...n, read: true }));
  setLocalItem("in_app_notifications", all);
}

// ── Demo auth key (must match auth.ts) ──
const DEMO_AUTH_KEY = "kandahar_wms_demo_auth_user";
// ── Explicit-logout flag: set when user calls logout(), cleared on login() ──
export const DEMO_LOGGED_OUT_KEY = "kandahar_wms_user_logged_out";

// ── Auto-restore demo auth session ONLY on fresh install ──
// Does NOT restore if the user explicitly logged out (DEMO_LOGGED_OUT_KEY is set).
function restoreDemoAuth(_isFreshInstall: boolean): void {
  if (typeof window === "undefined") return;
  return;
}

// ── Version gate: clears all seed keys when DATA_VERSION changes ──
export function ensureSeedVersion(): void {
  if (typeof window === "undefined") return;
  const stored = getLocalItem<string>("data_version", "");
  const isFreshInstall = stored !== DATA_VERSION;
  // Only auto-restore on fresh install, not after explicit logout
  restoreDemoAuth(isFreshInstall);
  if (!isFreshInstall) return;
  const seedKeys = [
    "items","stock_transactions","requests","request_pipeline",
    "request_level_history","email_logs","users",
  ];
  seedKeys.forEach(k => window.localStorage.removeItem(PREFIX + k));
  setLocalItem("data_version", DATA_VERSION);
}

export function getDemoUserProfile(email?: string | null): UserProfile {
  const normalized = (email || "").trim().toLowerCase();
  // Check localStorage-saved users first (may have been updated via UserManagement)
  const savedUsers = getLocalItem<UserProfile[]>("users", []);
  const fromSaved = savedUsers.find(u => u.email.toLowerCase() === normalized);
  if (fromSaved) {
    // Merge traceability fields from seed if missing (backwards-compat for cached users)
    const seedMatch = DEMO_SEED_USERS.find(u => u.email.toLowerCase() === normalized);
    const merged = seedMatch && (fromSaved.person_id == null)
      ? { ...fromSaved, person_id: seedMatch.person_id, faculty_id: seedMatch.faculty_id, department_id: seedMatch.department_id }
      : fromSaved;
    setLocalItem("demo_profile", merged);
    return merged;
  }
  // Fall back to seed users
  const matched = DEMO_SEED_USERS.find(u => u.email.toLowerCase() === normalized);
  const profile = matched || { ...DEMO_USER_PROFILE, email: email || DEMO_USER_PROFILE.email, updatedAt: now() };
  setLocalItem("demo_profile", profile);
  return profile;
}

export function getDemoUsers(): UserProfile[] {
  const saved = getLocalItem<UserProfile[]>("users", []);
  if (saved.length > 0) return saved;
  setLocalItem("users", DEMO_SEED_USERS);
  return DEMO_SEED_USERS;
}

// ════════════════════════════════════════════════════════════════
// ITEMS — returns only real data entered by users (no seed data)
// ════════════════════════════════════════════════════════════════
export function seedDemoItems(): WarehouseItem[] {
  ensureSeedVersion();
  return getLocalItem<WarehouseItem[]>("items", []);
}

// ── REMOVED SEED DATA BLOCK (replaced by empty return above) ──
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _unusedItemsBlock(): WarehouseItem[] {
  const items: WarehouseItem[] = [
    // ── Stationery ──────────────────────────────────────────────
    {
      id:"demo_item_1", name:"A4 کاغذ", category:"قرطاسیه",
      typeOrSpecification:"۷۰ ګرامه سپین کاغذ", unit:"ریمه",
      currentQuantity:51, minimumStockLevel:15, unitPrice:250,
      supplierOrSource:"افغان دفتري لوازم شرکت",
      description:"د دفترونو او صنفونو لپاره سپین A4 کاغذ",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_2", name:"قلم", category:"قرطاسیه",
      typeOrSpecification:"آبي رنګ بالپوینټ", unit:"دانه",
      currentQuantity:115, minimumStockLevel:30, unitPrice:15,
      supplierOrSource:"نجیب تجارتي شرکت",
      description:"د ورځني اداري کار لپاره بالپوینټ قلمونه",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_3", name:"پرنټر ټونر HP 12A", category:"کمپیوټري وسایل",
      typeOrSpecification:"HP LaserJet 1010/1015/1020", unit:"دانه",
      currentQuantity:5, minimumStockLevel:4, unitPrice:1800,
      supplierOrSource:"د کندهار ټیکنالوژي شرکت",
      description:"د اداري چاپ لپاره اصلي HP ټونر کارتریج",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_4", name:"چوکي", category:"فرنیچر",
      typeOrSpecification:"فلزي اداري چوکي", unit:"دانه",
      currentQuantity:8, minimumStockLevel:6, unitPrice:2200,
      supplierOrSource:"کندهار فرنیچر شرکت",
      description:"د صنفونو او دفترونو لپاره فلزي چوکي",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_5", name:"شبکې کیبل Cat6", category:"شبکه",
      typeOrSpecification:"UTP Cat6 - 305m رول", unit:"متر",
      currentQuantity:186, minimumStockLevel:80, unitPrice:25,
      supplierOrSource:"د کندهار ټیکنالوژي شرکت",
      description:"د شبکې لپاره Cat6 UTP کیبل",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_6", name:"کاپي", category:"قرطاسیه",
      typeOrSpecification:"۱۰۰ مخيزه A4 کاپي", unit:"دانه",
      currentQuantity:55, minimumStockLevel:20, unitPrice:40,
      supplierOrSource:"نجیب تجارتي شرکت",
      description:"د محصلینو او اداري کار لپاره کاپي",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_7", name:"وایټ بورډ مارکر", category:"قرطاسیه",
      typeOrSpecification:"ګڼ رنګیز، مچیدونکی", unit:"دانه",
      currentQuantity:12, minimumStockLevel:10, unitPrice:45,
      supplierOrSource:"افغان دفتري لوازم شرکت",
      description:"د صنفونو لپاره وایټ بورډ مارکر",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_8", name:"میز", category:"فرنیچر",
      typeOrSpecification:"فلزي اداري میز ۱۲۰×۶۰ سم", unit:"دانه",
      currentQuantity:6, minimumStockLevel:3, unitPrice:3500,
      supplierOrSource:"کندهار فرنیچر شرکت",
      description:"د دفترونو لپاره فلزي اداري میز",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_9", name:"پرنټر HP LaserJet M1005", category:"کمپیوټري وسایل",
      typeOrSpecification:"A4 لیزر پرنټر ۱۴ ppm", unit:"دانه",
      currentQuantity:4, minimumStockLevel:2, unitPrice:8500,
      supplierOrSource:"د کندهار ټیکنالوژي شرکت",
      description:"د اداري چاپ لپاره لیزر پرنټر",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_10", name:"پروجیکتور", category:"کمپیوټري وسایل",
      typeOrSpecification:"Epson EB-X41 - 3300 لومن", unit:"دانه",
      currentQuantity:5, minimumStockLevel:2, unitPrice:15000,
      supplierOrSource:"د پوهنتون تجهیزاتي شرکت",
      description:"د صنفونو لپاره XGA پروجیکتور",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_11", name:"ماوس", category:"کمپیوټري وسایل",
      typeOrSpecification:"USB اپتیکل ماوس", unit:"دانه",
      currentQuantity:22, minimumStockLevel:8, unitPrice:250,
      supplierOrSource:"د کندهار ټیکنالوژي شرکت",
      description:"د کمپیوټرونو لپاره USB ماوس",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_12", name:"کیبورډ", category:"کمپیوټري وسایل",
      typeOrSpecification:"USB پښتو/انګلیسي کیبورډ", unit:"دانه",
      currentQuantity:18, minimumStockLevel:8, unitPrice:400,
      supplierOrSource:"د کندهار ټیکنالوژي شرکت",
      description:"د کمپیوټرونو لپاره دوه ژبیز کیبورډ",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_13", name:"فلش ډرایو 32GB", category:"کمپیوټري وسایل",
      typeOrSpecification:"USB 3.0 - 32GB", unit:"دانه",
      currentQuantity:6, minimumStockLevel:8, unitPrice:350,
      supplierOrSource:"د کندهار ټیکنالوژي شرکت",
      description:"د ډیټا لیږد لپاره USB فلش ډرایو — موجودي د لږ تر لږه کچې لاندې ده",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_14", name:"اکسټینشن کارډ", category:"برقي تجهیزات",
      typeOrSpecification:"۵ پلاکه - ۳ متره کیبل", unit:"دانه",
      currentQuantity:15, minimumStockLevel:6, unitPrice:180,
      supplierOrSource:"نجیب تجارتي شرکت",
      description:"د دفترونو لپاره د برق اکسټینشن",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_15", name:"سټیپلر", category:"قرطاسیه",
      typeOrSpecification:"26/6 - 25 مخیزه", unit:"دانه",
      currentQuantity:20, minimumStockLevel:6, unitPrice:120,
      supplierOrSource:"افغان دفتري لوازم شرکت",
      description:"د اسنادو د یوځای کولو لپاره سټیپلر",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_16", name:"قیچي", category:"قرطاسیه",
      typeOrSpecification:"اداري قیچي ۲۱ سم", unit:"دانه",
      currentQuantity:11, minimumStockLevel:5, unitPrice:60,
      supplierOrSource:"افغان دفتري لوازم شرکت",
      description:"د دفترونو لپاره اداري قیچي",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_17", name:"فایل فولډر", category:"قرطاسیه",
      typeOrSpecification:"A4 پلاستیکي فایل", unit:"دانه",
      currentQuantity:78, minimumStockLevel:30, unitPrice:25,
      supplierOrSource:"افغان دفتري لوازم شرکت",
      description:"د اسنادو د ساتلو لپاره A4 فایل فولډر",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_18", name:"وایټ بورډ", category:"تعلیمي وسایل",
      typeOrSpecification:"۱۲۰×۹۰ سم - ممغناطیسي", unit:"دانه",
      currentQuantity:4, minimumStockLevel:2, unitPrice:3200,
      supplierOrSource:"د پوهنتون تجهیزاتي شرکت",
      description:"د صنفونو لپاره ممغناطیسي وایټ بورډ",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_19", name:"حسابګر", category:"قرطاسیه",
      typeOrSpecification:"۱۲ رقمه - لمریز/برقي", unit:"دانه",
      currentQuantity:9, minimumStockLevel:4, unitPrice:450,
      supplierOrSource:"افغان دفتري لوازم شرکت",
      description:"د مالي او حسابي کارونو لپاره حسابګر",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
    {
      id:"demo_item_20", name:"صفایی مواد", category:"نظافت",
      typeOrSpecification:"ګڼ رنګیز پاکتونه - ۵ کیلو بسته", unit:"پاکټ",
      currentQuantity:28, minimumStockLevel:15, unitPrice:80,
      supplierOrSource:"نجیب تجارتي شرکت",
      description:"د دفترونو او صنفونو د صفایۍ لپاره مواد",
      createdBy:"seed_super_admin", updatedBy:"seed_entry",
      createdAt:ts(0), updatedAt:BASE_TS,
      createdAtHijriShamsi:"۱۴۰۴/۰۳/۱۴", createdAtHijriQamari:"۱۴۴۶/۱۲/۲۶",
      updatedAtHijriShamsi:"۱۴۰۵/۰۲/۲۴", updatedAtHijriQamari:"۱۴۴۷/۱۱/۲۷",
      isDeleted:false,
    },
  ];
  setLocalItem("items", items);
  return items;
}

// ════════════════════════════════════════════════════════════════
// STOCK TRANSACTIONS — 12 months × 20 items with seasonal patterns
// Higher usage at semester starts (M0=May, M3=Aug, M6=Nov)
// ════════════════════════════════════════════════════════════════
export function seedDemoTransactions(): StockTransaction[] {
  ensureSeedVersion();
  return getLocalItem<StockTransaction[]>("stock_transactions", []);
  // ── seed data removed ──
  const itemDefs: [string, string, string, number[], number[], number][] = [
    // Paper — heavy seasonal use (peak M3=Aug semester start, M0=May)
    ["demo_item_1","A4 کاغذ","ریمه",
      [30,25,35,40,20,30,35,25,20,15,20,25],
      [28,22,32,36,18,25,32,23,18,14,18,23], 20],
    // Pens — very high turnover
    ["demo_item_2","قلم","دانه",
      [60,40,70,80,30,50,70,50,30,20,30,45],
      [55,35,62,72,25,44,64,45,26,16,26,40], 50],
    // Toner — slow turnover
    ["demo_item_3","پرنټر ټونر HP 12A","دانه",
      [5,4,6,7,3,5,6,4,3,2,3,4],
      [4,3,5,6,2,4,5,3,2,2,3,3], 4],
    // Chairs — bulk received in M2(Jul) and M5(Oct) via procurement
    ["demo_item_4","چوکي","دانه",
      [0,0,12,0,0,14,0,0,0,0,0,0],
      [1,1,2,1,1,2,1,1,1,1,0,1], 4],
    // Network Cable — bulk restocks at semester start
    ["demo_item_5","شبکې کیبل Cat6","متر",
      [0,100,0,0,150,0,0,0,80,0,0,0],
      [25,30,20,15,28,22,18,12,10,8,12,16], 42],
    // Notebooks — semester-start peaks
    ["demo_item_6","کاپي","دانه",
      [30,20,40,50,15,30,45,25,15,10,15,25],
      [25,16,34,44,11,25,40,21,12,8,12,20], 20],
    // Whiteboard Markers — steady with peaks
    ["demo_item_7","وایټ بورډ مارکر","دانه",
      [15,10,18,20,8,15,18,12,8,6,8,12],
      [14,9,17,19,7,14,17,11,7,6,7,11], 8],
    // Desks — rare procurement
    ["demo_item_8","میز","دانه",
      [0,0,4,0,0,5,0,0,0,0,0,0],
      [0,0,1,0,0,1,0,1,0,0,0,0], 0],
    // Printer — rare procurement
    ["demo_item_9","پرنټر HP LaserJet M1005","دانه",
      [0,0,0,2,0,0,3,0,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0], 0],
    // Projector — semester-start procurement
    ["demo_item_10","پروجیکتور","دانه",
      [0,0,0,3,0,0,3,0,0,0,0,0],
      [0,0,0,0,0,1,0,0,0,0,0,0], 0],
    // Mouse — steady medium turnover
    ["demo_item_11","ماوس","دانه",
      [8,6,10,12,5,8,10,8,5,4,5,8],
      [6,5,8,10,4,6,8,6,4,3,4,6], 10],
    // Keyboard — steady medium turnover
    ["demo_item_12","کیبورډ","دانه",
      [8,5,10,12,4,8,10,6,4,3,4,8],
      [6,4,8,10,3,6,8,5,3,3,3,6], 6],
    // Flash Drive — high demand, shortage now
    ["demo_item_13","فلش ډرایو 32GB","دانه",
      [10,8,12,15,5,10,12,8,5,0,0,0],
      [8,7,10,13,5,9,11,7,5,4,3,4], 8],
    // Extension Cord — steady
    ["demo_item_14","اکسټینشن کارډ","دانه",
      [5,3,6,8,3,5,6,4,3,0,3,4],
      [4,3,5,7,2,4,5,3,2,2,2,3], 6],
    // Stapler — slow turnover
    ["demo_item_15","سټیپلر","دانه",
      [5,3,6,8,3,5,6,4,3,2,3,4],
      [3,2,4,6,2,3,5,3,2,1,2,3], 8],
    // Scissors — very slow
    ["demo_item_16","قیچي","دانه",
      [3,2,4,5,2,3,4,3,2,1,2,3],
      [2,2,3,4,1,2,3,2,1,1,1,2], 6],
    // File Folder — high volume
    ["demo_item_17","فایل فولډر","دانه",
      [25,15,30,35,12,20,35,20,12,8,12,20],
      [20,12,25,30,10,16,30,17,10,6,10,16], 20],
    // Whiteboard — rare procurement
    ["demo_item_18","وایټ بورډ","دانه",
      [0,0,2,0,0,3,0,0,0,0,0,0],
      [0,0,0,1,0,0,1,0,0,0,0,0], 1],
    // Calculator — medium demand
    ["demo_item_19","حسابګر","دانه",
      [5,3,7,8,3,5,7,4,3,2,3,4],
      [4,2,5,7,2,4,6,3,2,1,2,3], 3],
    // Cleaning Supplies — steady monthly
    ["demo_item_20","صفایی مواد","پاکټ",
      [8,6,10,10,5,8,10,8,5,4,5,8],
      [6,5,8,9,4,6,9,7,4,3,4,7], 10],
  ];

  const transactions: StockTransaction[] = [];

  itemDefs.forEach(([itemId, itemName, unit, inQtys, outQtys, startBal]) => {
    let balance = startBal;
    for (let mo = 0; mo < 12; mo++) {
      const inQty = inQtys[mo];
      const outQty = outQtys[mo];
      const tBase = ts(mo, 5);

      if (inQty > 0) {
        transactions.push({
          id: `ytx_in_${itemId}_m${mo}`,
          itemId, itemName, type: "IN", quantity: inQty, unit,
          stockBefore: balance, stockAfter: balance + inQty,
          reason: mo === 0 || mo === 3 || mo === 6
            ? "د نوي ټرم لپاره د ابتداي موجودي ډیرول"
            : "د میاشتني تدارک له مخې د ګدام ډکول",
          performedBy: "seed_entry", performedByName: "Mansoor Ahmad",
          performedByRole: ROLES.WAREHOUSE_ENTRY_PERSON,
          createdAt: tBase + 3600000,
          createdAtHijriShamsi: SH[mo], createdAtHijriQamari: QM[mo],
        } as StockTransaction);
        balance += inQty;
      }

      if (outQty > 0 && balance > 0) {
        const actualOut = Math.min(outQty, balance);
        transactions.push({
          id: `ytx_out_${itemId}_m${mo}`,
          itemId, itemName, type: "OUT", quantity: actualOut, unit,
          stockBefore: balance, stockAfter: balance - actualOut,
          reason: "د غوښتنې له مخې تسلیمي",
          requestId: `req_y1_${String((mo % 10) + 1).padStart(2,"0")}`,
          performedBy: "seed_warehouse_director",
          performedByName: "Nazirahmad Bashare",
          performedByRole: ROLES.WAREHOUSE_DIRECTOR,
          createdAt: tBase + 7200000,
          createdAtHijriShamsi: SH[mo], createdAtHijriQamari: QM[mo],
        } as StockTransaction);
        balance -= actualOut;
      }
    }
  });

  transactions.sort((a, b) => b.createdAt - a.createdAt);
  setLocalItem("stock_transactions", transactions);
  return transactions;
}

export function getDemoTransactions(): StockTransaction[] { return seedDemoTransactions(); }
export function saveDemoTransactions(t: StockTransaction[]): void { setLocalItem("stock_transactions", t); }

// ════════════════════════════════════════════════════════════════
// REQUESTS — 20 requests spanning the full year 1404 (M0–M11)
// ════════════════════════════════════════════════════════════════
function seedDemoRequests(): InventoryRequest[] {
  ensureSeedVersion();
  return getLocalItem<InventoryRequest[]>('requests', []);
}

export function getDemoRequests(): InventoryRequest[] { return seedDemoRequests(); }
export function saveDemoRequests(r: InventoryRequest[]): void { setLocalItem("requests", r); }

// ════════════════════════════════════════════════════════════════
// PIPELINE — full authorization chain for all 20 requests
// Shows: Requester → Confirmer → SuperAdmin → Admin/Warehouse →
//        Procurement (if needed) → Delivery
// ════════════════════════════════════════════════════════════════
function seedDemoPipeline(): PipelineRecord[] {
  ensureSeedVersion();
  return getLocalItem<PipelineRecord[]>("request_pipeline", []);
  // ── seed data removed ──
  const existing = getLocalItem<PipelineRecord[]>("request_pipeline", []);

  // Helper to build the standard 5-stage "stock available → delivered" chain
  const stockChain = (
    reqId: string, mo: number,
    sh: string[], qm: string[],
    delivDayOffset = 15,
  ): PipelineRecord[] => [
    { id:`pp_${reqId}_1`, requestId:reqId, stage:"غوښتنه ثبت شوه",       status:"Submitted",                  progress:0,   actionBy:"seed_requester",   actionByName:"Afghan Sahib",       actionByRole:ROLES.REQUESTER,              comment:"لومړنۍ غوښتنه ثبت شوه.",              createdAt:ts(mo,5)+1000,  createdAtHijriShamsi:sh[0], createdAtHijriQamari:qm[0] },
    { id:`pp_${reqId}_2`, requestId:reqId, stage:"د تاییدوونکي تایید",   status:"ConfirmedByRequestConfirmer", progress:5,   actionBy:"seed_confirmer",   actionByName:"Doostyar Sahib",     actionByRole:ROLES.REQUEST_CONFIRMER,      comment:"غوښتنه تایید شوه، درجه سمه ده.",      createdAt:ts(mo,6)+1000,  createdAtHijriShamsi:sh[1], createdAtHijriQamari:qm[1] },
    { id:`pp_${reqId}_3`, requestId:reqId, stage:"د سوپر اډمین تایید",   status:"ApprovedBySuperAdmin",        progress:10,  actionBy:"seed_super_admin", actionByName:"Enayatullah Mansoor", actionByRole:ROLES.SUPER_ADMIN,            comment:"اداري اجازه ورکړل شوه.",              createdAt:ts(mo,7)+1000,  createdAtHijriShamsi:sh[2], createdAtHijriQamari:qm[2] },
    { id:`pp_${reqId}_4`, requestId:reqId, stage:"ګدام ته واستول شوه",   status:"StockAvailable",              progress:20,  actionBy:"seed_admin",       actionByName:"Fazalrahman Mayar",   actionByRole:ROLES.ADMIN,                  comment:"جنس د ګدام کې موجود دی.",             createdAt:ts(mo,8)+1000,  createdAtHijriShamsi:sh[3], createdAtHijriQamari:qm[3] },
    { id:`pp_${reqId}_5`, requestId:reqId, stage:"ف س ۵ او تسلیمي",      status:"Delivered",                  progress:100, actionBy:"seed_warehouse_director", actionByName:"Nazirahmad Bashare", actionByRole:ROLES.WAREHOUSE_DIRECTOR, comment:"جنس وسپارل شو، ف س ۵ لاسلیک شو.", createdAt:ts(mo,delivDayOffset)+1000, createdAtHijriShamsi:sh[4], createdAtHijriQamari:qm[4] },
  ];

  // Helper for procurement chain (stock not available)
  const procChain = (
    reqId: string, mo: number,
    sh: string[], qm: string[],
    lastStage: "TenderCreated"|"WinnerSelected"|"PurchaseOrderCreated"|"ReceiptRecorded"|"Delivered",
    levelEscalated = false,
  ): PipelineRecord[] => {
    const base: PipelineRecord[] = [
      { id:`pp_${reqId}_1`, requestId:reqId, stage:"غوښتنه ثبت شوه",       status:"Submitted",                  progress:0,  actionBy:"seed_requester",   actionByName:"Afghan Sahib",        actionByRole:ROLES.REQUESTER,            comment:"لومړنۍ غوښتنه ثبت شوه.",             createdAt:ts(mo,5)+1000,  createdAtHijriShamsi:sh[0], createdAtHijriQamari:qm[0] },
      { id:`pp_${reqId}_2`, requestId:reqId, stage:"د تاییدوونکي تایید",   status:"ConfirmedByRequestConfirmer", progress:5,  actionBy:"seed_confirmer",   actionByName:"Doostyar Sahib",      actionByRole:ROLES.REQUEST_CONFIRMER,    comment:"غوښتنه تایید شوه.",                   createdAt:ts(mo,6)+1000,  createdAtHijriShamsi:sh[1], createdAtHijriQamari:qm[1] },
      { id:`pp_${reqId}_3`, requestId:reqId, stage:"د سوپر اډمین تایید",   status:"ApprovedBySuperAdmin",        progress:10, actionBy:"seed_super_admin", actionByName:"Enayatullah Mansoor", actionByRole:ROLES.SUPER_ADMIN,          comment:"اداري اجازه ورکړل شوه.",             createdAt:ts(mo,7)+1000,  createdAtHijriShamsi:sh[2], createdAtHijriQamari:qm[2] },
      { id:`pp_${reqId}_4`, requestId:reqId, stage:"تدارکاتو ته واستول",   status:"StockNotAvailable",          progress:20, actionBy:"seed_admin",       actionByName:"Fazalrahman Mayar",   actionByRole:ROLES.ADMIN,                comment:"موجودي نشته، تدارکاتو ته واستول شوه.", createdAt:ts(mo,8)+1000,  createdAtHijriShamsi:sh[3], createdAtHijriQamari:qm[3] },
    ];
    if (["TenderCreated","WinnerSelected","PurchaseOrderCreated","ReceiptRecorded","Delivered"].includes(lastStage)) {
      base.push({ id:`pp_${reqId}_5`, requestId:reqId, stage:"جګړه پاڼه او قیمتونه", status:"TenderCreated",          progress:25, actionBy:"seed_procurement", actionByName:"Abdulhadi Rahimi", actionByRole:ROLES.PROCUREMENT_DIRECTOR, comment:`درې آفر شرکتونو وړاندې کړل.${levelEscalated?" درجه لوړه شوه.":""}`, createdAt:ts(mo,12)+1000, createdAtHijriShamsi:sh[5], createdAtHijriQamari:qm[5] });
    }
    if (["WinnerSelected","PurchaseOrderCreated","ReceiptRecorded","Delivered"].includes(lastStage)) {
      base.push({ id:`pp_${reqId}_6`, requestId:reqId, stage:"مقایسوي فورم",            status:"WinnerSelected",         progress:40, actionBy:"seed_procurement", actionByName:"Abdulhadi Rahimi", actionByRole:ROLES.PROCUREMENT_DIRECTOR, comment:"تر ټولو ټیټه بیه غوره شوه.",           createdAt:ts(mo,16)+1000, createdAtHijriShamsi:sh[6], createdAtHijriQamari:qm[6] });
    }
    if (["PurchaseOrderCreated","ReceiptRecorded","Delivered"].includes(lastStage)) {
      base.push({ id:`pp_${reqId}_7`, requestId:reqId, stage:"آمر خریداري",              status:"PurchaseOrderCreated",   progress:50, actionBy:"seed_procurement", actionByName:"Abdulhadi Rahimi", actionByRole:ROLES.PROCUREMENT_DIRECTOR, comment:"آمر خریداري جوړ شو او لاسلیک شو.",     createdAt:ts(mo,18)+1000, createdAtHijriShamsi:sh[7], createdAtHijriQamari:qm[7] });
    }
    if (["ReceiptRecorded","Delivered"].includes(lastStage)) {
      base.push({ id:`pp_${reqId}_8`, requestId:reqId, stage:"راپور رسید",               status:"ReceiptRecorded",        progress:75, actionBy:"seed_warehouse_director", actionByName:"Nazirahmad Bashare", actionByRole:ROLES.WAREHOUSE_DIRECTOR, comment:"جنس رسېد او ګدام ته داخل شو.",       createdAt:ts(mo,22)+1000, createdAtHijriShamsi:sh[8], createdAtHijriQamari:qm[8] });
    }
    if (lastStage === "Delivered") {
      base.push({ id:`pp_${reqId}_9`, requestId:reqId, stage:"ف س ۵ او تسلیمي",          status:"Delivered",              progress:100, actionBy:"seed_warehouse_director", actionByName:"Nazirahmad Bashare", actionByRole:ROLES.WAREHOUSE_DIRECTOR, comment:"جنس وسپارل شو، ف س ۵ لاسلیک شو.",  createdAt:ts(mo,26)+1000, createdAtHijriShamsi:sh[9], createdAtHijriQamari:qm[9] });
    }
    return base;
  };

  // Short date placeholder arrays per request (we reuse SH/QM with offsets for simplicity)
  const d = (mo: number) => {
    const s = SH.slice(mo).concat(SH.slice(0, mo));
    const q = QM.slice(mo).concat(QM.slice(0, mo));
    return [s, q] as [string[], string[]];
  };

  const [s0,q0] = d(0); const [s1,q1] = d(1); const [s2,q2] = d(2);
  const [s3,q3] = d(3); const [s4,q4] = d(4); const [s5,q5] = d(5);
  const [s6,q6] = d(6); const [s7,q7] = d(7); const [s8,q8] = d(8);
  const [s9,q9] = d(9); const [s10,q10] = d(10); const [s11,q11] = d(11);

  const records: PipelineRecord[] = [
    // Stock-available chains
    ...stockChain("req_y1_01", 0, s0, q0, 12),
    ...stockChain("req_y1_03", 1, s1, q1, 18),
    ...stockChain("req_y1_04", 1, s1, q1, 20),
    ...stockChain("req_y1_07", 3, s3, q3, 20),
    ...stockChain("req_y1_09", 4, s4, q4, 18),
    ...stockChain("req_y1_10", 4, s4, q4, 20),
    ...stockChain("req_y1_11", 5, s5, q5, 19),
    ...stockChain("req_y1_13", 6, s6, q6, 18),
    ...stockChain("req_y1_14", 6, s6, q6, 22),
    ...stockChain("req_y1_15", 7, s7, q7, 18),

    // Procurement chains — fully delivered
    ...procChain("req_y1_02", 0, s0, q0, "Delivered"),       // cable
    ...procChain("req_y1_05", 2, s2, q2, "Delivered"),       // chairs×12
    ...procChain("req_y1_06", 2, s2, q2, "Delivered"),       // whiteboards
    ...procChain("req_y1_08", 3, s3, q3, "Delivered", true), // projectors (escalated)

    // Procurement chain — ReceiptRecorded (chairs for economics)
    ...procChain("req_y1_12", 5, s5, q5, "ReceiptRecorded", true),

    // In-progress procurement
    ...procChain("req_y1_17", 8, s8, q8, "TenderCreated"),   // cleaning supplies
    ...procChain("req_y1_18", 9, s9, q9, "WinnerSelected"),  // markers

    // Partially approved (req_y1_16 StockAvailable — waiting delivery)
    { id:"pp_req_y1_16_1", requestId:"req_y1_16", stage:"غوښتنه ثبت شوه",     status:"Submitted",                  progress:0,  actionBy:"seed_requester",   actionByName:"Afghan Sahib",        actionByRole:ROLES.REQUESTER,         comment:"لومړنۍ غوښتنه ثبت شوه.",      createdAt:ts(8,5)+1000,  createdAtHijriShamsi:SH[8], createdAtHijriQamari:QM[8] },
    { id:"pp_req_y1_16_2", requestId:"req_y1_16", stage:"د تاییدوونکي تایید", status:"ConfirmedByRequestConfirmer", progress:5,  actionBy:"seed_confirmer",   actionByName:"Doostyar Sahib",      actionByRole:ROLES.REQUEST_CONFIRMER, comment:"غوښتنه تایید شوه.",            createdAt:ts(8,6)+1000,  createdAtHijriShamsi:SH[8], createdAtHijriQamari:QM[8] },
    { id:"pp_req_y1_16_3", requestId:"req_y1_16", stage:"د سوپر اډمین تایید", status:"ApprovedBySuperAdmin",        progress:10, actionBy:"seed_super_admin", actionByName:"Enayatullah Mansoor", actionByRole:ROLES.SUPER_ADMIN,       comment:"اداري اجازه ورکړل شوه.",      createdAt:ts(8,7)+1000,  createdAtHijriShamsi:SH[8], createdAtHijriQamari:QM[8] },
    { id:"pp_req_y1_16_4", requestId:"req_y1_16", stage:"ګدام ته واستول شوه", status:"StockAvailable",              progress:20, actionBy:"seed_admin",       actionByName:"Fazalrahman Mayar",   actionByRole:ROLES.ADMIN,             comment:"جنس موجود دی، د تسلیمۍ انتظار.", createdAt:ts(8,10)+1000, createdAtHijriShamsi:SH[8], createdAtHijriQamari:QM[8] },

    // req_y1_19 — ApprovedBySuperAdmin
    { id:"pp_req_y1_19_1", requestId:"req_y1_19", stage:"غوښتنه ثبت شوه",     status:"Submitted",                  progress:0,  actionBy:"seed_requester",   actionByName:"Afghan Sahib",        actionByRole:ROLES.REQUESTER,         comment:"لومړنۍ غوښتنه ثبت شوه.",      createdAt:ts(10,5)+1000, createdAtHijriShamsi:SH[10], createdAtHijriQamari:QM[10] },
    { id:"pp_req_y1_19_2", requestId:"req_y1_19", stage:"د تاییدوونکي تایید", status:"ConfirmedByRequestConfirmer", progress:5,  actionBy:"seed_confirmer",   actionByName:"Doostyar Sahib",      actionByRole:ROLES.REQUEST_CONFIRMER, comment:"غوښتنه تایید شوه.",            createdAt:ts(10,6)+1000, createdAtHijriShamsi:SH[10], createdAtHijriQamari:QM[10] },
    { id:"pp_req_y1_19_3", requestId:"req_y1_19", stage:"د سوپر اډمین تایید", status:"ApprovedBySuperAdmin",        progress:10, actionBy:"seed_super_admin", actionByName:"Enayatullah Mansoor", actionByRole:ROLES.SUPER_ADMIN,       comment:"اداري اجازه ورکړل شوه.",      createdAt:ts(10,9)+1000, createdAtHijriShamsi:SH[10], createdAtHijriQamari:QM[10] },

    // req_y1_20 — just submitted
    { id:"pp_req_y1_20_1", requestId:"req_y1_20", stage:"غوښتنه ثبت شوه",     status:"Submitted",                  progress:0,  actionBy:"seed_requester",   actionByName:"Afghan Sahib",        actionByRole:ROLES.REQUESTER,         comment:"لومړنۍ غوښتنه ثبت شوه.",      createdAt:ts(11,5)+1000, createdAtHijriShamsi:SH[11], createdAtHijriQamari:QM[11] },
  ];

  setLocalItem("request_pipeline", records);
  return records;
}

export function getDemoPipeline(): PipelineRecord[] { return seedDemoPipeline(); }
export function saveDemoPipeline(r: PipelineRecord[]): void { setLocalItem("request_pipeline", r); }

// ════════════════════════════════════════════════════════════════
// REQUEST LEVEL HISTORY — urgency escalations
// ════════════════════════════════════════════════════════════════
export function getDemoLevelHistory(): RequestLevelRecord[] {
  ensureSeedVersion();
  return getLocalItem<RequestLevelRecord[]>("request_level_history", []);
  // ── seed data removed ──
  const history: RequestLevelRecord[] = [
    {
      id:"level_y1_01", requestId:"req_y1_08",
      oldLevel:"ډېر مهم", newLevel:"ډېر عاجل",
      changedBy:"seed_procurement", changedByName:"Abdulhadi Rahimi",
      changedByRole:ROLES.PROCUREMENT_DIRECTOR,
      comment:"د پوهنځي له لوري د پروجیکتور ژر اړتیا ښودل شوه، درجه لوړه شوه.",
      changedAt:ts(3,12), changedAtHijriShamsi:"۱۴۰۴/۰۶/۲۲", changedAtHijriQamari:"۱۴۴۷/۰۳/۲۶",
    },
    {
      id:"level_y1_02", requestId:"req_y1_12",
      oldLevel:"متوسط", newLevel:"ډېر مهم",
      changedBy:"seed_procurement", changedByName:"Abdulhadi Rahimi",
      changedByRole:ROLES.PROCUREMENT_DIRECTOR,
      comment:"د اقتصاد پوهنځي د صنف د اړتیا له امله درجه لوړه شوه.",
      changedAt:ts(5,14), changedAtHijriShamsi:"۱۴۰۴/۰۸/۱۹", changedAtHijriQamari:"۱۴۴۷/۰۵/۲۹",
    },
    {
      id:"level_y1_03", requestId:"req_y1_02",
      oldLevel:"ډېر مهم", newLevel:"ډېر عاجل",
      changedBy:"seed_super_admin", changedByName:"Enayatullah Mansoor",
      changedByRole:ROLES.SUPER_ADMIN,
      comment:"د جوړیدونکي ودانۍ د شبکې کیبل ته فوري اړتیا ده.",
      changedAt:ts(0,8), changedAtHijriShamsi:"۱۴۰۴/۰۳/۱۸", changedAtHijriQamari:"۱۴۴۶/۱۲/۳۰",
    },
    {
      id:"level_y1_04", requestId:"req_y1_18",
      oldLevel:"عادي", newLevel:"متوسط",
      changedBy:"seed_procurement", changedByName:"Abdulhadi Rahimi",
      changedByRole:ROLES.PROCUREMENT_DIRECTOR,
      comment:"د زراعت پوهنځي د غوښتنې جدي اړتیا روښانه شوه.",
      changedAt:ts(9,8), changedAtHijriShamsi:"۱۴۰۴/۱۲/۱۳", changedAtHijriQamari:"۱۴۴۷/۰۹/۱۸",
    },
    {
      id:"level_y1_05", requestId:"req_y1_20",
      oldLevel:"متوسط", newLevel:"ډېر مهم",
      changedBy:"seed_confirmer", changedByName:"Doostyar Sahib",
      changedByRole:ROLES.REQUEST_CONFIRMER,
      comment:"د سیمسټر پیل کیدو له امله د انجینري پوهنځي اړتیا مهمه ده.",
      changedAt:ts(11,6), changedAtHijriShamsi:"۱۴۰۵/۰۲/۱۱", changedAtHijriQamari:"۱۴۴۷/۱۱/۱۶",
    },
  ];

  setLocalItem("request_level_history", history);
  return history;
}

// ════════════════════════════════════════════════════════════════
// EMAIL LOGS
// ════════════════════════════════════════════════════════════════
export function getDemoEmailLogs(): DemoEmailLog[] {
  ensureSeedVersion();
  return getLocalItem<DemoEmailLog[]>("email_logs", []);
  // ── seed data removed ──
  const logs: DemoEmailLog[] = [
    { id:"email_y1_01", to:"enayatzoon@gmail.com",           subject:"ستاسې د غوښتنې اجناس رسېدلي دي",               body:"د کمپیوټر ساینس پوهنځي غوښتنه (req_y1_01) بشپړه شوه. مهرباني وکړئ د تسلیمۍ لپاره مراجعه وکړئ.",              relatedRequestId:"req_y1_01", requestLevel:"ډېر مهم",  status:"Sent",   createdAt:ts(0,12)+1000,  createdAtHijriShamsi:"۱۴۰۴/۰۳/۲۲", createdAtHijriQamari:"۱۴۴۷/۰۱/۰۴" },
    { id:"email_y1_02", to:"engineering@ku.edu.af",          subject:"د شبکې کیبل تدارک بشپړ شو",                   body:"د انجینري پوهنځي (req_y1_02) شبکې کیبل تسلیم شو. ف س ۵ لاسلیک وکړئ.",                                   relatedRequestId:"req_y1_02", requestLevel:"ډېر عاجل", status:"Sent",   createdAt:ts(1,8)+2000,   createdAtHijriShamsi:"۱۴۰۴/۰۴/۱۸", createdAtHijriQamari:"۱۴۴۷/۰۱/۲۸" },
    { id:"email_y1_03", to:"procurement@ku.edu.af",          subject:"د پروجیکتور تدارک ته اجازه ورکړل شوه",         body:"د کمپیوټر ساینس پوهنځي پروجیکتور غوښتنه (req_y1_08) تاییده شوه. درجه: ډېر عاجل.",                         relatedRequestId:"req_y1_08", requestLevel:"ډېر عاجل", status:"Sent",   createdAt:ts(3,12)+2000,  createdAtHijriShamsi:"۱۴۰۴/۰۶/۲۲", createdAtHijriQamari:"۱۴۴۷/۰۳/۲۶" },
    { id:"email_y1_04", to:"warehouse@ku.edu.af",            subject:"د چوکیو رسید ثبت شو",                         body:"د اقتصاد پوهنځي ۱۴ چوکۍ (req_y1_12) ګدام ته رسېدلي دي. موجودي تازه کړئ.",                                 relatedRequestId:"req_y1_12", requestLevel:"ډېر مهم",  status:"Sent",   createdAt:ts(6,22)+2000,  createdAtHijriShamsi:"۱۴۰۴/۰۹/۳۲", createdAtHijriQamari:"۱۴۴۷/۰۷/۰۲" },
    { id:"email_y1_05", to:"requester@ku.edu.af",            subject:"ستاسې غوښتنه ګدام ته رسېدلې ده",              body:"د کمپیوټر ساینس پوهنځي غوښتنه (req_y1_16) ګدام کې موجوده ده. د تسلیمۍ لپاره مراجعه وکړئ.",                 relatedRequestId:"req_y1_16", requestLevel:"ډېر مهم",  status:"Sent",   createdAt:ts(8,10)+2000,  createdAtHijriShamsi:"۱۴۰۴/۱۱/۱۵", createdAtHijriQamari:"۱۴۴۷/۰۸/۲۰" },
    { id:"email_y1_06", to:"procurement@ku.edu.af",          subject:"د صفایۍ موادو لپاره آفر غوښتنه",               body:"د اداري چارو غوښتنه (req_y1_17) تدارکاتو ته استول شوه. درجه: عادي. درې آفر جمع کړئ.",                     relatedRequestId:"req_y1_17", requestLevel:"عادي",     status:"Sent",   createdAt:ts(8,22)+2000,  createdAtHijriShamsi:"۱۴۰۴/۱۱/۲۷", createdAtHijriQamari:"۱۴۴۷/۰۹/۰۲" },
    { id:"email_y1_07", to:"procurement@ku.edu.af",          subject:"د وایټ بورډ مارکر برنده انتخاب شو",            body:"د زراعت پوهنځي (req_y1_18) لپاره ټیټه بیه انتخاب شوه. آمر خریداري جوړ کړئ.",                                relatedRequestId:"req_y1_18", requestLevel:"متوسط",    status:"Sent",   createdAt:ts(9,18)+2000,  createdAtHijriShamsi:"۱۴۰۴/۱۲/۲۳", createdAtHijriQamari:"۱۴۴۷/۰۹/۲۸" },
    { id:"email_y1_08", to:"superadmin@ku.edu.af",           subject:"د پرنټر غوښتنه تاییدولو ته چمتو ده",           body:"د طب پوهنځي پرنټر غوښتنه (req_y1_19) ستاسې تاییدولو انتظار کوي.",                                         relatedRequestId:"req_y1_19", requestLevel:"ډېر مهم",  status:"Queued", createdAt:ts(10,6)+2000,  createdAtHijriShamsi:"۱۴۰۵/۰۱/۱۱", createdAtHijriQamari:"۱۴۴۷/۱۰/۱۷" },
    { id:"email_y1_09", to:"confirmer@ku.edu.af",            subject:"نوې غوښتنه ثبت شوه — انجینري چوکۍ",           body:"د انجینري پوهنځي نوې غوښتنه (req_y1_20) ستاسې تاییدولو ته چمتو ده. درجه: ډېر مهم.",                        relatedRequestId:"req_y1_20", requestLevel:"ډېر مهم",  status:"Queued", createdAt:ts(11,5)+3000,  createdAtHijriShamsi:"۱۴۰۵/۰۲/۱۰", createdAtHijriQamari:"۱۴۴۷/۱۱/۱۵" },
    { id:"email_y1_10", to:"warehouse@ku.edu.af",            subject:"د فلش ډرایو موجودي د لږ تر لږه کچې لاندې ده", body:"د فلش ډرایو 32GB موجودي (۶ دانه) د لږ تر لږه کچې (۸ دانه) لاندې راغلې ده. د تدارک غوښتنه وکړئ.",            status:"Sent",                                          createdAt:BASE_TS - D*5,  createdAtHijriShamsi:"۱۴۰۵/۰۲/۱۹", createdAtHijriQamari:"۱۴۴۷/۱۱/۲۴" },
  ];

  setLocalItem("email_logs", logs);
  return logs;
}

export function saveDemoEmailLogs(logs: DemoEmailLog[]): void { setLocalItem("email_logs", logs); }

export function makeLocalId(prefix: string): string { return uid(prefix); }
