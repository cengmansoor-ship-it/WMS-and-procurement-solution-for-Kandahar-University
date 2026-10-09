import { useEffect, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useLanguage } from "../../context/LanguageContext";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";
import SuperAdminMonitoringService, {
  ReceivingSummary,
  ReceivingRecord,
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

export default function ReceivingMonitor() {
  const { pick } = useLanguage();
  const [summary, setSummary] = useState<ReceivingSummary | null>(null);
  const [records, setRecords] = useState<ReceivingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const [s, r] = await Promise.all([
          SuperAdminMonitoringService.getReceivingDeliverySummary(),
          SuperAdminMonitoringService.getReceivingRecords(),
        ]);
        if (!alive) return;
        setSummary(s);
        setRecords(Array.isArray(r) ? r : []);
      } catch (e) {
        console.warn("ReceivingMonitor load error:", e);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  return (
    <>
      <PageMeta title={pick("ترلاسه کول نظارت", "نظارت تحویل‌گیری") + " | Kandahar WMS"} description="" />
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
              📥 {pick("ترلاسه کول نظارت", "نظارت تحویل‌گیری")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {pick("یوازې کتنه — ثبت نه کیږي", "فقط مشاهده — بدون ثبت")}
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
              <StatCard label={pick("ترلاسه کولو شمېر", "تعداد تحویل‌گیری‌ها")} value={summary.total_receiving_records ?? 0} icon="📥" color="bg-green-500" to="/receiving" />
              <StatCard label={pick("ترلاسه شوي واحدونه", "واحدهای تحویل‌گرفته")} value={Number(summary.total_units_received ?? 0).toLocaleString()} icon="📊" color="bg-teal-500" to="/receiving" />
              <StatCard label={pick("د تسلیمۍ شمېر", "تعداد تحویل‌دهی‌ها")} value={summary.total_deliveries ?? 0} icon="🚚" color="bg-blue-500" to="/reports/delivery" />
              <StatCard label={pick("تسلیم شوي واحدونه", "واحدهای تحویل‌داده‌شده")} value={Number(summary.total_units_delivered ?? 0).toLocaleString()} icon="📤" color="bg-indigo-500" to="/reports/delivery" />
            </>
          ) : (
            <div className="col-span-4"><EmptyState message={pick("د ترلاسه کولو معلومات شتون نه لري", "اطلاعات تحویل‌گیری یافت نشد")} /></div>
          )}
        </div>

        {/* Summary comparison */}
        {!loading && summary && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h2 className="mb-4 text-base font-bold text-gray-800 dark:text-white/90">
                📥 {pick("ترلاسه کول", "تحویل‌گیری")}
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3 dark:bg-green-900/10">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{pick("ټول ترلاسه کول", "کل تحویل‌گیری‌ها")}</span>
                  <span className="text-lg font-bold text-green-700 dark:text-green-300">{summary.total_receiving_records ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3 dark:bg-teal-900/10">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{pick("ترلاسه شوي ټول واحدونه", "مجموع واحدهای تحویل‌گرفته")}</span>
                  <span className="text-lg font-bold text-teal-700 dark:text-teal-300">{Number(summary.total_units_received ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h2 className="mb-4 text-base font-bold text-gray-800 dark:text-white/90">
                🚚 {pick("تسلیمي", "تحویل‌دهی")}
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3 dark:bg-blue-900/10">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{pick("ټولې تسلیمۍ", "کل تحویل‌دهی‌ها")}</span>
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{summary.total_deliveries ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-900/10">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{pick("تسلیم شوي ټول واحدونه", "مجموع واحدهای تحویل‌داده‌شده")}</span>
                  <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{Number(summary.total_units_delivered ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Receiving Records Table */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800 dark:text-white/90">
              {pick("ترلاسه کولو ثبتونه", "ثبت‌های تحویل‌گیری")} ({records.length})
            </h2>
            <Link to="/reports/delivery" className="text-xs text-primary hover:underline">
              {pick("بشپړ راپور ←", "گزارش کامل ←")}
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton-shimmer h-12 rounded-lg" />)}</div>
          ) : records.length === 0 ? (
            <EmptyState message={pick("کوم ترلاسه کول ثبت نه دي شوي", "هیچ تحویل‌گیری ثبت نشده است")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">ID</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("د آمر شمېر", "شماره امر خرید")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("د غوښتنې ټراکینګ", "شناسه درخواست")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("نیټه", "تاریخ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 20).map(r => (
                    <tr key={r.id} onClick={() => window.location.href = `/receiving/details/${r.id}`} className="border-b border-gray-50 hover:bg-blue-50/50 dark:border-gray-800/50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                      <td className="py-2.5 px-3 font-mono text-xs text-gray-500">#{r.id}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-gray-600 dark:text-gray-400">{r.po_number || "—"}</td>
                      <td className="py-2.5 px-3 text-primary font-mono text-xs">{r.request_tracking_id || "—"}</td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString("fa-AF") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.length > 20 && (
                <p className="mt-3 text-center text-xs text-gray-400">
                  {pick(`له ${records.length} ثبتونو ${20} ښودل کیږي`, `از ${records.length} ثبت فقط ${20} نمایش داده می‌شود`)}
                </p>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
