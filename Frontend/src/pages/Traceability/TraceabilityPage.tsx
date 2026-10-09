import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";
import { traceabilityService } from "../../services/traceability";
import { managementService } from "../../services/management";
import PageMeta from "../../components/common/PageMeta";
import ManagementPanel from "./ManagementPanel";
import { subscribeDataChanges } from "../../utils/dataSync";

// ─── Types ───────────────────────────────────────────────────────────────────
type ViewLevel = "main" | "admin-depts" | "faculty-levels" | "faculty-depts" | "persons" | "ledger-modal";

interface Summary { admin: any; faculty: any; }
interface Dept { id: number; name_ps: string; name_fa: string; person_count: number; item_count: number; total_quantity: number; last_assignment_date?: string; }
interface LevelInfo { level: string; faculty_count: number; department_count: number; person_count: number; item_count: number; total_quantity: number; }
interface FacultyDept { faculty_id: number; faculty_name_ps: string; faculty_name_fa: string; level?: string; department_id: number; dept_name_ps: string; dept_name_fa: string; person_count: number; item_count: number; total_quantity: number; faculty_total_persons?: number; }
interface Person { id: number; full_name: string; position: string; email?: string; phone?: string; photo?: string; dept_name_ps: string; dept_name_fa: string; faculty_name_ps?: string; faculty_name_fa?: string; item_count: number; total_quantity: number; latest_assignment_date?: string; }
interface LedgerEntry { id: number; item_name_ps: string; item_name_fa: string; item_code: string; quantity: number; unit_name_ps: string; unit_name_fa: string; assigned_at: string; source_type: string; tracking_id?: string; request_tracking_id?: string; delivery_id?: number; delivery_fs5?: string; status: string; notes?: string; assigned_by_name?: string; }
interface SearchResult extends LedgerEntry { person_id: number; person_name: string; position?: string; dept_name_ps?: string; dept_name_fa?: string; faculty_name_ps?: string; faculty_name_fa?: string; request_id?: number; }

const LEVEL_LABELS: Record<string, { ps: string; dr: string; color: string; gradient: string }> = {
  Bachelor: { ps: "لېسانس", dr: "لیسانس", color: "from-sky-500 to-blue-600", gradient: "bg-gradient-to-br from-sky-50 to-blue-100 dark:from-sky-900/30 dark:to-blue-900/20" },
  Master:   { ps: "ماسټري", dr: "ماسترگیری", color: "from-violet-500 to-purple-600", gradient: "bg-gradient-to-br from-violet-50 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/20" },
  PhD:      { ps: "دوکتورا", dr: "دکترا", color: "from-rose-500 to-pink-600", gradient: "bg-gradient-to-br from-rose-50 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/20" },
};

