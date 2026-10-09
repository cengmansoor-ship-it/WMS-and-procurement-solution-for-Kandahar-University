import { useState, useEffect } from "react";
import PageMeta from "../components/common/PageMeta";
import Breadcrumb from "../components/common/Breadcrumb";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS } from "../constants/roles";
import CurrentDateBadge from "../components/common/CurrentDateBadge";
import SecureDeleteModal from "../components/common/SecureDeleteModal";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CustomRole {
  id: number;
  name: string;
  name_ps: string;
  name_dr: string;
  permissions: string[];
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SYSTEM_ROLE_META: Record<string, { icon: string; colorClasses: string; namePs: string; nameDr: string; descPs: string; descDr: string }> = {
  [ROLES.SUPER_ADMIN]:          { icon: "👑", colorClasses: "border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700/50",      namePs: "سوپر اډمین",          nameDr: "سوپر ادمین",          descPs: "بشپړ لاسرسی",        descDr: "دسترسی کامل" },
  [ROLES.ADMIN]:                { icon: "🛠️", colorClasses: "border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700/50", namePs: "اجناسو آمر",          nameDr: "آمر اجناس",           descPs: "عمومي مدیریت",      descDr: "مدیریت عمومی" },
  [ROLES.PROCUREMENT_DIRECTOR]: { icon: "📋", colorClasses: "border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-700/50", namePs: "د تدارکاتو مدیر",    nameDr: "مدیر تدارکات",       descPs: "تدارکاتو پروسه",   descDr: "فرایند تدارکات" },
  [ROLES.WAREHOUSE_DIRECTOR]:   { icon: "🏭", colorClasses: "border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700/50",    namePs: "اجناسو مدیر",        nameDr: "مدیر اجناس",         descPs: "ګدام نظارت",       descDr: "نظارت انبار" },
  [ROLES.WAREHOUSE_ENTRY_PERSON]:{ icon: "📦", colorClasses: "border-sky-300 bg-sky-50 dark:bg-sky-900/20 dark:border-sky-700/50",       namePs: "ګدام مدیر",          nameDr: "مدیر انبار",         descPs: "موجودۍ لید",       descDr: "مشاهده موجودی" },
  [ROLES.REQUESTER]:            { icon: "📝", colorClasses: "border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700/50", namePs: "غوښتونکی",           nameDr: "درخواست‌کننده",      descPs: "غوښتنو جوړول",    descDr: "ثبت درخواست" },
  [ROLES.REQUEST_CONFIRMER]:    { icon: "✅", colorClasses: "border-teal-300 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-700/50",    namePs: "د غوښتنې تاییدوونکی", nameDr: "تأییدکننده درخواست", descPs: "غوښتنو تاییدول",  descDr: "تأیید درخواست" },
};

const PERM_META: Record<string, { icon: string; labelPs: string; labelDr: string; group: string }> = {
  [PERMISSIONS.MANAGE_USERS]:       { icon: "👤", labelPs: "کاروونکو مدیریت",   labelDr: "مدیریت کاربران",          group: "admin" },
  [PERMISSIONS.MANAGE_ROLES]:       { icon: "🛡️", labelPs: "رولونه مدیریت",     labelDr: "مدیریت نقش‌ها",           group: "admin" },
  [PERMISSIONS.VIEW_AUDIT_LOGS]:    { icon: "📜", labelPs: "فعالیت لاګونه",     labelDr: "گزارش فعالیت‌ها",         group: "admin" },
  [PERMISSIONS.VIEW_TRASH]:         { icon: "🗑️", labelPs: "ژبدار لیدل",        labelDr: "مشاهده زباله‌دان",         group: "admin" },
  [PERMISSIONS.MANAGE_SETTINGS]:    { icon: "⚙️", labelPs: "تنظیمات",           labelDr: "تنظیمات",                  group: "admin" },
  [PERMISSIONS.VIEW_INVENTORY]:     { icon: "👁️", labelPs: "موجودي لیدل",       labelDr: "مشاهده موجودی",           group: "warehouse" },
  [PERMISSIONS.EDIT_INVENTORY]:     { icon: "✏️", labelPs: "موجودي سمول",       labelDr: "ویرایش موجودی",           group: "warehouse" },
  [PERMISSIONS.VIEW_PROCUREMENT]:   { icon: "📋", labelPs: "تدارکات لیدل",      labelDr: "مشاهده تدارکات",          group: "procurement" },
  [PERMISSIONS.MANAGE_PROCUREMENT]: { icon: "🔧", labelPs: "تدارکات مدیریت",    labelDr: "مدیریت تدارکات",          group: "procurement" },
  [PERMISSIONS.VIEW_RECEIVING]:     { icon: "📥", labelPs: "تسلیمي لیدل",       labelDr: "مشاهده تحویل‌گیری",      group: "warehouse" },
  [PERMISSIONS.MANAGE_RECEIVING]:   { icon: "📤", labelPs: "تسلیمي مدیریت",     labelDr: "مدیریت تحویل‌گیری",      group: "warehouse" },
  [PERMISSIONS.CREATE_REQUESTS]:    { icon: "📝", labelPs: "غوښتنه جوړول",      labelDr: "ثبت درخواست",             group: "requests" },
  [PERMISSIONS.CONFIRM_REQUESTS]:   { icon: "✔️", labelPs: "غوښتنه تاییدول",    labelDr: "تأیید درخواست",           group: "requests" },
  [PERMISSIONS.VIEW_ALL_REQUESTS]:  { icon: "📂", labelPs: "ټولې غوښتنې لیدل",  labelDr: "مشاهده همه درخواست‌ها",  group: "requests" },
  [PERMISSIONS.VIEW_REPORTS]:       { icon: "📊", labelPs: "راپورونه لیدل",      labelDr: "مشاهده گزارش‌ها",         group: "reports" },
};

const GROUP_COLORS: Record<string, string> = {
  admin:       "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  warehouse:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  procurement: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  requests:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  reports:     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

const ALL_PERMS = Object.values(PERMISSIONS);

// ─── Empty form ───────────────────────────────────────────────────────────────
const emptyForm = { name: "", name_ps: "", name_dr: "", permissions: [] as string[] };

// ─── Permission Badge ─────────────────────────────────────────────────────────
function PermBadge({ perm }: { perm: string }) {
  const pm = PERM_META[perm];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${GROUP_COLORS[pm?.group || ""] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
      {pm?.icon} {pm?.labelPs || perm}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RoleManagement() {
  const { pick } = useLanguage();
  const { profile } = useAuth();
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDeleteRole, setPendingDeleteRole] = useState<CustomRole | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [activeTab, setActiveTab] = useState<"system" | "custom">("system");

  const flashMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadCustomRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/custom-roles");
      const data = await res.json();
      if (data.success) setCustomRoles(data.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCustomRoles(); }, []);

  const openCreate = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (role: CustomRole) => {
    setEditingRole(role);
    setForm({ name: role.name, name_ps: role.name_ps, name_dr: role.name_dr, permissions: [...role.permissions] });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name_ps.trim()) return flashMsg(pick("نوم اړین دی.", "نام الزامی است."), "error");
    const name = form.name.trim() || form.name_ps.trim().replace(/\s+/g, "_");
    setSaving(true);
    try {
      const url = editingRole ? `/api/custom-roles/${editingRole.id}` : "/api/custom-roles";
      const method = editingRole ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name }),
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(editingRole ? pick("رول تازه شو.", "نقش بروزرسانی شد.") : pick("رول جوړ شو.", "نقش ایجاد شد."), "success");
        setShowModal(false);
        await loadCustomRoles();
        setActiveTab("custom");
      } else {
        flashMsg(data.message || pick("ستونزه.", "خطا."), "error");
      }
    } catch { flashMsg(pick("د سرور سره اتصال نشو.", "خطای اتصال."), "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, reason?: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/custom-roles/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deletedByName: profile?.name || profile?.email || "",
          deleteReason: reason || "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(pick("رول د ټرش ته ولاړ. د بیا رغونې لپاره د ټرش برخه وګورئ.", "نقش به سطل زباله رفت. برای بازیابی به سطل زباله مراجعه کنید."), "success");
        await loadCustomRoles();
      } else {
        flashMsg(data.message || pick("ستونزه.", "خطا."), "error");
      }
    } catch { flashMsg(pick("د سرور سره اتصال نشو.", "خطای اتصال."), "error"); }
    finally { setDeletingId(null); }
  };

  const togglePerm = (perm: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm],
    }));
  };

  const allRoles = Object.values(ROLES);

  return (
    <>
      <PageMeta title="د صلاحیتونو مدیریت | Kandahar University WMS" description="د صلاحیتونو مدیریت" />
      <Breadcrumb pageTitle={pick("د صلاحیتونو مدیریت", "مدیریت صلاحیت‌ها")} />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="space-y-6" dir="rtl">

        {/* Feedback */}
        {msg && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
            {msg.type === "success" ? "✓ " : "✗ "}{msg.text}
          </div>
        )}

        {/* Header */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🛡️</span>
              <div>
                <h1 className="text-xl font-bold text-gray-800 dark:text-white/90">{pick("د صلاحیتونو مدیریت", "مدیریت صلاحیت‌ها")}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{pick("د هر رول لپاره د لاسرسي سطح", "سطح دسترسی برای هر نقش")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-2 text-center">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.03] px-3 py-2">
                  <div className="text-xl font-bold text-gray-800 dark:text-white">{allRoles.length}</div>
                  <div className="text-xs text-gray-500">{pick("سیستم رولونه", "نقش‌های سیستم")}</div>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.03] px-3 py-2">
                  <div className="text-xl font-bold text-gray-800 dark:text-white">{customRoles.length}</div>
                  <div className="text-xs text-gray-500">{pick("ځانګړي رولونه", "نقش‌های سفارشی")}</div>
                </div>
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition shadow-md"
              >
                <span className="text-lg leading-none">+</span>
                {pick("نوی رول", "نقش جدید")}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("system")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${activeTab === "system" ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white" : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"}`}
          >
            🔒 {pick("د سیستم رولونه", "نقش‌های سیستم")} ({allRoles.length})
          </button>
          <button
            onClick={() => setActiveTab("custom")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${activeTab === "custom" ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white" : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"}`}
          >
            ✏️ {pick("ځانګړي رولونه", "نقش‌های سفارشی")} ({customRoles.length})
          </button>
        </div>

        {/* System Roles */}
        {activeTab === "system" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl px-4 py-2.5">
              <span>🔒</span>
              <span>{pick("د سیستم رولونه لوستل یوازې دي — د بدلون لپاره IT مسوول ته مراجعه وکړئ.", "نقش‌های سیستم فقط خواندنی هستند — برای تغییر با مسئول IT تماس بگیرید.")}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {allRoles.map((role) => {
                const meta = SYSTEM_ROLE_META[role];
                const perms = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [];
                return (
                  <div key={role} className={`rounded-2xl border-2 p-5 ${meta?.colorClasses || "border-gray-200 bg-gray-50"}`}>
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/30 text-gray-600 dark:text-gray-300">
                        {perms.length} {pick("اجازه", "مجوز")}
                      </span>
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="font-bold text-gray-800 dark:text-white/90 text-sm">{pick(meta?.namePs || role, meta?.nameDr || role)}</span>
                          <span className="text-xl">{meta?.icon || "👤"}</span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono" dir="ltr">{role}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {perms.length === 0
                        ? <span className="text-xs text-gray-400">{pick("هیڅ اجازه نشته", "بدون مجوز")}</span>
                        : perms.map(p => <PermBadge key={p} perm={p} />)
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Roles */}
        {activeTab === "custom" && (
          <div className="space-y-4">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3].map(i => <div key={i} className="rounded-2xl border border-gray-200 bg-gray-50 dark:bg-gray-800 p-5 animate-pulse h-40" />)}
              </div>
            ) : customRoles.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-16 text-center">
                <div className="text-4xl mb-3">🎭</div>
                <p className="font-semibold text-gray-700 dark:text-white/80">{pick("هیڅ ځانګړی رول نشته", "هیچ نقش سفارشی وجود ندارد")}</p>
                <p className="text-sm text-gray-500 mt-1">{pick("د نوی رول اضافه کولو لپاره + نوی رول کلیک وکړئ", "برای افزودن، روی + نقش جدید کلیک کنید")}</p>
                <button onClick={openCreate} className="mt-4 px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold rounded-xl hover:bg-gray-800 transition">
                  + {pick("نوی رول جوړول", "ایجاد نقش جدید")}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {customRoles.map((role) => (
                  <div key={role.id} className="rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex gap-2">
                        {/* Edit */}
                        <button
                          onClick={() => openEdit(role)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700/40 dark:bg-blue-900/20 dark:text-blue-300 transition"
                        >
                          ✏️ {pick("سمول", "ویرایش")}
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => setPendingDeleteRole(role)}
                          disabled={deletingId === role.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300 disabled:opacity-50 transition"
                        >
                          {deletingId === role.id ? "..." : `🗑️ ${pick("ړنګول", "حذف")}`}
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="font-bold text-gray-800 dark:text-white/90 text-sm">{role.name_ps}</span>
                          <span className="text-xl">🎭</span>
                        </div>
                        {role.name_dr && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{role.name_dr}</p>}
                        <p className="text-xs text-gray-400 font-mono mt-0.5" dir="ltr">{role.name}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {role.permissions.length === 0
                        ? <span className="text-xs text-gray-400">{pick("هیڅ اجازه نشته", "بدون مجوز")}</span>
                        : role.permissions.map(p => <PermBadge key={p} perm={p} />)
                      }
                    </div>
                    <p className="text-xs text-gray-400 mt-3 text-left">{role.permissions.length} {pick("اجازه", "مجوز")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ─── Create / Edit Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">✕</button>
              <h2 className="font-bold text-gray-800 dark:text-white text-base">
                {editingRole ? pick("د رول سمول", "ویرایش نقش") : pick("نوی رول جوړول", "ایجاد نقش جدید")}
              </h2>
            </div>

            <div className="p-6 space-y-5">
              {/* Name Pashto */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{pick("د رول نوم (پښتو) *", "نام نقش (پشتو) *")}</label>
                <input
                  value={form.name_ps}
                  onChange={e => setForm(f => ({ ...f, name_ps: e.target.value }))}
                  placeholder={pick("لکه: د مالیې مدیر", "مثلاً: مدیر مالی")}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-400 dark:text-white"
                />
              </div>
              {/* Name Dari */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{pick("د رول نوم (دري)", "نام نقش (دری)")}</label>
                <input
                  value={form.name_dr}
                  onChange={e => setForm(f => ({ ...f, name_dr: e.target.value }))}
                  placeholder={pick("لکه: مدیر مالی", "مثلاً: مدیر مالی")}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-400 dark:text-white"
                />
              </div>
              {/* Role key */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{pick("د رول کلیدي نوم (انګلیسي، اختیاري)", "نام کلیدی نقش (انگلیسی، اختیاری)")}</label>
                <input
                  dir="ltr"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Finance_Manager"
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-left font-mono focus:outline-none focus:ring-2 focus:ring-gray-400 dark:text-white"
                />
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => setForm(f => ({ ...f, permissions: f.permissions.length === ALL_PERMS.length ? [] : [...ALL_PERMS] }))}
                    className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition">
                    {form.permissions.length === ALL_PERMS.length ? pick("ټولې لرې کول", "لغو همه") : pick("ټولې غوره کول", "انتخاب همه")}
                  </button>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {pick("اجازه‌ناوې", "مجوزها")} ({form.permissions.length}/{ALL_PERMS.length})
                  </label>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {ALL_PERMS.map(perm => {
                    const pm = PERM_META[perm];
                    const checked = form.permissions.includes(perm);
                    return (
                      <label key={perm} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${checked ? "bg-gray-900 dark:bg-white/10 text-white" : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"}`}>
                        <input type="checkbox" checked={checked} onChange={() => togglePerm(perm)} className="w-4 h-4 accent-white rounded" />
                        <span className="text-base">{pm?.icon || "•"}</span>
                        <span className="text-sm font-medium flex-1 text-right">{pick(pm?.labelPs || perm, pm?.labelDr || perm)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${GROUP_COLORS[pm?.group || ""] || ""}`}>
                          {pm?.group === "admin" ? pick("اداري","اداری") : pm?.group === "warehouse" ? pick("ګدام","انبار") : pm?.group === "procurement" ? pick("تدارکات","تدارکات") : pm?.group === "requests" ? pick("غوښتنه","درخواست") : pick("راپور","گزارش")}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex gap-3 rounded-b-2xl">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition">
                {pick("لغو", "انصراف")}
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl py-2.5 text-sm font-bold hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-60 transition">
                {saving ? pick("خوندي کیږي...", "در حال ذخیره...") : editingRole ? pick("تازه کول", "بروزرسانی") : pick("جوړول", "ایجاد")}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingDeleteRole && (
        <SecureDeleteModal
          title={pick("⚠️ د رول حذف کول", "⚠️ حذف نقش")}
          description={`"${pendingDeleteRole.name_ps}" ${pick("ړنګیږي. ایا ډاډه یاست؟", "حذف می‌شود. مطمئن هستید؟")}`}
          currentUserEmail={profile?.email || ""}
          requireReason={true}
          onCancel={() => setPendingDeleteRole(null)}
          onConfirm={(reason) => {
            const id = pendingDeleteRole.id;
            setPendingDeleteRole(null);
            handleDelete(id, reason);
          }}
        />
      )}
    </>
  );
}
