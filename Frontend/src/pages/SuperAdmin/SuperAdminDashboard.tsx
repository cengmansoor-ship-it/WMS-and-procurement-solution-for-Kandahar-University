import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useCalendar } from "../../context/CalendarContext";
import { useSuperAdminMonitoring } from "../../hooks/useSuperAdminMonitoring";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  to: string;
  alert?: boolean;
}

function KpiCard({ label, value, icon, color, to, alert }: KpiCardProps) {
  return (
    <Link
      to={to}
      className={`group rounded-2xl border bg-white p-5 hover:shadow-lg transition-all dark:bg-white/[0.03] ${alert ? "border-red-200 dark:border-red-800/50" : "border-gray-200 dark:border-gray-800"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl transition-transform group-hover:scale-125 duration-300">{icon}</span>
        <div className={`w-2.5 h-2.5 rounded-full ${color} ${alert ? "animate-ping" : "animate-pulse"}`} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${alert ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-white/90"} group-hover:text-primary transition-colors`}>
        {value}
      </p>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-sm gap-2">
      <span className="text-4xl">📭</span>
      <span>{message}</span>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const { pick } = useLanguage();
  const { getCurrentDateString, calendarType } = useCalendar();
  const { inventorySummary, requestSummary, procurementSummary, receivingSummary, loading, error, refresh } =
    useSuperAdminMonitoring();

  const calLabel = calendarType === "shamsi" ? "شمسي" : calendarType === "qamari" ? "قمري" : "میلادي";
  const todayStr = getCurrentDateString();

  const sections = [
    {
      title: pick("موجودي نظارت", "نظارت موجودی"),
      to: "/superadmin/inventory",
      icon: "📦",
      desc: pick("د اجناسو وضعیت، داخل، خارج او بارکوډونه", "وضعیت اجناس، ورودی، خروجی و بارکدها"),
    },
    {
      title: pick("غوښتنې نظارت", "نظارت درخواست‌ها"),
      to: "/superadmin/requests",
      icon: "📋",
      desc: pick("د ټولو غوښتنو وضعیت او احصایې", "وضعیت و آمار همه درخواست‌ها"),
    },
    {
      title: pick("تدارکات نظارت", "نظارت تدارکات"),
      to: "/superadmin/procurement",
      icon: "🏷️",
      desc: pick("فعال تدارکات، سپارښتنې او آمرونه", "تدارکات فعال، پیشنهادات و امرهای خرید"),
    },
    {
      title: pick("ترلاسه کول نظارت", "نظارت تحویل‌گیری"),
      to: "/superadmin/receiving",
      icon: "📥",
      desc: pick("ترلاسه شوي توکي او تسلیمي", "اقلام تحویل‌گرفته‌شده و تحویل‌داده‌شده"),
    },
    {
      title: pick("د اجناسو تعقیب", "ردیابی اجناس"),
      to: "/traceability",
      icon: "🔍",
      desc: pick("د اجناسو حرکت او د کسانو لیست", "حرکت اجناس و فهرست اشخاص"),
    },
    {
      title: pick("راپورونه", "گزارش‌ها"),
      to: "/reports",
      icon: "📊",
      desc: pick("ټول سیستمي راپورونه او تحلیلونه", "همه گزارش‌های سیستمی و تحلیل‌ها"),
    },
  ];

  return (
    <>
      <PageMeta
        title={pick("د سوپر اډمین نظارت پاڼه", "داشبورد نظارتی سوپر ادمین") + " | Kandahar WMS"}
        description=""
      />
      <div className="space-y-6" dir="rtl">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-white to-indigo-50 p-6 dark:from-primary/20 dark:via-white/[0.03] dark:to-indigo-900/10 dark:border-primary/30">
          <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white/90">
                {pick("د سوپر اډمین نظارت مرکز", "مرکز نظارتی سوپر ادمین")}
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {pick(
                  "د سیستم د ټولو کارمندانو، عملیاتو او فعالیتونو لنډیز",
                  "خلاصه‌ای از همه کارمندان، عملیات و فعالیت‌های سیستم"
                )}
              </p>
              {profile && (
                <p className="mt-2 text-xs text-primary font-medium">
                  {pick("ښه راغلاست،", "خوش آمدید،")} <span className="font-bold">{profile.name}</span>{" "}
                  <span className="opacity-60">— Supervisor</span>
                </p>
              )}
            </div>
            <button
              onClick={refresh}
              className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/[0.05] dark:text-gray-300"
            >
              🔄 {pick("نوی کول", "بروزرسانی")}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {pick("د سیستم عمومي شاخصونه", "شاخص‌های عمومی سیستم")}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary dark:border-primary/30 dark:bg-primary/10" dir="rtl">
              📅 {todayStr} <span className="opacity-60">({calLabel})</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                  <div className="skeleton-shimmer h-6 w-8 rounded mb-3" />
                  <div className="skeleton-shimmer h-3 w-20 rounded mb-2" />
                  <div className="skeleton-shimmer h-7 w-14 rounded" />
                </div>
              ))
            ) : (
              <>
                {/* Inventory KPIs */}
                {inventorySummary ? (
                  <>
                    <KpiCard label={pick("ټول اجناس", "تمام اجناس")} value={inventorySummary.total_items ?? 0} icon="📦" color="bg-blue-500" to="/superadmin/inventory" />
                    <KpiCard label={pick("ټول موجودي واحدونه", "مجموع واحدهای موجودی")} value={Number(inventorySummary.total_stock_units ?? 0).toLocaleString()} icon="🏷️" color="bg-indigo-500" to="/superadmin/inventory" />
                    <KpiCard label={pick("کمه موجودي", "موجودی کم")} value={inventorySummary.low_stock_count ?? 0} icon="⚠️" color={Number(inventorySummary.low_stock_count) > 0 ? "bg-orange-500" : "bg-gray-400"} to="/superadmin/inventory" alert={Number(inventorySummary.low_stock_count) > 0} />
                    <KpiCard label={pick("ختم شوي اجناس", "اجناس تمام‌شده")} value={inventorySummary.out_of_stock_count ?? 0} icon="❌" color={Number(inventorySummary.out_of_stock_count) > 0 ? "bg-red-500" : "bg-gray-400"} to="/superadmin/inventory" alert={Number(inventorySummary.out_of_stock_count) > 0} />
                  </>
                ) : (
                  <div className="col-span-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                    <EmptyState message={pick("د موجودۍ معلومات شتون نه لري", "اطلاعات موجودی یافت نشد")} />
                  </div>
                )}

                {/* Request KPIs */}
                {requestSummary ? (
                  <>
                    <KpiCard label={pick("ټولې غوښتنې", "همه درخواست‌ها")} value={requestSummary.total_requests ?? 0} icon="📋" color="bg-purple-500" to="/superadmin/requests" />
                    <KpiCard label={pick("پاتې غوښتنې", "درخواست‌های منتظر")} value={requestSummary.pending_count ?? 0} icon="⏳" color={Number(requestSummary.pending_count) > 0 ? "bg-amber-500" : "bg-gray-400"} to="/superadmin/requests" />
                    <KpiCard label={pick("بشپړې غوښتنې", "درخواست‌های تکمیل‌شده")} value={requestSummary.completed_count ?? 0} icon="✅" color="bg-teal-500" to="/superadmin/requests" />
                    <KpiCard label={pick("رد شوي غوښتنې", "درخواست‌های رد‌شده")} value={requestSummary.rejected_count ?? 0} icon="🚫" color={Number(requestSummary.rejected_count) > 0 ? "bg-red-400" : "bg-gray-400"} to="/superadmin/requests" />
                  </>
                ) : (
                  <div className="col-span-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                    <EmptyState message={pick("د غوښتنو معلومات شتون نه لري", "اطلاعات درخواست‌ها یافت نشد")} />
                  </div>
                )}

                {/* Procurement KPIs */}
                {procurementSummary && (
                  <>
                    <KpiCard label={pick("ټول تدارکاتي قضیې", "همه پرونده‌های تدارکاتی")} value={procurementSummary.total_cases ?? 0} icon="🛒" color="bg-cyan-500" to="/superadmin/procurement" />
                    <KpiCard label={pick("فعال تدارکات", "تدارکات فعال")} value={procurementSummary.open_count ?? 0} icon="🔓" color={Number(procurementSummary.open_count) > 0 ? "bg-blue-500" : "bg-gray-400"} to="/superadmin/procurement" />
                  </>
                )}

                {/* Receiving KPIs */}
                {receivingSummary && (
                  <>
                    <KpiCard label={pick("ترلاسه کول", "تحویل‌گیری‌ها")} value={receivingSummary.total_receiving_records ?? 0} icon="📥" color="bg-green-500" to="/superadmin/receiving" />
                    <KpiCard label={pick("تسلیمۍ", "تحویل‌دهی‌ها")} value={receivingSummary.total_deliveries ?? 0} icon="🚚" color="bg-emerald-500" to="/superadmin/receiving" />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Monitoring Sections */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {pick("د نظارت مرکزونه", "مراکز نظارتی")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sections.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="group flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-md hover:border-primary/30 transition-all dark:border-gray-800 dark:bg-white/[0.03]"
              >
                <span className="text-3xl mt-0.5 transition-transform group-hover:scale-110 duration-300">{s.icon}</span>
                <div className="flex-1 text-right">
                  <h3 className="font-bold text-sm text-gray-800 dark:text-white/90 group-hover:text-primary transition-colors">{s.title}</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{s.desc}</p>
                </div>
                <span className="text-gray-300 group-hover:text-primary transition-colors mt-1">←</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Links: Management Tools */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {pick("د اداری وسیلې", "ابزارهای مدیریتی")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: pick("کاروونکي", "کاربران"), to: "/user-management", icon: "👥" },
              { label: pick("صلاحیتونه", "دسترسی‌ها"), to: "/role-management", icon: "🔑" },
              { label: pick("فورمونه", "فرم‌ها"), to: "/official-forms", icon: "📄" },
              { label: pick("تنظیمات", "تنظیمات"), to: "/settings", icon: "⚙️" },
              { label: pick("د سیستم فعالیتونه", "فعالیت‌های سیستم"), to: "/reports/audit", icon: "📝" },
              { label: pick("حذف شوي", "حذف‌شده‌ها"), to: "/maintenance/trash", icon: "🗑️" },
              { label: pick("د سیستم روغتیا", "سلامت سیستم"), to: "/maintenance/health", icon: "💊" },
              { label: pick("بیکپ", "پشتیبان‌گیری"), to: "/maintenance/backup", icon: "💾" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-primary/30 hover:bg-primary/5 transition-all dark:border-gray-800 dark:bg-white/[0.03]"
              >
                <span className="text-xl transition-transform group-hover:scale-110 duration-200">{item.icon}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary transition-colors">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
