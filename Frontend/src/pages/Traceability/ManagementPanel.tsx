import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { managementService } from "../../services/management";
import JSZip from "jszip";

type Tab = "faculties" | "departments" | "people" | "assignments";

const LEVELS = ["Bachelor", "Master", "PhD"];
const LEVEL_LABELS: Record<string, string> = { Bachelor: "لېسانس", Master: "ماسټري", PhD: "دوکتورا" };
const LEVEL_COLORS: Record<string, { bg: string; badge: string; dot: string }> = {
  Bachelor: { bg: "bg-sky-50 dark:bg-sky-900/20", badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300", dot: "bg-sky-500" },
  Master:   { bg: "bg-violet-50 dark:bg-violet-900/20", badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", dot: "bg-violet-500" },
  PhD:      { bg: "bg-rose-50 dark:bg-rose-900/20", badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300", dot: "bg-rose-500" },
  "":       { bg: "bg-gray-50 dark:bg-gray-800/50", badge: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300", dot: "bg-gray-400" },
};
const DEPT_TYPES = [{ value: "ADMIN", label: "اداري / اداری" }, { value: "FACULTY", label: "پوهنځی / دانشکده" }];
const STATUSES = ["ASSIGNED", "RETURNED", "DAMAGED", "TRANSFERRED"];
const STATUS_LABELS: Record<string, { ps: string; cls: string }> = {
  ASSIGNED:    { ps: "ټاکل شوی",      cls: "bg-blue-100 text-blue-800" },
  RETURNED:    { ps: "بیرته راستون",   cls: "bg-amber-100 text-amber-800" },
  DAMAGED:     { ps: "خراب شوی",       cls: "bg-red-100 text-red-800" },
  TRANSFERRED: { ps: "لیږدول شوی",    cls: "bg-purple-100 text-purple-800" },
};

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-scale-in" dir="rtl">
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">⚠️</div>
          <p className="text-gray-800 dark:text-white font-semibold text-base">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium transition-all">
            لغوه / لغو
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-bold transition-all">
            ړنګول / حذف
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteWithReasonDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-scale-in" dir="rtl">
        <div className="text-center mb-4">
          <div className="text-5xl mb-3">🗑️</div>
          <p className="text-gray-800 dark:text-white font-semibold text-base">{message}</p>
        </div>
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1 text-right">
            د حذف دلیل (اختیاري) / دلیل حذف (اختیاری)
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            placeholder="د حذف لامل وليکئ... / دلیل حذف را بنویسید..."
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium transition-all">
            لغوه / لغو
          </button>
          <button onClick={() => onConfirm(reason.trim())} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-bold transition-all">
            ړنګول / حذف
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoUpload({ value, onChange }: { value: string; onChange: (b64: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("عکس باید له 5MB کم وي / حجم عکس باید کمتر از 5MB باشد"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { onChange(ev.target?.result as string); };
    reader.readAsDataURL(file);
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="w-24 h-24 rounded-full overflow-hidden border-4 border-brand-200 dark:border-brand-700 bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity shadow-md"
        onClick={() => inputRef.current?.click()}
      >
        {value ? (
          <img src={value} alt="profile" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl">👤</span>
            <span className="text-xs text-gray-400">عکس</span>
          </div>
        )}
      </div>
      <button type="button" onClick={() => inputRef.current?.click()} className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
        📷 {value ? "بدلول / تغییر" : "د عکس اپلوډ / آپلود عکس"}
      </button>
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-xs text-red-500 hover:underline">
          ړنګول / حذف عکس
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Faculty Management ────────────────────────────────────────────────────────
function FacultiesTab({ pick }: { pick: (ps: string, dr: string) => string }) {
  const { profile } = useAuth();
  const [faculties, setFaculties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name_ps: "", name_fa: "", level: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setFaculties(await managementService.getFaculties()); } catch { setError("بارگذاری ناموفق"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm({ name_ps: "", name_fa: "", level: "" }); setError(""); setShowModal(true); };
  const openEdit = (f: any) => { setEditing(f); setForm({ name_ps: f.name_ps, name_fa: f.name_fa, level: f.level || "" }); setError(""); setShowModal(true); };

  const save = async () => {
    if (!form.name_ps.trim()) { setError(pick("نوم اړین دی","نام الزامی است")); return; }
    setSaving(true); setError("");
    try {
      if (editing) await managementService.updateFaculty(editing.id, form);
      else await managementService.createFaculty(form);
      setShowModal(false); load();
    } catch { setError(pick("ساتل ونه شو","ذخیره ناموفق")); }
    finally { setSaving(false); }
  };

  const doDelete = async (id: number, reason = "") => {
    try { await managementService.deleteFaculty(id, reason, profile?.name); setConfirm(null); load(); } catch { setError(pick("ړنګول ونه شو","حذف ناموفق")); }
  };

  const exportCsv = () => {
    const headers = ["id", "name_ps", "name_fa", "level"];
    const lines = [
      headers.join(","),
      ...faculties.map(f =>
        headers.map(h => {
          const v = String(f[h] ?? "").replace(/"/g, '""');
          return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
        }).join(",")
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `faculties_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-semibold shadow transition-all">
            ➕ {pick("پوهنځی اضافه کول","افزودن دانشکده")}
          </button>
        </div>
        <h3 className="font-bold text-gray-700 dark:text-gray-200 text-base">{pick("پوهنځیانه","دانشکده‌ها")} ({faculties.length})</h3>
      </div>

      {error && <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm text-center">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : faculties.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">🏫</div>
          <p className="text-sm">{pick("هیڅ پوهنځی نشته","هیچ دانشکده‌ای موجود نیست")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...LEVELS, ""].map(lv => {
            const group = faculties.filter(f => (f.level || "") === lv);
            if (group.length === 0) return null;
            const colors = LEVEL_COLORS[lv] || LEVEL_COLORS[""];
            const label = lv ? LEVEL_LABELS[lv] : pick("کچه نه لري","بدون سطح");
            return (
              <div key={lv || "__none__"} className={`rounded-xl p-3 ${colors.bg}`}>
                <div className="flex items-center gap-2 mb-2 justify-end">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{group.length}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${colors.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                    {label}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.map((f, i) => (
                    <div key={f.id} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 shadow-sm hover:shadow-md transition-all animate-slide-up" style={{ animationDelay: `${i * 20}ms` }}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setConfirm(f.id)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 text-sm transition-all" title="حذف">🗑️</button>
                        <button onClick={() => openEdit(f)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-500 text-sm transition-all" title="ویرایش">✏️</button>
                      </div>
                      <p className="font-semibold text-gray-800 dark:text-white text-sm text-right">{f.name_ps} / {f.name_fa}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirm !== null && <DeleteWithReasonDialog message={pick("ایا مطمئن یاست؟ ریکارډ به کثافاتو دانۍ ته لاړ شي.","آیا مطمئن هستید؟ رکورد به سطل زباله منتقل می‌شود.")} onConfirm={(r) => doDelete(confirm, r)} onCancel={() => setConfirm(null)} />}

      {showModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-scale-in" dir="rtl">
            <h3 className="font-bold text-gray-800 dark:text-white text-lg mb-4 text-right">
              {editing ? "✏️ " + pick("سمول","ویرایش") : "➕ " + pick("پوهنځی اضافه کول","افزودن دانشکده")}
            </h3>
            {error && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded-lg text-sm text-center">{error}</div>}
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("نوم (پښتو) *","نام (پشتو) *")}</label>
                <input value={form.name_ps} onChange={e => setForm(f => ({...f, name_ps: e.target.value}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400" /></div>
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("نوم (دري)","نام (دری)")}</label>
                <input value={form.name_fa} onChange={e => setForm(f => ({...f, name_fa: e.target.value}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400" /></div>
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("کچه","سطح")}</label>
                <select value={form.level} onChange={e => setForm(f => ({...f, level: e.target.value}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="">{pick("کچه غوره کړئ","انتخاب سطح")}</option>
                  {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                </select></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">{pick("لغوه","لغو")}</button>
              <button onClick={save} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-bold transition-all">
                {saving ? "..." : pick("ذخیره","ذخیره")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Department Management ────────────────────────────────────────────────────
function DepartmentsTab({ pick, defaultFacultyId }: { pick: (ps: string, dr: string) => string; defaultFacultyId?: number }) {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<any[]>([]);
  const [faculties, setFaculties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name_ps: "", name_fa: "", department_type: "ADMIN", faculty_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [filter, setFilter] = useState("ALL");
  const autoOpenedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deps, facs] = await Promise.all([managementService.getDepartments(), managementService.getFaculties()]);
      setDepartments(deps); setFaculties(facs);
    } catch { setError(pick("بارگذاری ناموفق","بارگذاری ناموفق")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-open add modal pre-filled for a specific faculty
  useEffect(() => {
    if (defaultFacultyId && !autoOpenedRef.current && !loading) {
      autoOpenedRef.current = true;
      setEditing(null);
      setForm({ name_ps: "", name_fa: "", department_type: "FACULTY", faculty_id: String(defaultFacultyId) });
      setError("");
      setFilter("FACULTY");
      setShowModal(true);
    }
  }, [defaultFacultyId, loading]);

  const openAdd = () => { setEditing(null); setForm({ name_ps: "", name_fa: "", department_type: "ADMIN", faculty_id: "" }); setError(""); setShowModal(true); };
  const openEdit = (d: any) => { setEditing(d); setForm({ name_ps: d.name_ps, name_fa: d.name_fa, department_type: d.department_type, faculty_id: d.faculty_id ? String(d.faculty_id) : "" }); setError(""); setShowModal(true); };

  const save = async () => {
    if (!form.name_ps.trim()) { setError(pick("نوم اړین دی","نام الزامی است")); return; }
    setSaving(true); setError("");
    try {
      const payload = { ...form, faculty_id: form.faculty_id ? Number(form.faculty_id) : undefined };
      if (editing) await managementService.updateDepartment(editing.id, payload);
      else await managementService.createDepartment(payload);
      setShowModal(false); load();
    } catch { setError(pick("ساتل ونه شو","ذخیره ناموفق")); }
    finally { setSaving(false); }
  };

  const doDelete = async (id: number, reason = "") => {
    try { await managementService.deleteDepartment(id, reason, profile?.name); setConfirm(null); load(); } catch { setError(pick("ړنګول ونه شو","حذف ناموفق")); }
  };

  const filtered = filter === "ALL" ? departments : departments.filter(d => d.department_type === filter);

  const exportCsv = () => {
    const rows = filtered;
    const headers = ["id", "name_ps", "name_fa", "department_type", "faculty_id", "faculty_name_ps", "faculty_level"];
    const lines = [
      headers.join(","),
      ...rows.map(d =>
        headers.map(h => {
          const v = String(d[h] ?? "").replace(/"/g, '""');
          return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
        }).join(",")
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const suffix = filter === "ALL" ? "all" : filter.toLowerCase();
    a.href = url; a.download = `departments_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-semibold shadow transition-all">
            ➕ {pick("اداره اضافه کول","افزودن دپارتمان")}
          </button>
        </div>
        <div className="flex gap-1">
          {["ALL", "ADMIN", "FACULTY"].map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filter === t ? "bg-brand-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
              {t === "ALL" ? pick("ټول","همه") : t === "ADMIN" ? pick("اداري","اداری") : pick("پوهنځی","دانشکده")}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm text-center">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">🏢</div><p className="text-sm">{pick("هیڅ اداره نشته","هیچ دپارتمانی موجود نیست")}</p></div>
      ) : filter === "FACULTY" ? (
        /* FACULTY view: group by faculty level */
        <div className="space-y-4">
          {[...LEVELS, ""].map(lv => {
            const group = filtered.filter(d => (d.faculty_level || "") === lv);
            if (group.length === 0) return null;
            const colors = LEVEL_COLORS[lv] || LEVEL_COLORS[""];
            const label = lv ? LEVEL_LABELS[lv] : pick("کچه نه لري","بدون سطح");
            return (
              <div key={lv || "__none__"} className={`rounded-xl p-3 ${colors.bg}`}>
                <div className="flex items-center gap-2 mb-2 justify-end">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{group.length}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${colors.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                    {label}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.map((d, i) => (
                    <div key={d.id} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 shadow-sm hover:shadow-md transition-all animate-slide-up" style={{ animationDelay: `${i * 20}ms` }}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setConfirm(d.id)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 text-sm transition-all" title="حذف">🗑️</button>
                        <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-500 text-sm transition-all" title="ویرایش">✏️</button>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-800 dark:text-white text-sm">{d.name_ps} / {d.name_fa}</p>
                        {d.faculty_name_ps && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">📚 {d.faculty_name_ps}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ADMIN or ALL view: flat list */
        <div className="space-y-2">
          {filtered.map((d, i) => (
            <div key={d.id} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-all animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setConfirm(d.id)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 text-sm transition-all" title="حذف">🗑️</button>
                <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-500 text-sm transition-all" title="ویرایش">✏️</button>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  {filter === "ALL" && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.department_type === "ADMIN" ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"}`}>
                      {d.department_type === "ADMIN" ? pick("اداري","اداری") : pick("پوهنځی","دانشکده")}
                    </span>
                  )}
                  <p className="font-semibold text-gray-800 dark:text-white text-sm">{d.name_ps} / {d.name_fa}</p>
                </div>
                {d.faculty_name_ps && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">📚 {d.faculty_name_ps}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirm !== null && <DeleteWithReasonDialog message={pick("ایا مطمئن یاست؟ ریکارډ به کثافاتو دانۍ ته لاړ شي.","آیا مطمئن هستید؟ رکورد به سطل زباله منتقل می‌شود.")} onConfirm={(r) => doDelete(confirm!, r)} onCancel={() => setConfirm(null)} />}

      {showModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-scale-in" dir="rtl">
            <h3 className="font-bold text-gray-800 dark:text-white text-lg mb-4">{editing ? "✏️ " + pick("سمول","ویرایش") : "➕ " + pick("اداره اضافه کول","افزودن دپارتمان")}</h3>
            {error && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded-lg text-sm text-center">{error}</div>}
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("نوم (پښتو) *","نام (پشتو) *")}</label>
                <input value={form.name_ps} onChange={e => setForm(f => ({...f, name_ps: e.target.value}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400" /></div>
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("نوم (دري)","نام (دری)")}</label>
                <input value={form.name_fa} onChange={e => setForm(f => ({...f, name_fa: e.target.value}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400" /></div>
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("ډول *","نوع *")}</label>
                <select value={form.department_type} onChange={e => setForm(f => ({...f, department_type: e.target.value, faculty_id: e.target.value === "ADMIN" ? "" : f.faculty_id}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400">
                  {DEPT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select></div>
              {form.department_type === "FACULTY" && (
                <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("پوهنځی","دانشکده")}</label>
                  <select value={form.faculty_id} onChange={e => setForm(f => ({...f, faculty_id: e.target.value}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400">
                    <option value="">{pick("پوهنځی غوره کړئ","انتخاب دانشکده")}</option>
                    {faculties.map((fc: any) => <option key={fc.id} value={fc.id}>{fc.name_ps}</option>)}
                  </select></div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">{pick("لغوه","لغو")}</button>
              <button onClick={save} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-bold">{saving ? "..." : pick("ذخیره","ذخیره")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── People Management ────────────────────────────────────────────────────────
function PeopleTab({ pick }: { pick: (ps: string, dr: string) => string }) {
  const { profile } = useAuth();
  const [people, setPeople] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ full_name: "", department_id: "", position: "", phone: "", email: "", photo: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [emailModal, setEmailModal] = useState<any>(null);
  const [emailForm, setEmailForm] = useState({ subject: "", body: "" });
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState("");
  // Bulk email
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEmailModal, setBulkEmailModal] = useState(false);
  const [bulkEmailForm, setBulkEmailForm] = useState({ subject: "", body: "" });
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);
  // CSV import
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvError, setCsvError] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ inserted: number; errors: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [peeps, deps] = await Promise.all([managementService.getPeople(), managementService.getDepartments()]);
      setPeople(peeps); setDepartments(deps);
    } catch { setError(pick("بارگذاری ناموفق","بارگذاری ناموفق")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm({ full_name: "", department_id: "", position: "", phone: "", email: "", photo: "" }); setError(""); setShowModal(true); };
  const openEdit = (p: any) => { setEditing(p); setForm({ full_name: p.full_name, department_id: String(p.department_id), position: p.position || "", phone: p.phone || "", email: p.email || "", photo: p.photo || "" }); setError(""); setShowModal(true); };

  const save = async () => {
    if (!form.full_name.trim() || !form.department_id) { setError(pick("نوم او اداره اړین دي","نام و دپارتمان الزامی است")); return; }
    setSaving(true); setError("");
    try {
      const payload = { ...form, department_id: Number(form.department_id) };
      if (editing) await managementService.updatePerson(editing.id, payload);
      else await managementService.createPerson(payload);
      setShowModal(false); load();
    } catch { setError(pick("ساتل ونه شو","ذخیره ناموفق")); }
    finally { setSaving(false); }
  };

  const doDelete = async (id: number, reason = "") => {
    try { await managementService.deletePerson(id, reason, profile?.name); setConfirm(null); load(); } catch { setError(pick("ړنګول ونه شو","حذف ناموفق")); }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const peopleWithEmail = people.filter(p => p.email);
  const allEmailSelected = peopleWithEmail.length > 0 && peopleWithEmail.every(p => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allEmailSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(peopleWithEmail.map(p => p.id)));
  };

  const sendBulkEmail = async () => {
    const targets = people.filter(p => selectedIds.has(p.id) && p.email);
    if (targets.length === 0) { setBulkResult({ ok: 0, fail: 0, errors: [pick("هیڅ شخص د ایمیل سره غوره نه دی","هیچ شخصی با ایمیل انتخاب نشده")] }); return; }
    if (!bulkEmailForm.subject.trim() || !bulkEmailForm.body.trim()) { setBulkResult({ ok: 0, fail: 0, errors: [pick("موضوع او متن اړین دي","موضوع و متن الزامی است")] }); return; }
    setBulkSending(true); setBulkResult(null);
    let ok = 0; const errors: string[] = [];
    for (const p of targets) {
      try {
        await managementService.sendEmail({ to: p.email, subject: bulkEmailForm.subject, body: bulkEmailForm.body });
        ok++;
      } catch (e: any) {
        errors.push(`${p.full_name}: ${e?.message || "error"}`);
      }
    }
    setBulkResult({ ok, fail: errors.length, errors });
    setBulkSending(false);
    if (ok > 0) { setSelectedIds(new Set()); setBulkEmailForm({ subject: "", body: "" }); }
  };

  const sendEmail = async () => {
    if (!emailModal?.email) { setEmailResult(pick("ایمیل ادرس نشته","آدرس ایمیل موجود نیست")); return; }
    if (!emailForm.subject.trim() || !emailForm.body.trim()) { setEmailResult(pick("موضوع او متن اړین دي","موضوع و متن الزامی است")); return; }
    setEmailSending(true); setEmailResult("");
    try {
      await managementService.sendEmail({ to: emailModal.email, subject: emailForm.subject, body: emailForm.body });
      setEmailResult(pick("✅ ایمیل بریالیتوب سره ولیږل شو!","✅ ایمیل با موفقیت ارسال شد!"));
      setEmailForm({ subject: "", body: "" });
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("SMTP_NOT_CONFIGURED")) setEmailResult(pick("⚠️ SMTP تنظیم نه دی. لطفاً سرور اعتبارات وتنظیم کړئ.","⚠️ SMTP پیکربندی نشده. لطفاً اعتبارات سرور را تنظیم کنید."));
      else setEmailResult(pick("❌ ایمیل ونه لیږل شو: ","❌ ارسال ناموفق: ") + msg);
    }
    finally { setEmailSending(false); }
  };

  const parseCsv = (text: string) => {
    const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { setCsvError(pick("CSV فایل د سر کرښه او لږ یو ډاټا کرښه لري","فایل CSV باید حداقل یک سطر سرستون و یک سطر داده داشته باشد")); return; }
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
    const required = ["full_name", "department_id"];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length > 0) { setCsvError(`${pick("سرستون پیدا نه شو","ستون‌های اجباری پیدا نشد")}: ${missing.join(", ")}`); return; }
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(",").map(v => v.trim().replace(/"/g, ""));
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
      if (!row.full_name || !row.department_id) continue;
      rows.push({ full_name: row.full_name, department_id: Number(row.department_id), position: row.position || undefined, phone: row.phone || undefined, email: row.email || undefined });
    }
    if (rows.length === 0) { setCsvError(pick("د وارد کولو لپاره هیڅ معتبر کرښه نشته","هیچ سطر معتبری برای وارد کردن وجود ندارد")); return; }
    setCsvError(""); setCsvRows(rows); setCsvResult(null);
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => parseCsv(ev.target?.result as string);
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const doImport = async () => {
    if (csvRows.length === 0) return;
    setCsvImporting(true); setCsvResult(null);
    try {
      const result = await managementService.importPeople(csvRows);
      setCsvResult(result);
      if (result.inserted > 0) { setCsvRows([]); load(); }
    } catch { setCsvError(pick("وارد کول ناموفق","وارد کردن ناموفق")); }
    finally { setCsvImporting(false); }
  };

  const filtered = people.filter(p => !search || p.full_name.toLowerCase().includes(search.toLowerCase()) || (p.position || "").toLowerCase().includes(search.toLowerCase()) || (p.dept_name_ps || "").toLowerCase().includes(search.toLowerCase()));

  const exportCsv = () => {
    const rows = filtered.length > 0 ? filtered : people;
    const headers = ["full_name", "department_id", "dept_name_ps", "position", "phone", "email"];
    const lines = [
      headers.join(","),
      ...rows.map(p =>
        headers.map(h => {
          const v = String(p[h] ?? "").replace(/"/g, '""');
          return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
        }).join(",")
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `people_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={pick("لټون — نوم، موقف، اداره...","جستجو...")} dir="rtl"
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm text-right text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <button onClick={() => { setBulkEmailModal(true); setBulkResult(null); setBulkEmailForm({ subject: "", body: "" }); }}
              className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl px-4 py-2 text-sm font-semibold shadow transition-all">
              ✉️ {pick(`ټول ایمیل (${selectedIds.size})`, `ارسال گروهی (${selectedIds.size})`)}
            </button>
          )}
          <button onClick={() => { setShowCsvModal(true); setCsvRows([]); setCsvError(""); setCsvResult(null); }}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 text-sm font-semibold shadow transition-all">
            📥 {pick("CSV وارد","ورود CSV")}
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-semibold shadow transition-all">
            ➕ {pick("کس اضافه کول","افزودن شخص")}
          </button>
        </div>
      </div>

      {/* Select-all row */}
      {peopleWithEmail.length > 0 && (
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs text-gray-400">{selectedIds.size > 0 ? pick(`${selectedIds.size} غوره شوي`, `${selectedIds.size} انتخاب شده`) : ""}</span>
          <button onClick={toggleSelectAll} className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium" dir="rtl">
            {allEmailSelected ? pick("ټول لغوه کړئ","لغو همه") : pick("ټول د ایمیل سره غوره کړئ","انتخاب همه با ایمیل")}
          </button>
        </div>
      )}

      {error && <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm text-center">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">👤</div><p className="text-sm">{pick("هیڅ کس نشته","هیچ شخصی موجود نیست")}</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between border rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-all animate-slide-up ${selectedIds.has(p.id) ? "bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`} style={{ animationDelay: `${i * 25}ms` }}>
              <div className="flex items-center gap-2">
                {/* Checkbox for email selection */}
                {p.email && (
                  <button onClick={() => toggleSelect(p.id)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${selectedIds.has(p.id) ? "bg-sky-500 border-sky-500 text-white" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"}`}>
                    {selectedIds.has(p.id) && <span className="text-xs">✓</span>}
                  </button>
                )}
                {p.email && (
                  <button onClick={() => { setEmailModal(p); setEmailForm({ subject: "", body: "" }); setEmailResult(""); }}
                    className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-600 text-sm transition-all" title="ایمیل">✉️</button>
                )}
                <button onClick={() => setConfirm(p.id)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 text-sm transition-all" title="حذف">🗑️</button>
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-500 text-sm transition-all" title="ویرایش">✏️</button>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-semibold text-gray-800 dark:text-white text-sm">{p.full_name}</p>
                  <div className="flex items-center gap-2 justify-end mt-0.5">
                    {p.position && <span className="text-xs text-gray-500 dark:text-gray-400">{p.position}</span>}
                    {p.email && <span className="text-xs text-sky-500" dir="ltr">{p.email}</span>}
                  </div>
                  {p.dept_name_ps && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">🏢 {p.dept_name_ps}</p>}
                </div>
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow">
                  {p.photo ? <img src={p.photo} alt={p.full_name} className="w-full h-full object-cover" /> : <span className="text-white font-bold text-sm">{p.full_name?.[0] || "؟"}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirm !== null && <DeleteWithReasonDialog message={pick("ایا مطمئن یاست؟ ریکارډ به کثافاتو دانۍ ته لاړ شي.","آیا مطمئن هستید؟ رکورد به سطل زباله منتقل می‌شود.")} onConfirm={(r) => doDelete(confirm!, r)} onCancel={() => setConfirm(null)} />}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCsvModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 w-full sm:max-w-lg sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col animate-slide-up" dir="rtl">
            <div className="bg-gradient-to-r from-amber-500 to-amber-700 p-5 flex items-center justify-between flex-shrink-0 sm:rounded-t-2xl">
              <button onClick={() => setShowCsvModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white text-lg transition-colors">✕</button>
              <h3 className="font-bold text-white text-lg">📥 {pick("د خلکو CSV وارد کول","ورود گروهی CSV خلکو")}</h3>
            </div>
            <div className="overflow-auto flex-1 p-5 space-y-4">
              {/* Format guide */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">{pick("د CSV فارمت","فرمت CSV")}</p>
                <code className="text-xs text-amber-800 dark:text-amber-200 font-mono break-all">
                  full_name,department_id,position,phone,email
                </code>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                  {pick("• full_name او department_id اړین دي","• full_name و department_id الزامی‌اند")}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {pick("• د ادارې ID د ادارو لیست کې ومومئ","• شناسه دپارتمان را از لیست دپارتمان‌ها بیابید")}
                </p>
              </div>

              {/* File picker */}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl py-6 px-4 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all">
                <span className="text-3xl mb-2">📂</span>
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{pick("CSV فایل غوره کړئ","فایل CSV انتخاب کنید")}</span>
                <span className="text-xs text-gray-400 mt-1">.csv</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
              </label>

              {csvError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm text-center">{csvError}</div>}

              {/* Preview */}
              {csvRows.length > 0 && !csvResult && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500">{pick("مخکتنه","پیش‌نمایش")}</span>
                    <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">{csvRows.length} {pick("کرښه","سطر")}</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded-xl p-2">
                    {csvRows.slice(0, 20).map((r, i) => (
                      <div key={i} className="text-xs bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5 flex items-center justify-between">
                        <span className="text-gray-400">#{r.department_id}</span>
                        <div className="text-right">
                          <span className="font-medium text-gray-800 dark:text-white">{r.full_name}</span>
                          {r.position && <span className="text-gray-400 mr-2">— {r.position}</span>}
                        </div>
                      </div>
                    ))}
                    {csvRows.length > 20 && <p className="text-xs text-gray-400 text-center py-1">+ {csvRows.length - 20} {pick("نور","بیشتر")}</p>}
                  </div>
                </div>
              )}

              {/* Result */}
              {csvResult && (
                <div className={`p-4 rounded-xl border ${csvResult.inserted > 0 ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40"}`}>
                  <p className={`font-bold text-sm mb-1 ${csvResult.inserted > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                    ✅ {csvResult.inserted} {pick("کس وارد شو","نفر وارد شد")}
                    {csvResult.errors.length > 0 && <span className="mr-2 text-red-500">❌ {csvResult.errors.length} {pick("خطا","خطا")}</span>}
                  </p>
                  {csvResult.errors.length > 0 && (
                    <ul className="text-xs text-red-600 dark:text-red-400 space-y-0.5 max-h-24 overflow-y-auto">
                      {csvResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button onClick={() => setShowCsvModal(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">
                {pick("تړل","بستن")}
              </button>
              {csvRows.length > 0 && !csvResult && (
                <button onClick={doImport} disabled={csvImporting}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-bold transition-all">
                  {csvImporting ? pick("وارد کیږي...","در حال ورود...") : pick(`وارد کول (${csvRows.length})`, `وارد کردن (${csvRows.length})`)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Person Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 w-full sm:max-w-lg sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col animate-slide-up" dir="rtl">
            <div className="bg-gradient-to-r from-brand-600 to-brand-800 p-5 flex items-center justify-between flex-shrink-0 sm:rounded-t-2xl">
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white text-lg transition-colors">✕</button>
              <h3 className="font-bold text-white text-lg">{editing ? "✏️ " + pick("شخص سمول","ویرایش شخص") : "➕ " + pick("شخص اضافه کول","افزودن شخص")}</h3>
            </div>
            <div className="overflow-auto flex-1 p-5 space-y-4">
              {error && <div className="p-2 bg-red-50 text-red-700 rounded-lg text-sm text-center">{error}</div>}

              <PhotoUpload value={form.photo} onChange={photo => setForm(f => ({...f, photo}))} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("بشپړ نوم *","نام کامل *")}</label>
                  <input value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400" /></div>
                <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("موقف","موقف")}</label>
                  <input value={form.position} onChange={e => setForm(f => ({...f, position: e.target.value}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400" /></div>
                <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">📧 {pick("ایمیل","ایمیل")}</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} dir="ltr" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-left text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400" /></div>
                <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">📞 {pick("موبایل","تلفن")}</label>
                  <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} dir="ltr" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-left text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400" /></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">🏢 {pick("اداره *","دپارتمان *")}</label>
                <select value={form.department_id} onChange={e => setForm(f => ({...f, department_id: e.target.value}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="">{pick("اداره غوره کړئ","انتخاب دپارتمان")}</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name_ps} ({d.department_type === "ADMIN" ? pick("اداري","اداری") : pick("پوهنځی","دانشکده")})</option>)}
                </select></div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex gap-3 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">{pick("لغوه","لغو")}</button>
              <button onClick={save} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-bold shadow">
                {saving ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /></span> : pick("ذخیره کول","ذخیره")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEmailModal(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-scale-in" dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setEmailModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">✕</button>
              <div className="text-right">
                <h3 className="font-bold text-gray-800 dark:text-white text-base">✉️ {pick("ایمیل لیږل","ارسال ایمیل")}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{emailModal.full_name} — <span dir="ltr">{emailModal.email}</span></p>
              </div>
            </div>
            {emailResult && (
              <div className={`mb-3 p-3 rounded-xl text-sm text-center font-medium ${emailResult.includes("✅") ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"}`}>{emailResult}</div>
            )}
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("موضوع *","موضوع *")}</label>
                <input value={emailForm.subject} onChange={e => setEmailForm(f => ({...f, subject: e.target.value}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400" /></div>
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("پیغام *","متن *")}</label>
                <textarea value={emailForm.body} onChange={e => setEmailForm(f => ({...f, body: e.target.value}))} rows={5}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEmailModal(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">{pick("لغوه","لغو")}</button>
              <button onClick={sendEmail} disabled={emailSending} className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-bold shadow transition-all">
                {emailSending ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{pick("لیږل...","ارسال...")}</span> : `✉️ ${pick("لیږل","ارسال")}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Email Modal */}
      {bulkEmailModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBulkEmailModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-lg w-full animate-scale-in" dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setBulkEmailModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">✕</button>
              <div className="text-right">
                <h3 className="font-bold text-gray-800 dark:text-white text-base">📢 {pick("ګروپي ایمیل","ایمیل گروهی")}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {pick(`${people.filter(p => selectedIds.has(p.id) && p.email).length} ترلاسه کوونکي`, `${people.filter(p => selectedIds.has(p.id) && p.email).length} گیرنده`)}
                </p>
              </div>
            </div>

            {/* Selected recipients preview */}
            <div className="mb-4 p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl max-h-28 overflow-auto">
              <div className="flex flex-wrap gap-1.5 justify-end">
                {people.filter(p => selectedIds.has(p.id) && p.email).map(p => (
                  <span key={p.id} className="text-xs bg-sky-100 dark:bg-sky-800 text-sky-700 dark:text-sky-300 px-2 py-1 rounded-full">{p.full_name}</span>
                ))}
              </div>
            </div>

            {bulkResult && (
              <div className={`mb-3 p-3 rounded-xl text-sm text-center font-medium ${bulkResult.fail === 0 ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"}`}>
                ✅ {bulkResult.ok} {pick("بریالي","موفق")} {bulkResult.fail > 0 && `• ❌ ${bulkResult.fail} ${pick("ناکام","ناموفق")}`}
                {bulkResult.errors.length > 0 && <div className="mt-1 text-xs opacity-70">{bulkResult.errors[0]}</div>}
              </div>
            )}

            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("موضوع *","موضوع *")}</label>
                <input value={bulkEmailForm.subject} onChange={e => setBulkEmailForm(f => ({...f, subject: e.target.value}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400" /></div>
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("پیغام *","متن *")}</label>
                <textarea value={bulkEmailForm.body} onChange={e => setBulkEmailForm(f => ({...f, body: e.target.value}))} rows={6}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setBulkEmailModal(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">{pick("لغوه","لغو")}</button>
              <button onClick={sendBulkEmail} disabled={bulkSending} className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-bold shadow transition-all">
                {bulkSending
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{pick("لیږل...","ارسال...")}</span>
                  : `📢 ${pick("ټولو ته ولیږئ","ارسال به همه")}`
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Assignments Management ────────────────────────────────────────────────────
function AssignmentsTab({ pick }: { pick: (ps: string, dr: string) => string }) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<any>(null);
  const [statusForm, setStatusForm] = useState({ status: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setAssignments(await managementService.getAssignments()); } catch { setError(pick("بارگذاری ناموفق","بارگذاری ناموفق")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEditStatus = (a: any) => { setEditStatus(a); setStatusForm({ status: a.status, notes: a.notes || "" }); };

  const saveStatus = async () => {
    if (!editStatus) return;
    setSaving(true);
    try { await managementService.updateAssignment(editStatus.id, statusForm); setEditStatus(null); load(); } catch { setError(pick("ساتل ونه شو","ذخیره ناموفق")); }
    finally { setSaving(false); }
  };

  const doDelete = async (id: number) => {
    try { await managementService.deleteAssignment(id); setConfirm(null); load(); } catch { setError(pick("ړنګول ونه شو","حذف ناموفق")); }
  };

  const filtered = assignments.filter(a => !search ||
    (a.item_name_ps || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.person_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.item_code || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="relative flex-1">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={pick("لټون — جنس، کس...","جستجو...")} dir="rtl"
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm text-right text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">{filtered.length} {pick("ثبت","ثبت")}</span>
      </div>

      {error && <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm text-center">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">📦</div><p className="text-sm">{pick("هیڅ ټاکنه نشته","هیچ تخصیصی موجود نیست")}</p></div>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-auto">
          {filtered.map((a, i) => {
            const statusMeta = STATUS_LABELS[a.status] || { ps: a.status, cls: "bg-gray-100 text-gray-600" };
            return (
              <div key={a.id} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-all animate-slide-up" style={{ animationDelay: `${i * 20}ms` }}>
                <div className="flex items-center gap-2">
                  <button onClick={() => setConfirm(a.id)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-500 text-sm transition-all" title="حذف">🗑️</button>
                  <button onClick={() => openEditStatus(a)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 text-blue-500 text-sm transition-all" title="وضعیت">✏️</button>
                </div>
                <div className="text-right flex-1 mx-3">
                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.cls}`}>{pick(statusMeta.ps, statusMeta.ps)}</span>
                    <p className="font-semibold text-gray-800 dark:text-white text-sm">{a.item_name_ps}</p>
                    {a.item_code && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono">{a.item_code}</span>}
                  </div>
                  <div className="flex gap-3 justify-end text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span>🔢 {a.quantity} {a.unit_name_ps || ""}</span>
                    {a.person_name && <span>👤 {a.person_name}</span>}
                    <span>📅 {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString("fa-AF") : "—"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirm !== null && <ConfirmDialog message={pick("ایا مطمئن یاست؟","آیا مطمئن هستید؟")} onConfirm={() => doDelete(confirm!)} onCancel={() => setConfirm(null)} />}

      {editStatus && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditStatus(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-scale-in" dir="rtl">
            <h3 className="font-bold text-gray-800 dark:text-white text-base mb-4">✏️ {pick("د ټاکنې وضعیت بدلول","تغییر وضعیت تخصیص")}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 text-right">{editStatus.item_name_ps} — {editStatus.person_name || pick("اداره","دپارتمان")}</p>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("وضعیت","وضعیت")}</label>
                <select value={statusForm.status} onChange={e => setStatusForm(f => ({...f, status: e.target.value}))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400">
                  {STATUSES.map(s => <option key={s} value={s}>{pick(STATUS_LABELS[s]?.ps || s, STATUS_LABELS[s]?.ps || s)}</option>)}
                </select></div>
              <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">{pick("یادداشت","یادداشت")}</label>
                <textarea value={statusForm.notes} onChange={e => setStatusForm(f => ({...f, notes: e.target.value}))} rows={3}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditStatus(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">{pick("لغوه","لغو")}</button>
              <button onClick={saveStatus} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-bold">{saving ? "..." : pick("ذخیره","ذخیره")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Management Panel ────────────────────────────────────────────────────
export default function ManagementPanel({
  onClose,
  pick,
  defaultTab,
  addDeptForFacultyId,
}: {
  onClose: () => void;
  pick: (ps: string, dr: string) => string;
  defaultTab?: Tab;
  addDeptForFacultyId?: number;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab || "faculties");
  const [exporting, setExporting] = useState(false);

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "faculties",   label: pick("پوهنځیانه","دانشکده‌ها"), icon: "🎓" },
    { key: "departments", label: pick("ادارې","دپارتمان‌ها"), icon: "🏢" },
    { key: "people",      label: pick("کسان","افراد"), icon: "👥" },
    { key: "assignments", label: pick("ټاکنې","تخصیص‌ها"), icon: "📦" },
  ];

  const toCsv = (headers: string[], rows: any[]) => {
    const lines = [
      headers.join(","),
      ...rows.map(r =>
        headers.map(h => {
          const v = String(r[h] ?? "").replace(/"/g, '""');
          return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
        }).join(",")
      ),
    ];
    return "\uFEFF" + lines.join("\n");
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const [faculties, departments, people] = await Promise.all([
        managementService.getFaculties(),
        managementService.getDepartments(),
        managementService.getPeople(),
      ]);

      const zip = new JSZip();
      const date = new Date().toISOString().slice(0, 10);

      zip.file(`faculties_${date}.csv`,    toCsv(["id","name_ps","name_fa","level"], faculties));
      zip.file(`departments_${date}.csv`,  toCsv(["id","name_ps","name_fa","department_type","faculty_id","faculty_name_ps","faculty_level"], departments));
      zip.file(`people_${date}.csv`,       toCsv(["id","full_name","dept_name_ps","department_id","position","phone","email"], people));

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `wms_org_export_${date}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch { /* silently ignore */ }
    finally { setExporting(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-50 dark:bg-gray-900 w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl max-h-[96vh] flex flex-col animate-slide-up" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-brand-700 p-5 flex items-center justify-between flex-shrink-0 sm:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white text-lg">✕</button>
            <button onClick={exportAll} disabled={exporting}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 disabled:opacity-50 text-white rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
              title={pick("ټول ډاټا د ZIP فایل کې صادر کړئ","صدور تمام داده‌ها در فایل ZIP")}>
              {exporting ? (
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : "📦"}
              {pick(exporting ? "صادریږي..." : "ټول صادر", exporting ? "در حال صدور..." : "صدور همه")}
            </button>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-white">⚙️ {pick("د ترسیم مدیریت","مدیریت ردیابی")}</h2>
            <p className="text-white/70 text-sm">{pick("پوهنځیانه، ادارې، کسان، ټاکنې","دانشکده‌ها، دپارتمان‌ها، افراد، تخصیص‌ها")}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 ${tab === t.key ? "border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
              <span className="text-lg sm:text-base">{t.icon}</span>
              <span className="leading-tight text-center">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-5">
          {tab === "faculties"   && <FacultiesTab pick={pick} />}
          {tab === "departments" && <DepartmentsTab pick={pick} defaultFacultyId={addDeptForFacultyId} />}
          {tab === "people"      && <PeopleTab pick={pick} />}
          {tab === "assignments" && <AssignmentsTab pick={pick} />}
        </div>
      </div>
    </div>
  );
}