const STATUS_LABELS: Record<string, { ps: string; dr: string; cls: string }> = {
  ASSIGNED:                      { ps: "ټاکل شوی",          dr: "تخصیص داده‌شده",     cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  RETURNED:                      { ps: "بیرته راستون",        dr: "برگشت‌داده‌شده",     cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  DAMAGED:                       { ps: "خراب شوی",            dr: "آسیب‌دیده",          cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  TRANSFERRED:                   { ps: "لیږدول شوی",          dr: "منتقل‌شده",          cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  PendingReview:                 { ps: "د بیاکتنې انتظار",    dr: "منتظر بررسی",        cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  ReviewReturned:                { ps: "بیرته راستانه",        dr: "برگشت‌داده شده",     cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  Submitted:                     { ps: "واستول شوی",          dr: "ارسال شده",          cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  ConfirmedByRequestConfirmer:   { ps: "تایید شوی",           dr: "تأیید شده",          cls: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" },
  RejectedByRequestConfirmer:    { ps: "رد شوی",              dr: "رد شده",             cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  ApprovedBySuperAdmin:          { ps: "منظور شوی",           dr: "تصویب شده",          cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  RejectedBySuperAdmin:          { ps: "رد شوی",              dr: "رد شده",             cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  StockAvailable:                { ps: "جنس شتون لري",        dr: "موجود است",          cls: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300" },
  StockNotAvailable:             { ps: "جنس نشته",            dr: "موجود نیست",         cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  ProcurementPending:            { ps: "تدارکاتو ته لیږل شو", dr: "به تدارکات ارسال",   cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  FS5Created:                    { ps: "ف.س.۵ جوړه شوه",      dr: "ف.س.۵ ایجاد شد",    cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
  Delivered:                     { ps: "تسلیم شو",            dr: "تحویل داده شد",      cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  Completed:                     { ps: "بشپړه شوه",           dr: "تکمیل شد",           cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
};

const SOURCE_LABELS: Record<string, { ps: string; dr: string; icon: string }> = {
  manual:   { ps: "لاسي ټاکنه",   dr: "تخصیص دستی",    icon: "✋" },
  delivery: { ps: "سپارنه",        dr: "تحویل",          icon: "📦" },
  request:  { ps: "غوښتنه",        dr: "درخواست",        icon: "📋" },
  stock_out:{ ps: "د ګدام وتل",    dr: "خروج انبار",     icon: "📤" },
};

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const start = useRef<number | null>(null);
  const frame = useRef<number>(0);
  useEffect(() => {
    start.current = null;
    const animate = (ts: number) => {
      if (!start.current) start.current = ts;
      const progress = Math.min((ts - start.current) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(ease * value));
      if (progress < 1) frame.current = requestAnimationFrame(animate);
    };
    frame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);
  return <>{display.toLocaleString()}</>;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 animate-pulse">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />)}
      </div>
      <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
}

// ─── Stat Badge ───────────────────────────────────────────────────────────────
function StatBadge({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="flex flex-col items-center p-3 bg-white/10 rounded-xl backdrop-blur-sm">
      <span className="text-xl mb-1">{icon}</span>
      <span className="text-xl font-bold text-white"><AnimatedNumber value={Number(value) || 0} /></span>
      <span className="text-xs text-white/70 text-center mt-1">{label}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TraceabilityPage() {
  const { pick, splitPick } = useLanguage();
  const { profile } = useAuth();
  const role = profile?.role || "";

  const canAssign = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR, ROLES.WAREHOUSE_ENTRY_PERSON].includes(role as any);
  const canManage = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(role as any);

  // Management panel
  const [showManagement, setShowManagement] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mgmtDefaultTab, setMgmtDefaultTab] = useState<"faculties" | "departments" | "people" | "assignments">("faculties");
  const [mgmtFacultyId, setMgmtFacultyId] = useState<number | undefined>(undefined);

  // Email modal
  const [emailPerson, setEmailPerson] = useState<Person | null>(null);
  const [emailForm, setEmailForm] = useState({ subject: "", body: "" });
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState("");

  // Navigation state
  const [view, setView] = useState<ViewLevel>("main");
  const [breadcrumb, setBreadcrumb] = useState<{ label: string; onClick: () => void }[]>([]);
  const [animKey, setAnimKey] = useState(0);

  // Data state
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [levels, setLevels] = useState<LevelInfo[]>([]);
  const [facultyDepts, setFacultyDepts] = useState<FacultyDept[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedDept, setSelectedDept] = useState<Dept | FacultyDept | null>(null);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [showLedger, setShowLedger] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  // Assignment form
  const [assignForm, setAssignForm] = useState<any>({ item_id: "", quantity: "", unit_id: "", person_id: "", department_id: "", source_type: "manual", notes: "" });
  const [items, setItems] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [allPersons, setAllPersons] = useState<any[]>([]);
  const [assignError, setAssignError] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState("");

  const navigate = (newView: ViewLevel, newCrumbs: { label: string; onClick: () => void }[]) => {
    setAnimKey(k => k + 1);
    setView(newView);
    setBreadcrumb(newCrumbs);
    setError("");
    setSearch("");
  };

  // Load summary on mount and whenever data is refreshed (e.g. after management panel closes)
  useEffect(() => {
    setLoading(true);
    traceabilityService.getSummary()
      .then(d => setSummary(d))
      .catch(() => setError(pick("د معلوماتو پورته کول ونه شو. سرور بند وي.", "بارگذاری اطلاعات ناموفق بود.")))
      .finally(() => setLoading(false));
    // If not on main view, also reload current view
    if (view === "admin-depts") loadAdminDepts();
    else if (view === "faculty-levels") loadFacultyLevels();
    else if (view === "faculty-depts" && selectedLevel) loadFacultyDepts(selectedLevel);
    else if (view === "persons" && selectedDept) {
      const departmentId = (selectedDept as FacultyDept).department_id ||
        (!(selectedDept as FacultyDept).faculty_id ? (selectedDept as Dept).id : 0);
      const facultyId = (selectedDept as FacultyDept).faculty_id;
      if (departmentId) loadPersons(departmentId);
      else if (facultyId) {
        setLoading(true);
        traceabilityService.getPersonsByFaculty(facultyId)
          .then(data => setPersons(data))
          .catch(() => setError(pick("د پوهنځي کسان پورته نشول.", "بارگذاری افراد دانشکده ناموفق بود.")))
          .finally(() => setLoading(false));
      }
    }
    if (showLedger && selectedPerson) loadLedger(selectedPerson.id);
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAdminDepts = useCallback(() => {
    setLoading(true);
    traceabilityService.getAdminDepartments()
      .then(d => setDepts(d))
      .catch(() => setError(pick("د اداري ادارو معلومات پورته نشول.", "اطلاعات دپارتمان‌های اداری بارگذاری نشد.")))
      .finally(() => setLoading(false));
  }, []);

  const loadFacultyLevels = useCallback(() => {
    setLoading(true);
    traceabilityService.getFacultyLevels()
      .then(d => setLevels(d))
      .catch(() => setError(pick("د پوهنځیو کچې پورته نشوې.", "سطح‌های دانشکده‌ها بارگذاری نشد.")))
      .finally(() => setLoading(false));
  }, []);

  const loadFacultyDepts = useCallback((level: string) => {
    setLoading(true);
    traceabilityService.getDepartmentsByLevel(level)
      .then(d => setFacultyDepts(d))
      .catch(() => setError(pick("د پوهنځیو معلومات پورته نشول.", "")))
      .finally(() => setLoading(false));
  }, []);

  const loadPersons = useCallback((deptId: number) => {
    setLoading(true);
    traceabilityService.getPersonsByDepartment(deptId)
      .then(d => setPersons(d))
      .catch(() => setError(pick("د کسانو معلومات پورته نشول.", "")))
      .finally(() => setLoading(false));
  }, []);

  const loadLedger = useCallback((personId: number) => {
    setLoading(true);
    traceabilityService.getPersonLedger(personId)
      .then(d => setLedger(d))
      .catch(() => setError(pick("د کهاتې معلومات پورته نشول.", "")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => subscribeDataChanges(change => {
    const relevant =
      change.path.startsWith("/management/") ||
      change.path.startsWith("/traceability/") ||
      change.path.startsWith("/delivery/") ||
      change.path.startsWith("/inventory/");
    if (relevant) setRefreshKey(key => key + 1);
  }), []);

  useEffect(() => {
    if (view !== "main" || !search.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      traceabilityService.searchAssignments(search.trim())
        .then(data => setSearchResults(data || []))
        .catch(() => setError(pick("لټون ترسره نه شو.", "جستجو انجام نشد.")))
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, view, pick, refreshKey]);

  // Load lookup data for assignment form
  const loadAssignLookups = useCallback(async () => {
    try {
      const [itemsData, unitsData] = await Promise.all([
        fetch('/api/inventory/items').then(r => r.json()),
        fetch('/api/inventory/units').then(r => r.json()),
      ]);
      setItems(itemsData.data || []);
      setUnits(unitsData.data || []);
    } catch {}
  }, []);

  const buildCSV = (rows: Record<string, any>[]) => {
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(","),
      ...rows.map(obj => headers.map(h => `"${String(obj[h] ?? '').replace(/"/g, '""')}"`).join(","))
    ];
    return "\uFEFF" + lines.join("\n");
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    let csvRows: Record<string, any>[] = [];
    let filename = "traceability";

    if (view === "admin-depts") {
      const src = search ? filteredDepts : depts;
      csvRows = src.map(d => ({
        'اداره': d.name_ps,
        'کسان': d.person_count,
        'اجناس ډولونه': d.item_count,
        'ټوله مقدار': Number(d.total_quantity) || 0,
      }));
      filename = "admin_departments";
    } else if (view === "faculty-levels") {
      const src = search ? filteredLevels : levels;
      csvRows = src.map(l => ({
        'سطح': LEVEL_LABELS[l.level]?.ps || l.level,
        'پوهنځیانه': l.faculty_count,
        'ادارې': l.department_count,
        'کسان': l.person_count,
        'اجناس ډولونه': l.item_count,
        'ټوله مقدار': Number(l.total_quantity) || 0,
      }));
      filename = "faculty_levels";
    } else if (view === "faculty-depts") {
      const src = search ? filteredFacultyDepts : facultyDepts;
      csvRows = src.map(d => ({
        'پوهنځی': d.faculty_name_ps,
        'اداره': d.dept_name_ps,
        'سطح': LEVEL_LABELS[d.level || '']?.ps || d.level || "",
        'کسان': d.person_count,
        'اجناس ډولونه': d.item_count,
        'ټوله مقدار': Number(d.total_quantity) || 0,
      }));
      filename = "faculty_departments";
    } else if (view === "persons") {
      const src = search ? filteredPersons : persons;
      csvRows = src.map(p => ({
        'نوم': p.full_name,
        'موقف': p.position || "",
        'اداره': p.dept_name_ps || "",
        'پوهنځی': p.faculty_name_ps || "",
        'اجناس ډولونه': p.item_count,
        'ټوله مقدار': p.total_quantity,
      }));
      filename = "persons_traceability";
    } else if (summary) {
      csvRows = [
        {
          'برخه': pick("اداري برخه", "بخش اداری"),
          'کسان': summary.admin?.total_persons || 0,
          'ادارې': summary.admin?.total_departments || 0,
          'اجناس ډولونه': summary.admin?.item_count || 0,
          'ټوله مقدار': Number(summary.admin?.total_quantity) || 0,
        },
        {
          'برخه': pick("د پوهنځیو برخه", "بخش دانشکده‌ها"),
          'کسان': summary.faculty?.total_persons || 0,
          'ادارې': summary.faculty?.total_faculties || 0,
          'اجناس ډولونه': summary.faculty?.item_count || 0,
          'ټوله مقدار': Number(summary.faculty?.total_quantity) || 0,
        },
      ];
      filename = "traceability_summary";
    }

    if (!csvRows.length) {
      setError(pick("صادر کولو لپاره ډيټا نشته.", "داده‌ای برای صدور وجود ندارد."));
      return;
    }
    downloadCSV(buildCSV(csvRows), filename);
  };

  const handleExportLedger = () => {
    if (!ledger.length) {
      setError(pick("د دې شخص لپاره ثبت شوي اجناس نشته.", "جنسی ثبت‌شده برای این شخص وجود ندارد."));
      return;
    }
    const csvRows = ledger.map(e => ({
      'جنس کود': e.item_code || "",
      'جنس نوم': e.item_name_ps || "",
      'مقدار': e.quantity,
      'واحد': e.unit_name_ps || "",
      'سرچینه': SOURCE_LABELS[e.source_type]?.ps || e.source_type || "",
      'نیټه': e.assigned_at ? new Date(e.assigned_at).toLocaleDateString() : "",
      'وضعیت': e.status || "",
      'یادداشت': e.notes || "",
    }));
    downloadCSV(buildCSV(csvRows), `ledger_${selectedPerson?.full_name?.replace(/\s+/g, '_') || 'export'}`);
  };

  const handlePrint = () => {
    const printArea = document.getElementById('ledger-print-area');
    if (!printArea) return;
    const clone = printArea.cloneNode(true) as HTMLElement;
    const styles = Array.from(document.styleSheets)
      .map(s => { try { return Array.from(s.cssRules || []).map(r => r.cssText).join(''); } catch { return ''; } })
      .join('');
    const win = window.open('', '_blank');
    if (!win) { window.print(); return; }
    win.document.write(`
      <!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>چاپ</title>
      <style>body { font-family: 'Bahij Zar', Tahoma, Arial, sans-serif; padding: 20px; }${styles}</style>
      </head><body>${clone.outerHTML}</body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleManualAssign = async () => {
    setAssignError(""); setAssignSuccess("");
    if (!assignForm.item_id || !assignForm.quantity || Number(assignForm.quantity) <= 0) {
      setAssignError(pick("جنس او مقدار اړین دي.", "جنس و مقدار الزامی است.")); return;
    }
    setAssignLoading(true);
    try {
      await traceabilityService.manualAssignment({ ...assignForm });
      setAssignSuccess(pick("جنس بریالیتوب سره ټاکل شو.", "تخصیص با موفقیت انجام شد."));
      setAssignForm({ item_id: "", quantity: "", unit_id: "", person_id: "", department_id: "", source_type: "manual", notes: "" });
      // Refresh summary
      traceabilityService.getSummary().then(d => setSummary(d)).catch(() => {});
    } catch (e: any) {
      setAssignError(e.message || pick("ستونزه رامنځته شوه.", "خطایی رخ داد."));
    } finally { setAssignLoading(false); }
  };

  // Filtered helpers
  const filterSearch = (name_ps: string, name_fa?: string) =>
    !search || name_ps.toLowerCase().includes(search.toLowerCase()) || (name_fa || "").toLowerCase().includes(search.toLowerCase());

  const filteredDepts = depts.filter(d => filterSearch(d.name_ps, d.name_fa));
  const filteredLevels = levels.filter(l => filterSearch(LEVEL_LABELS[l.level]?.ps || l.level));
  const filteredFacultyDepts = facultyDepts.filter(d => filterSearch(d.dept_name_ps, d.dept_name_fa) || filterSearch(d.faculty_name_ps, d.faculty_name_fa));
  const filteredPersons = persons.filter(p => filterSearch(p.full_name) || filterSearch(p.position || ""));
  const filteredLedger = ledger.filter(e => filterSearch(e.item_name_ps, e.item_name_fa) || filterSearch(e.item_code || "") || filterSearch(e.tracking_id || ""));

  const goHome = () => navigate("main", []);

  // ─── Render helpers ───────────────────────────────────────────────────────────

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="text-5xl mb-4 animate-bounce-gentle">📭</div>
      <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
        {pick("هیڅ معلومات ونه موندل شول", "هیچ معلوماتی یافت نشد")}
      </p>
    </div>
  );

  const renderError = (msg: string) => (
    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 animate-shake mb-4">
      <p className="text-red-700 dark:text-red-400 text-sm font-medium text-center">{msg}</p>
    </div>
  );

  // ─── Main Summary Cards ───────────────────────────────────────────────────────
  const renderMain = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
      {/* Admin Card */}
      <button
        onClick={() => { navigate("admin-depts", [{ label: pick("اداري برخه","بخش اداری"), onClick: () => navigate("admin-depts", [{ label: pick("اداري برخه","بخش اداری"), onClick: () => {} }]) }]); loadAdminDepts(); }}
        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 dark:from-brand-700 dark:to-brand-950 p-6 text-right shadow-xl shadow-brand-900/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-brand-900/30 active:scale-[0.98] focus:outline-none border border-brand-500/20"
        style={{ animationDelay: "0ms" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        <div className="absolute -top-8 -left-8 w-32 h-32 bg-white/5 rounded-full pointer-events-none group-hover:scale-150 transition-transform duration-500" />
        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/5 rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="text-4xl group-hover:scale-110 transition-transform duration-300">🏛️</div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-white">{pick("اداري برخه", "بخش اداری")}</h2>
              <p className="text-white/60 text-sm mt-0.5">{pick("ادارې او کارمندان", "ادارات و کارمندان")}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatBadge label={pick("ادارې","ادارات")} value={summary?.admin?.total_departments || 0} icon="🏢" />
            <StatBadge label={pick("کسان","افراد")} value={summary?.admin?.total_persons || 0} icon="👤" />
            <StatBadge label={pick("اجناس","اجناس")} value={summary?.admin?.total_items || 0} icon="📦" />
            <StatBadge label={pick("مجموع مقدار","مجموع مقدار")} value={summary?.admin?.total_quantity || 0} icon="🔢" />
          </div>
          <div className="mt-4 flex items-center justify-end gap-2 text-white/80 text-sm font-medium group-hover:gap-4 transition-all duration-300">
            <span>{pick("مشاهده","مشاهده")}</span>
            <span className="text-lg">←</span>
          </div>
        </div>
      </button>

      {/* Faculty Card */}
      <button
        onClick={() => { navigate("faculty-levels", [{ label: pick("د پوهنځیو برخه","بخش دانشکده‌ها"), onClick: () => navigate("faculty-levels", []) }]); loadFacultyLevels(); }}
        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 dark:from-emerald-700 dark:to-teal-900 p-6 text-right shadow-xl shadow-emerald-900/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-emerald-900/30 active:scale-[0.98] focus:outline-none border border-emerald-500/20"
        style={{ animationDelay: "100ms" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        <div className="absolute -top-8 -left-8 w-32 h-32 bg-white/5 rounded-full pointer-events-none group-hover:scale-150 transition-transform duration-500" />
        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/5 rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="text-4xl group-hover:scale-110 transition-transform duration-300">🎓</div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-white">{pick("د پوهنځیو برخه", "بخش دانشکده‌ها")}</h2>
              <p className="text-white/60 text-sm mt-0.5">{pick("پوهنځیانه او محصلین", "دانشکده‌ها و دانشجویان")}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatBadge label={pick("پوهنځیانه","دانشکده‌ها")} value={summary?.faculty?.total_faculties || 0} icon="🏫" />
            <StatBadge label={pick("کسان","افراد")} value={summary?.faculty?.total_persons || 0} icon="👤" />
            <StatBadge label={pick("اجناس","اجناس")} value={summary?.faculty?.total_items || 0} icon="📦" />
            <StatBadge label={pick("مجموع مقدار","مجموع مقدار")} value={summary?.faculty?.total_quantity || 0} icon="🔢" />
          </div>
          <div className="mt-4 flex items-center justify-end gap-2 text-white/80 text-sm font-medium group-hover:gap-4 transition-all duration-300">
            <span>{pick("مشاهده","مشاهده")}</span>
            <span className="text-lg">←</span>
          </div>
        </div>
      </button>
    </div>
  );

  // ─── Admin Departments ────────────────────────────────────────────────────────
  const renderAdminDepts = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
      {filteredDepts.length === 0 ? renderEmpty() : filteredDepts.map((d, i) => (
        <button key={d.id}
          onClick={() => {
            setSelectedDept(d);
            navigate("persons", [
              { label: pick("اداري برخه","بخش اداری"), onClick: () => { navigate("admin-depts", [{ label: pick("اداري برخه","بخش اداری"), onClick: ()=>{} }]); loadAdminDepts(); } },
              { label: splitPick(`${d.name_ps} / ${d.name_fa}`), onClick: () => {} },
            ]);
            loadPersons(d.id);
          }}
          className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 text-right shadow-sm hover:shadow-xl hover:border-brand-300 dark:hover:border-brand-600 transition-all duration-300 hover:-translate-y-1 active:translate-y-0 focus:outline-none animate-slide-up"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-brand-50 dark:bg-brand-900/20 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-3">
              <div className="text-3xl group-hover:scale-110 transition-transform duration-300">🏢</div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white text-base leading-snug">{splitPick(`${d.name_ps} / ${d.name_fa}`)}</h3>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { icon: "👤", val: d.person_count, label: pick("کسان","افراد") },
                { icon: "📦", val: d.item_count, label: pick("اجناس","اجناس") },
                { icon: "🔢", val: d.total_quantity, label: pick("مقدار","مقدار") },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                  <span className="text-sm">{s.icon}</span>
                  <span className="font-bold text-gray-800 dark:text-white text-sm"><AnimatedNumber value={s.val || 0} /></span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-1 text-brand-600 dark:text-brand-400 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span>{pick("لیدل","مشاهده")}</span>
              <span>←</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  // ─── Faculty Levels ───────────────────────────────────────────────────────────
  const renderFacultyLevels = () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 animate-fade-in">
      {filteredLevels.length === 0 ? renderEmpty() : filteredLevels.map((lv, i) => {
        const meta = LEVEL_LABELS[lv.level] || LEVEL_LABELS.Bachelor;
        return (
          <button key={lv.level}
            onClick={() => {
              setSelectedLevel(lv.level);
              navigate("faculty-depts", [
                { label: pick("د پوهنځیو برخه","بخش دانشکده‌ها"), onClick: () => { navigate("faculty-levels", []); loadFacultyLevels(); } },
                { label: meta.ps, onClick: () => {} },
              ]);
              loadFacultyDepts(lv.level);
            }}
            className={`group relative overflow-hidden rounded-2xl ${meta.gradient} border border-gray-200 dark:border-gray-700 p-6 text-right shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 active:translate-y-0 focus:outline-none animate-scale-in`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${meta.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none`} />
            <div className="relative z-10 flex flex-col items-end gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${meta.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <span className="text-white text-2xl font-bold">{meta.ps[0]}</span>
              </div>
              <div className="text-right">
                <h3 className="text-xl font-extrabold text-gray-800 dark:text-white">{meta.ps}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{meta.dr}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full">
                {[
                  { val: lv.department_count, label: pick("ادارې","بخش‌ها") },
                  { val: lv.person_count, label: pick("کسان","افراد") },
                  { val: lv.item_count, label: pick("اجناس","اجناس") },
                  { val: lv.total_quantity, label: pick("مقدار","مقدار") },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center bg-white/50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className="font-bold text-gray-800 dark:text-white text-sm"><AnimatedNumber value={s.val || 0} /></span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  // ─── Faculty Departments ──────────────────────────────────────────────────────
  const renderFacultyDepts = () => {
    const grouped: Record<string, { facultyRow: FacultyDept; departments: FacultyDept[] }> = {};
    filteredFacultyDepts.forEach(d => {
      const key = `${d.faculty_id}-${d.faculty_name_ps}`;
      if (!grouped[key]) grouped[key] = { facultyRow: d, departments: [] };
      if (d.department_id) grouped[key].departments.push(d);
    });
    const entries = Object.entries(grouped);
    const levelMeta = LEVEL_LABELS[selectedLevel] || LEVEL_LABELS.Bachelor;
    return (
      <div className="space-y-8 animate-fade-in">
        {entries.length === 0 ? renderEmpty() :
          entries.map(([key, { facultyRow, departments }], gi) => (
            <div key={key} className="animate-slide-up" style={{ animationDelay: `${gi * 80}ms` }}>
              {/* Faculty header — clickable to show all persons in this faculty */}
              <button
                onClick={() => {
                  setSelectedDept({ ...facultyRow, id: facultyRow.faculty_id, name_ps: facultyRow.faculty_name_ps, name_fa: facultyRow.faculty_name_fa } as any);
                  navigate("persons", [
                    { label: pick("د پوهنځیو برخه","بخش دانشکده‌ها"), onClick: () => { navigate("faculty-levels", []); loadFacultyLevels(); } },
                    { label: levelMeta.ps, onClick: () => { navigate("faculty-depts", []); loadFacultyDepts(selectedLevel); } },
                    { label: splitPick(`${facultyRow.faculty_name_ps} / ${facultyRow.faculty_name_fa}`), onClick: () => {} },
                  ]);
                  setLoading(true);
                  setPersons([]);
                  traceabilityService.getPersonsByFaculty(facultyRow.faculty_id)
                    .then(d => setPersons(d))
                    .catch(() => setError(pick("د پوهنځي کسان پورته نشول.", "بارگذاری افراد دانشکده ناموفق بود.")))
                    .finally(() => setLoading(false));
                }}
                className={`group w-full flex items-center gap-3 mb-4 p-3 rounded-xl ${levelMeta.gradient} border border-gray-200/50 dark:border-gray-700/50 text-right hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 focus:outline-none`}
              >
                <div className="flex items-center justify-end gap-1 text-xs font-medium opacity-0 group-hover:opacity-70 transition-opacity text-gray-600 dark:text-gray-400 ml-auto order-first">
                  <span>{pick("ټول کسان","همه افراد")}</span>
                  <span>←</span>
                </div>
                <div className="text-right flex-1">
                  <h3 className="font-bold text-gray-800 dark:text-white text-sm leading-snug">{splitPick(`${facultyRow.faculty_name_ps} / ${facultyRow.faculty_name_fa}`)}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {departments.length} {pick("اداره","دپارتمان")}
                    {facultyRow.faculty_total_persons != null && (
                      <span className="mx-1">·</span>
                    )}
                    {facultyRow.faculty_total_persons != null && (
                      <span className="font-semibold text-brand-600 dark:text-brand-400">{facultyRow.faculty_total_persons} {pick("کسان","نفر")}</span>
                    )}
                    <span className="mx-1">—</span>
                    {pick("کلیک وکړئ د ټولو کسانو لیدو لپاره","کلیک کنید برای مشاهده همه افراد")}
                  </p>
                </div>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${levelMeta.color} flex items-center justify-center shadow flex-shrink-0 group-hover:scale-110 transition-transform`}>
                  <span className="text-white text-sm font-bold">🎓</span>
                </div>
              </button>

              {departments.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
                    {pick("هیڅ اداره نشته — د اضافه کولو لپاره لاندې تڼۍ فشار کړئ","هیچ دپارتمانی ثبت نشده — برای افزودن دکمه زیر را بزنید")}
                  </p>
                  {canManage && (
                    <button
                      onClick={() => {
                        setMgmtDefaultTab("departments");
                        setMgmtFacultyId(facultyRow.faculty_id);
                        setShowManagement(true);
                      }}
                      className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-semibold shadow transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      🏢 {pick("اداره اضافه کول","افزودن دپارتمان")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map((d, i) => (
                    <button key={d.department_id}
                      onClick={() => {
                        setSelectedDept(d);
                        navigate("persons", [
                          { label: pick("د پوهنځیو برخه","بخش دانشکده‌ها"), onClick: () => { navigate("faculty-levels", []); loadFacultyLevels(); } },
                          { label: levelMeta.ps, onClick: () => { navigate("faculty-depts", []); loadFacultyDepts(selectedLevel); } },
                          { label: splitPick(`${d.dept_name_ps} / ${d.dept_name_fa}`), onClick: () => {} },
                        ]);
                        loadPersons(d.department_id);
                      }}
                      className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 text-right shadow-sm hover:shadow-xl hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-300 hover:-translate-y-1 active:translate-y-0 focus:outline-none animate-scale-in"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-3">
                          <div className="text-2xl group-hover:scale-110 transition-transform duration-300">🏛️</div>
                          <div className="text-right">
                            <h4 className="font-bold text-gray-800 dark:text-white text-sm leading-snug">{splitPick(`${d.dept_name_ps} / ${d.dept_name_fa}`)}</h4>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { icon: "👤", val: d.person_count, label: pick("کسان","افراد") },
                            { icon: "📦", val: d.item_count, label: pick("اجناس","اجناس") },
                            { icon: "🔢", val: d.total_quantity, label: pick("مقدار","مقدار") },
                          ].map(s => (
                            <div key={s.label} className="flex flex-col items-center bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                              <span className="text-xs">{s.icon}</span>
                              <span className="font-bold text-gray-800 dark:text-white text-sm"><AnimatedNumber value={s.val || 0} /></span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-end gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <span>{pick("لیدل","مشاهده")}</span>
                          <span>←</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        }
      </div>
    );
  };

  // ─── Persons Grid ─────────────────────────────────────────────────────────────
  const renderPersons = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
      {filteredPersons.length === 0 ? (
        <div className="col-span-full">{renderEmpty()}</div>
      ) : filteredPersons.map((p, i) => (
        <div key={p.id}
          className="group relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-xl hover:border-brand-300 dark:hover:border-brand-600 transition-all duration-300 hover:-translate-y-1 animate-scale-in cursor-pointer flex flex-col"
          style={{ animationDelay: `${i * 40}ms` }}
          onClick={() => { setSelectedPerson(p); loadLedger(p.id); setShowLedger(true); setSearch(""); }}
        >
          {/* Decorative circle */}
          <div className="absolute -top-6 -left-6 w-20 h-20 bg-brand-50 dark:bg-brand-900/20 rounded-full group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

          <div className="relative z-10 p-5 flex flex-col flex-1">
            {/* Avatar + name */}
            <div className="flex items-center gap-3 mb-4 justify-end">
              <div className="text-right flex-1 min-w-0">
                <p className="font-bold text-gray-800 dark:text-white text-sm truncate">{p.full_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{p.position || pick("بست نه دی ثبت","موقف ثبت نشده")}</p>
                {p.email && <p className="text-xs text-sky-500 dark:text-sky-400 mt-0.5 truncate" dir="ltr">{p.email}</p>}
              </div>
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md flex-shrink-0 border-2 border-white dark:border-gray-700 group-hover:scale-105 transition-transform duration-300">
                {p.photo
                  ? <img src={p.photo} alt={p.full_name} className="w-full h-full object-cover" />
                  : <span className="text-white font-bold text-sm">{p.full_name?.[0] || "؟"}</span>
                }
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { icon: "📦", val: p.item_count, label: pick("اجناس","اجناس") },
                { icon: "🔢", val: p.total_quantity, label: pick("مقدار","مقدار") },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5">
                  <span className="text-base">{s.icon}</span>
                  <span className="font-bold text-gray-800 dark:text-white text-sm mt-0.5"><AnimatedNumber value={s.val || 0} /></span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-auto">
              {p.email && (
                <button
                  onClick={e => { e.stopPropagation(); setEmailPerson(p); setEmailForm({ subject: "", body: "" }); setEmailResult(""); }}
                  className="flex items-center justify-center gap-1 bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-600 dark:text-sky-400 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200"
                >
                  ✉️ {pick("ایمیل","ایمیل")}
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); setSelectedPerson(p); loadLedger(p.id); setShowLedger(true); setSearch(""); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-brand-50 dark:bg-brand-900/30 hover:bg-brand-100 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 rounded-xl py-2 text-xs font-semibold transition-all duration-200"
              >
                📋 {pick("کهاته","دفتر")}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderGlobalSearchResults = () => (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{searchResults.length} {pick("نتیجې", "نتیجه")}</span>
        <h2 className="font-bold text-gray-800 dark:text-white">
          {pick("د ټول سیستم د اجناسو لټون", "جستجوی اجناس در تمام سیستم")}
        </h2>
      </div>
      {searchLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : searchResults.length === 0 ? renderEmpty() : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {searchResults.map(result => (
            <button
              key={result.id}
              type="button"
              onClick={() => {
                setSelectedPerson({
                  id: result.person_id,
                  full_name: result.person_name,
                  position: result.position || "",
                  dept_name_ps: result.dept_name_ps || "",
                  dept_name_fa: result.dept_name_fa || "",
                  faculty_name_ps: result.faculty_name_ps,
                  faculty_name_fa: result.faculty_name_fa,
                  item_count: 0,
                  total_quantity: 0,
                });
                loadLedger(result.person_id);
                setShowLedger(true);
                setSearch("");
              }}
              className="text-right rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-brand-400 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-bold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1">
                  {result.quantity} {result.unit_name_ps || ""}
                </span>
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-white">{result.item_name_ps || result.item_name_fa}</h3>
                  <p className="text-xs text-gray-500 mt-1">{result.item_code || "—"}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                <p>👤 {result.person_name || "—"}</p>
                <p>🏛️ {[result.faculty_name_ps, result.dept_name_ps].filter(Boolean).join(" — ") || "—"}</p>
                <p dir="ltr" className="text-right">🔗 {result.request_tracking_id || result.tracking_id || "—"}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ─── Ledger Modal ─────────────────────────────────────────────────────────────
  const renderLedgerModal = () => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setShowLedger(false)}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-900 w-full sm:max-w-4xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-800 p-5 flex items-center justify-between flex-shrink-0">
          <button onClick={() => setShowLedger(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white text-lg">✕</button>
          <div className="text-right">
            <h2 className="text-lg font-bold text-white">📋 {pick("د شخص کهاته","دفتر شخص")}</h2>
            {selectedPerson && <p className="text-white/70 text-sm">{selectedPerson.full_name} — {splitPick(`${selectedPerson.dept_name_ps} / ${selectedPerson.dept_name_fa}`)}</p>}
          </div>
        </div>

        {/* Search in ledger */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)} dir="rtl"
              placeholder={pick("د جنس یا ID لټون...","جستجو در دفتر...")}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm text-right text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1 p-4" id="ledger-print-area">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
          ) : filteredLedger.length === 0 ? renderEmpty() : (
            <div className="space-y-2">
              {filteredLedger.map((e, i) => {
                const statusMeta = STATUS_LABELS[e.status] || { ps: e.status, dr: e.status, cls: "bg-gray-100 text-gray-600" };
                return (
                  <div key={e.id} className="flex flex-wrap items-start justify-between gap-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="flex-1 min-w-0 text-right space-y-1">
                      <div className="flex items-center gap-2 justify-end flex-wrap">
                        <h4 className="font-bold text-gray-800 dark:text-white text-sm">{splitPick(`${e.item_name_ps} / ${e.item_name_fa}`)}</h4>
                        {e.item_code && <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-mono">{e.item_code}</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 justify-end">
                        <span>🔢 {e.quantity} {splitPick(`${e.unit_name_ps || ''} / ${e.unit_name_fa || ''}`)}</span>
                        <span>📅 {e.assigned_at ? new Date(e.assigned_at).toLocaleDateString("fa-AF") : "—"}</span>
                        {e.tracking_id && <span>🔖 {e.tracking_id}</span>}
                        {e.delivery_fs5 && <span>📄 FS5: {e.delivery_fs5}</span>}
                        {e.source_type && (() => {
                          const src = SOURCE_LABELS[e.source_type];
                          return src
                            ? <span className="flex items-center gap-0.5">{src.icon} {pick(src.ps, src.dr)}</span>
                            : <span>📤 {e.source_type}</span>;
                        })()}
                      </div>
                      {e.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{e.notes}</p>}
                    </div>
                    <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold ${statusMeta.cls}`}>{pick(statusMeta.ps, statusMeta.dr)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center flex-shrink-0">
          <button onClick={() => { setShowLedger(false); setSearch(""); }} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            {pick("وتل","بستن")}
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleExportLedger}
              disabled={!filteredLedger.length}
              className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200"
            >
              📥 {pick("CSV صادرول","صادر CSV")}
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200">
              🖨️ {pick("چاپ","چاپ")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Manual Assignment Modal ──────────────────────────────────────────────────
  const renderAssignModal = () => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => { setShowAssign(false); setAssignError(""); setAssignSuccess(""); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-900 w-full sm:max-w-lg sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-5 flex items-center justify-between flex-shrink-0">
          <button onClick={() => { setShowAssign(false); setAssignError(""); setAssignSuccess(""); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white text-lg">✕</button>
          <div className="text-right">
            <h2 className="text-lg font-bold text-white">➕ {pick("جنس ټاکل","تخصیص جنس")}</h2>
            <p className="text-white/70 text-sm">{pick("لاسي ټاکنه","تخصیص دستی")}</p>
          </div>
        </div>
        <div className="overflow-auto flex-1 p-5 space-y-4" dir="rtl">
          {assignError && renderError(assignError)}
          {assignSuccess && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 p-3 rounded-xl text-sm text-center font-medium animate-fade-in">{assignSuccess}</div>}

          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{pick("جنس *","جنس *")}</label>
            <select value={assignForm.item_id} onChange={e => setAssignForm((f: any) => ({...f, item_id: e.target.value}))}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">{pick("جنس غوره کړئ","انتخاب جنس")}</option>
              {items.map((it: any) => <option key={it.id} value={it.id}>{it.name_ps} ({it.current_stock} {pick("موجود","موجود")})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{pick("مقدار *","مقدار *")}</label>
              <input type="number" min="1" value={assignForm.quantity} onChange={e => setAssignForm((f: any) => ({...f, quantity: e.target.value}))}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{pick("واحد","واحد")}</label>
              <select value={assignForm.unit_id} onChange={e => setAssignForm((f: any) => ({...f, unit_id: e.target.value}))}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="">{pick("واحد","واحد")}</option>
                {units.map((u: any) => <option key={u.id} value={u.id}>{u.name_ps}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{pick("د ترلاسه کوونکي ID","شناسه دریافت‌کننده")}</label>
            <input type="number" placeholder={pick("د شخص ID","شناسه شخص")} value={assignForm.person_id} onChange={e => setAssignForm((f: any) => ({...f, person_id: e.target.value}))}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{pick("سرچینه","منبع")}</label>
            <select value={assignForm.source_type} onChange={e => setAssignForm((f: any) => ({...f, source_type: e.target.value}))}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="manual">{pick("لاسي","دستی")}</option>
              <option value="request">{pick("د غوښتنې له لارې","از طریق درخواست")}</option>
              <option value="delivery">{pick("د تسلیمۍ له لارې","از طریق تحویل")}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{pick("یادداشت","یادداشت")}</label>
            <textarea value={assignForm.notes} onChange={e => setAssignForm((f: any) => ({...f, notes: e.target.value}))} rows={3}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          </div>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex gap-3 flex-shrink-0">
          <button onClick={() => { setShowAssign(false); setAssignError(""); setAssignSuccess(""); }}
            className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium transition-all duration-200">
            {pick("لغوه","لغو")}
          </button>
          <button onClick={handleManualAssign} disabled={assignLoading}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-bold transition-all duration-200 shadow-md hover:shadow-lg disabled:cursor-not-allowed">
            {assignLoading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{pick("کار روان دی","در حال ارسال...")}</span> : `✅ ${pick("ثبت کول","ثبت کردن")}`}
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Email handler ─────────────────────────────────────────────────────────
  const handleSendEmail = async () => {
    if (!emailPerson?.email) { setEmailResult(pick("ایمیل ادرس نشته","آدرس ایمیل موجود نیست")); return; }
    if (!emailForm.subject.trim() || !emailForm.body.trim()) { setEmailResult(pick("موضوع او متن اړین دي","موضوع و متن الزامی است")); return; }
    setEmailSending(true); setEmailResult("");
    try {
      await managementService.sendEmail({ to: emailPerson.email, subject: emailForm.subject, body: emailForm.body });
      setEmailResult(pick("✅ ایمیل بریالیتوب سره ولیږل شو!","✅ ایمیل با موفقیت ارسال شد!"));
      setEmailForm({ subject: "", body: "" });
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("SMTP_NOT_CONFIGURED"))
        setEmailResult(pick("⚠️ SMTP تنظیم نه دی. مهرباني وکړئ د تنظیماتو برخه کې د ایمیل اپ پاسورډ وتنظیم کړئ.","⚠️ SMTP پیکربندی نشده. لطفاً در بخش تنظیمات App Password ایمیل را تنظیم کنید."));
      else if (msg.includes("GMAIL_BAD_CREDENTIALS") || msg.includes("535") || msg.toLowerCase().includes("username and password not accepted"))
        setEmailResult(pick("❌ د Gmail اپ پاسورډ غلط دی — د تنظیماتو برخه ته لاړ شئ او د Gmail اپ پاسورډ سم کړئ (myaccount.google.com/apppasswords).","❌ App Password Gmail نادرست است — به تنظیمات بروید و App Password را اصلاح کنید (myaccount.google.com/apppasswords)."));
      else
        setEmailResult(pick("❌ ایمیل ونه لیږل شو: ","❌ ارسال ناموفق: ") + msg);
    }
    finally { setEmailSending(false); }
  };

  // ─── Email Modal ────────────────────────────────────────────────────────────
  const renderEmailModal = () => emailPerson && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={() => setEmailPerson(null)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-scale-in" dir="rtl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setEmailPerson(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">✕</button>
          <div className="text-right">
            <h3 className="font-bold text-gray-800 dark:text-white text-base">✉️ {pick("ایمیل لیږل","ارسال ایمیل")}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{emailPerson.full_name} — <span dir="ltr">{emailPerson.email}</span></p>
          </div>
        </div>
        {emailResult && (
          <div className={`mb-3 p-3 rounded-xl text-sm text-center font-medium ${emailResult.includes("✅") ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"}`}>{emailResult}</div>
        )}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("موضوع *","موضوع *")}</label>
            <input value={emailForm.subject} onChange={e => setEmailForm(f => ({...f, subject: e.target.value}))}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("پیغام *","متن *")}</label>
            <textarea value={emailForm.body} onChange={e => setEmailForm(f => ({...f, body: e.target.value}))} rows={5}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={() => setEmailPerson(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">{pick("لغوه","لغو")}</button>
          <button onClick={handleSendEmail} disabled={emailSending}
            className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-bold shadow transition-all">
            {emailSending ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{pick("لیږل...","ارسال...")}</span> : `✉️ ${pick("لیږل","ارسال")}`}
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Top bar with search & actions ───────────────────────────────────────────
  const renderTopBar = () => (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
      <div className="relative flex-1">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} dir="rtl"
          placeholder={pick("لټون — نوم، جنس، ID...","جستجو — نام، جنس، شناسه...")}
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 pr-10 text-sm text-right text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-400 shadow-sm transition-all"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        {search && <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg transition-colors">✕</button>}
      </div>
      <div className="flex gap-2 flex-wrap justify-end">
        {canManage && (
          <button onClick={() => setShowManagement(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0">
            ⚙️ {pick("مدیریت","مدیریت")}
          </button>
        )}
        {canAssign && (
          <button onClick={() => { setShowAssign(true); loadAssignLookups(); }}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0">
            ➕ {pick("جنس اضافه کول","اضافه کردن جنس")}
          </button>
        )}
        <button onClick={handleExportCSV} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm font-medium shadow-sm transition-all duration-200">
          📊 {pick("اکسیل","اکسل")}
        </button>
        <button onClick={handlePrint} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm font-medium shadow-sm transition-all duration-200">
          🖨️ {pick("چاپ","چاپ")}
        </button>
      </div>
    </div>
  );

  // ─── Breadcrumb ───────────────────────────────────────────────────────────────
  const renderBreadcrumb = () => (
    view !== "main" && (
      <div className="flex items-center gap-2 mb-5 flex-wrap animate-fade-in" dir="rtl">
        <button onClick={goHome} className="flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 text-sm font-medium transition-colors">
          🏠 {pick("لومړۍ","خانه")}
        </button>
        {breadcrumb.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-gray-400 dark:text-gray-600 text-sm">←</span>
            <button onClick={crumb.onClick} className={`text-sm font-medium transition-colors ${i === breadcrumb.length - 1 ? "text-gray-700 dark:text-gray-300 cursor-default" : "text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"}`}>
              {crumb.label}
            </button>
          </span>
        ))}
      </div>
    )
  );

  // ─── Main Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title={pick("تعقیب د اجناسو","ردیابی اجناس")} description={pick("د اجناسو تعقیب او کهاته","ردیابی و دفتر اجناس")} />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 transition-colors duration-300" dir="rtl">
        {/* Page Header */}
        <div className="mb-6 animate-slide-down">
          <div className="flex items-start justify-between">
            <div />
            <div className="text-right">
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-white flex items-center gap-3 justify-end">
                {pick("تعقیب د اجناسو", "ردیابی اجناس")}
                <span className="text-3xl">🔍</span>
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                {pick("د ټولو ټاکل شویو اجناسو بشپړ تعقیب","ردیابی کامل تمام اجناس تخصیص‌یافته")}
              </p>
            </div>
          </div>
        </div>

        {/* Top Bar */}
        {renderTopBar()}

        {/* Breadcrumb */}
        {renderBreadcrumb()}

        {/* Error */}
        {error && renderError(error)}

        {/* Loading Skeleton */}
        {loading && view === "main" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[1,2].map(i => <SkeletonCard key={i} />)}</div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}</div>
        ) : (
          <div key={animKey}>
            {view === "main" && (search.trim() ? renderGlobalSearchResults() : renderMain())}
            {view === "admin-depts" && renderAdminDepts()}
            {view === "faculty-levels" && renderFacultyLevels()}
            {view === "faculty-depts" && renderFacultyDepts()}
            {view === "persons" && renderPersons()}
          </div>
        )}

        {/* Modals */}
        {showLedger && renderLedgerModal()}
        {showAssign && renderAssignModal()}
      </div>

      {/* Management Panel */}
      {showManagement && (
        <ManagementPanel
          onClose={() => {
            setShowManagement(false);
            setMgmtDefaultTab("faculties");
            setMgmtFacultyId(undefined);
            // Refresh all traceability data so new faculties/departments/people appear immediately
            setRefreshKey(k => k + 1);
          }}
          pick={pick}
          defaultTab={mgmtDefaultTab}
          addDeptForFacultyId={mgmtFacultyId}
        />
      )}

      {/* Email Modal */}
      {renderEmailModal()}

      {/* Print styles */}
      <style>{`
        @media print { body { padding: 20px; } }
      `}</style>
    </>
  );
}
