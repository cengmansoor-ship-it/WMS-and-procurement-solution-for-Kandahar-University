import { useEffect, useState } from "react";
import { Link } from "react-router";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import PageMeta from "../../components/common/PageMeta";
import { useLanguage } from "../../context/LanguageContext";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";
import SuperAdminMonitoringService, {
  ProcurementSummary,
  ProcurementRecord,
} from "../../services/superAdminMonitoringService";

function StatCard({ label, value, color, icon, to }: { label: string; value: string | number; color: string; icon: string; to?: string }) {
  const inner = (
    <div className={`rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] transition-all ${to ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
      <span className="text-5xl">📭</span>
      <span>{message}</span>
    </div>
  );
}

const PROC_STATUS_PS: Record<string, string> = {
  OPEN: "پرانیستی",
  WINNER_SELECTED: "اخیستونکی ټاکل شو",
  PO_CREATED: "آمر خریداري جوړ شو",
};
const PROC_STATUS_DR: Record<string, string> = {
  OPEN: "باز",
  WINNER_SELECTED: "برنده انتخاب شد",
  PO_CREATED: "امر خرید صادر شد",
};
const PROC_STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  WINNER_SELECTED: "bg-green-100 text-green-700",
  PO_CREATED: "bg-purple-100 text-purple-700",
};

export default function ProcurementMonitor() {
  const { pick, lang } = useLanguage();
  const [summary, setSummary] = useState<ProcurementSummary | null>(null);
  const [cases, setCases] = useState<ProcurementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const [s, c] = await Promise.all([
          SuperAdminMonitoringService.getProcurementSummary(),
          SuperAdminMonitoringService.getProcurementCases(),
        ]);
        if (!alive) return;
        setSummary(s);
        setCases(Array.isArray(c) ? c : []);
      } catch (e) {
        console.warn("ProcurementMonitor load error:", e);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  const statusMap = lang === "dr" ? PROC_STATUS_DR : PROC_STATUS_PS;

  const statusLabels = Object.values(statusMap);
  const statusValues = summary
    ? [Number(summary.open_count ?? 0), Number(summary.winner_selected_count ?? 0), Number(summary.po_created_count ?? 0)]
    : [0, 0, 0];

  const hasChartData = statusValues.some(v => v > 0);

  const barOptions: ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit", background: "transparent" },
    plotOptions: { bar: { borderRadius: 6, columnWidth: "50%", distributed: true } },
    colors: ["#3b82f6", "#10b981", "#8b5cf6"],
    dataLabels: { enabled: true, style: { fontFamily: "inherit", fontSize: "12px" } },
    xaxis: { categories: statusLabels, labels: { style: { fontFamily: "inherit" } } },
    legend: { show: false },
    grid: { borderColor: "#f3f4f6", strokeDashArray: 4 },
    tooltip: { theme: "light", style: { fontFamily: "inherit" } },
  };

  return (
    <>
      <PageMeta title={pick("تدارکات نظارت", "نظارت تدارکات") + " | Kandahar WMS"} description="" />
      <div className="flex items-center justify-between mb-2" dir="rtl">
        <Link to="/superadmin" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-sm">
          <span>📊</span> {pick("د احصائیې ډشبورډ", "داشبورد آمار")}
        </Link>
        <CurrentDateBadge />
      </div>
      <div className="space-y-6" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white/90">
              🏷️ {pick("تدارکات نظارت", "نظارت تدارکات")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {pick("یوازې کتنه — ثبت او تعدیل نه کیږي", "فقط مشاهده — بدون ثبت یا ویرایش")}
            </p>
          </div>
          <Link to="/superadmin" className="text-xs text-primary hover:underline">{pick("← شاته", "← برگشت")}</Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-shimmer h-24 rounded-2xl" />)
          ) : summary ? (
            <>
              <StatCard label={pick("ټول قضیې", "همه پرونده‌ها")} value={summary.total_cases ?? 0} icon="📁" color="bg-blue-500" to="/procurement" />
              <StatCard label={pick("فعال تدارکات", "تدارکات فعال")} value={summary.open_count ?? 0} icon="🔓" color={Number(summary.open_count) > 0 ? "bg-amber-500" : "bg-gray-400"} to="/procurement?status=OPEN" />
              <StatCard label={pick("اخیستونکی ټاکل شوی", "برنده انتخاب شده")} value={summary.winner_selected_count ?? 0} icon="🏆" color="bg-green-500" to="/procurement?status=WINNER_SELECTED" />
              <StatCard label={pick("د آمر ارزښت (؋)", "ارزش امر خرید (؋)")} value={Number(summary.total_po_amount ?? 0).toLocaleString()} icon="💵" color="bg-purple-500" to="/procurement?status=PO_CREATED" />
            </>
          ) : (
            <div className="col-span-4"><EmptyState message={pick("د تدارکاتو معلومات شتون نه لري", "اطلاعات تدارکات یافت نشد")} /></div>
          )}
        </div>

        {/* Chart */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="mb-4 text-base font-bold text-gray-800 dark:text-white/90">{pick("د وضعیت له مخې تدارکات", "تدارکات بر اساس وضعیت")}</h2>
            {loading ? (
              <div className="skeleton-shimmer h-64 rounded-xl" />
            ) : !hasChartData ? (
              <EmptyState message={pick("کومه تدارکاتي قضیه ثبت نه ده شوې", "هیچ پرونده تدارکاتی ثبت نشده است")} />
            ) : (
              <ReactApexChart key={lang + "-proc-bar"} options={barOptions} series={[{ name: pick("شمېر", "تعداد"), data: statusValues }]} type="bar" height={260} />
            )}
          </div>

          {/* PO Amount info */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="mb-4 text-base font-bold text-gray-800 dark:text-white/90">{pick("د آمر خریداري لنډیز", "خلاصه امرهای خرید")}</h2>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-shimmer h-16 rounded-xl" />)}</div>
            ) : !summary || Number(summary.total_cases) === 0 ? (
              <EmptyState message={pick("کومه تدارکاتي قضیه ثبت نه ده شوې", "هیچ پرونده تدارکاتی ثبت نشده است")} />
            ) : (
              <div className="space-y-3">
                {[
                  { label: pick("د آمر خریداري شمېر", "تعداد امرهای خرید صادرشده"), value: summary.po_created_count ?? 0, icon: "📜", color: "bg-purple-50 dark:bg-purple-900/10" },
                  { label: pick("د آمر ټول ارزښت", "مجموع ارزش امرهای خرید"), value: `${Number(summary.total_po_amount ?? 0).toLocaleString()} ؋`, icon: "💰", color: "bg-green-50 dark:bg-green-900/10" },
                  { label: pick("اوسني فعال قضیې", "پرونده‌های فعال فعلی"), value: summary.open_count ?? 0, icon: "📂", color: "bg-blue-50 dark:bg-blue-900/10" },
                  { label: pick("بشپړ شوي (اخیستونکی ټاکل شوی)", "تکمیل‌شده (برنده انتخاب‌شده)"), value: summary.winner_selected_count ?? 0, icon: "🏆", color: "bg-amber-50 dark:bg-amber-900/10" },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-3 ${item.color}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{item.icon}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                    </div>
                    <span className="text-base font-bold text-gray-800 dark:text-white/90">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Procurement Cases Table */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800 dark:text-white/90">
              {pick("تدارکاتي قضیې", "پرونده‌های تدارکاتی")} ({cases.length})
            </h2>
            <Link to="/reports/procurement" className="text-xs text-primary hover:underline">
              {pick("بشپړ راپور ←", "گزارش کامل ←")}
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton-shimmer h-12 rounded-lg" />)}</div>
          ) : cases.length === 0 ? (
            <EmptyState message={pick("کومه تدارکاتي قضیه ثبت نه ده شوې", "هیچ پرونده تدارکاتی ثبت نشده است")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">ID</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("د غوښتنې ټراکینګ", "شناسه درخواست")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("آمر شمېر", "شماره امر")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("پلورونکی", "فروشنده")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("ارزښت (؋)", "ارزش (؋)")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("وضعیت", "وضعیت")}</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.slice(0, 20).map(c => (
                    <tr key={c.id} onClick={() => window.location.href = `/procurement/details/${c.id}`} className="border-b border-gray-50 hover:bg-blue-50/50 dark:border-gray-800/50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                      <td className="py-2.5 px-3 font-mono text-xs text-gray-500">#{c.id}</td>
                      <td className="py-2.5 px-3 text-primary font-mono text-xs">{c.request_tracking_id || "—"}</td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{c.po_number || "—"}</td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{c.vendor_name || "—"}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-700 dark:text-gray-300">
                        {c.total_amount ? `${Number(c.total_amount).toLocaleString()} ؋` : "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PROC_STATUS_COLOR[c.status] || "bg-gray-100 text-gray-600"}`}>
                          {statusMap[c.status] || c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cases.length > 20 && (
                <p className="mt-3 text-center text-xs text-gray-400">
                  {pick(`له ${cases.length} قضیو ${20} ښودل کیږي`, `از ${cases.length} پرونده فقط ${20} نمایش داده می‌شود`)}
                </p>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
