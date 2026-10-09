import { useEffect, useState } from "react";
import { Link } from "react-router";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import PageMeta from "../../components/common/PageMeta";
import { useLanguage } from "../../context/LanguageContext";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";
import { getRequests as getFirebaseRequests } from "../../firebase/requests";
import type { RequestSummary, RequestRecord } from "../../services/superAdminMonitoringService";

// Classify a raw status string into one of the 7 summary buckets
function classifyStatus(status: string): keyof Omit<RequestSummary, "total_requests" | "urgent_count" | "normal_count" | "low_count"> {
  const s = (status || "").trim();
  if (["REJECTED", "RejectedByRequestConfirmer", "RejectedBySuperAdmin", "RejectedByAdmin"].includes(s)) return "rejected_count";
  if (["COMPLETED", "Completed"].includes(s)) return "completed_count";
  if (["DELIVERED", "Delivered"].includes(s)) return "delivered_count";
  if (["READY_FOR_DELIVERY", "ReceiptReportCreated", "ReceivedToInventory", "FS5Created",
       "DeliveryConfirmedByRequestConfirmer", "DeliveryReturnedToSuperAdmin", "FinalDeliveryApproved"].includes(s)) return "ready_count";
  if (["SENT_TO_PROCUREMENT", "StockNotAvailable", "StockAvailable", "ProcurementPending",
       "TenderCreated", "OffersReceived", "ComparisonCreated", "WinnerSelected",
       "PurchaseOrderCreated", "ReturnedToAdmin", "ReturnedToProcurement"].includes(s)) return "procurement_count";
  if (["CONFIRMED", "ConfirmedByRequestConfirmer", "ApprovedBySuperAdmin", "ReturnedToSuperAdmin"].includes(s)) return "confirmed_count";
  // Default: pending bucket
  return "pending_count";
}

function buildSummary(reqs: any[]): RequestSummary {
  const counts: RequestSummary = {
    total_requests: reqs.length,
    pending_count: 0, confirmed_count: 0, procurement_count: 0,
    ready_count: 0, delivered_count: 0, completed_count: 0, rejected_count: 0,
    urgent_count: 0, normal_count: 0, low_count: 0,
  };
  for (const r of reqs) {
    const bucket = classifyStatus(r.status);
    (counts as any)[bucket] = ((counts as any)[bucket] ?? 0) + 1;
    const lvl = (r.request_level || r.requestLevel || "NORMAL").toUpperCase();
    if (lvl === "URGENT") counts.urgent_count++;
    else if (lvl === "LOW") counts.low_count++;
    else counts.normal_count++;
  }
  return counts;
}

function StatCard({ label, value, color, icon, alert, to }: { label: string; value: string | number; color: string; icon: string; alert?: boolean; to?: string }) {
  const inner = (
    <div className={`rounded-2xl border bg-white p-5 dark:bg-white/[0.03] transition-all ${to ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""} ${alert ? "border-red-200 dark:border-red-800/50" : "border-gray-200 dark:border-gray-800"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${alert ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-white/90"}`}>{value}</p>
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

// Map ALL possible status values (old + new pipeline) to display labels
const STATUS_PS: Record<string, string> = {
  // Old style
  PENDING: "پاتې / منتظر",
  CONFIRMED: "تایید شوی",
  SENT_TO_PROCUREMENT: "تدارکاتو ته",
  READY_FOR_DELIVERY: "د تسلیمۍ لپاره",
  DELIVERED: "تسلیم شوی",
  COMPLETED: "بشپړ شوی",
  REJECTED: "رد شوی",
  // New pipeline statuses
  PendingReview: "د بیاکتنې انتظار",
  Submitted: "سپارل شوي",
  ReviewReturned: "بیرته راستانه",
  Draft: "مسوده",
  ConfirmedByRequestConfirmer: "د تایید کوونکي لخوا تایید",
  ApprovedBySuperAdmin: "د سوپر اډمین لخوا منظور",
  ReturnedToSuperAdmin: "سوپر اډمین ته راستانه",
  RejectedByRequestConfirmer: "د تایید کوونکي لخوا رد",
  RejectedBySuperAdmin: "د سوپر اډمین لخوا رد",
  RejectedByAdmin: "د اډمین لخوا رد",
  StockAvailable: "موجوده سامان",
  StockNotAvailable: "سامان نشته",
  ProcurementPending: "تدارکاتو کې",
  TenderCreated: "ټنډر جوړ شو",
  OffersReceived: "وړاندیزونه راغلل",
  ComparisonCreated: "پرتلنه جوړه شوه",
  WinnerSelected: "ګټونکی ټاکل شو",
  PurchaseOrderCreated: "د پیرود امر جوړ شو",
  ReceiptReportCreated: "د رسید راپور جوړ شو",
  ReceivedToInventory: "ګدام ته ورسید",
  FS5Created: "FS5 جوړ شو",
  DeliveryConfirmedByRequestConfirmer: "د سپارلو تایید",
  FinalDeliveryApproved: "وروستۍ سپارنه منظور",
  Completed: "بشپړ شوی",
  Delivered: "تسلیم شوی",
};

const STATUS_DR: Record<string, string> = {
  PENDING: "در انتظار",
  CONFIRMED: "تأیید شده",
  SENT_TO_PROCUREMENT: "به تدارکات",
  READY_FOR_DELIVERY: "آماده تحویل",
  DELIVERED: "تحویل داده شد",
  COMPLETED: "تکمیل شده",
  REJECTED: "رد شده",
  PendingReview: "در انتظار بررسی",
  Submitted: "ارسال‌شده",
  ReviewReturned: "برگشت داده شده",
  Draft: "پیش‌نویس",
  ConfirmedByRequestConfirmer: "تأیید توسط تأییدکننده",
  ApprovedBySuperAdmin: "تأیید توسط سوپرادمین",
  ReturnedToSuperAdmin: "برگشت به سوپرادمین",
  RejectedByRequestConfirmer: "رد توسط تأییدکننده",
  RejectedBySuperAdmin: "رد توسط سوپرادمین",
  RejectedByAdmin: "رد توسط ادمین",
  StockAvailable: "موجودی کافی",
  StockNotAvailable: "موجودی ناکافی",
  ProcurementPending: "در تدارکات",
  TenderCreated: "مناقصه ایجاد شد",
  WinnerSelected: "برنده انتخاب شد",
  PurchaseOrderCreated: "امر خرید صادر شد",
  Completed: "تکمیل‌شده",
  Delivered: "تحویل‌شده",
};

// Color by bucket
function statusColor(status: string): string {
  const s = (status || "").trim();
  if (["REJECTED","RejectedByRequestConfirmer","RejectedBySuperAdmin","RejectedByAdmin"].includes(s))
    return "bg-red-100 text-red-700";
  if (["COMPLETED","Completed"].includes(s))
    return "bg-green-100 text-green-700";
  if (["DELIVERED","Delivered","FinalDeliveryApproved","DeliveryConfirmedByRequestConfirmer"].includes(s))
    return "bg-teal-100 text-teal-700";
  if (["READY_FOR_DELIVERY","ReceiptReportCreated","ReceivedToInventory","FS5Created"].includes(s))
    return "bg-purple-100 text-purple-700";
  if (["SENT_TO_PROCUREMENT","StockNotAvailable","StockAvailable","ProcurementPending",
       "TenderCreated","OffersReceived","ComparisonCreated","WinnerSelected","PurchaseOrderCreated"].includes(s))
    return "bg-indigo-100 text-indigo-700";
  if (["CONFIRMED","ConfirmedByRequestConfirmer","ApprovedBySuperAdmin","ReturnedToSuperAdmin"].includes(s))
    return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}


const LEVEL_PS: Record<string, string> = { URGENT: "بیړني", NORMAL: "معمولي", LOW: "ټیټ" };
const LEVEL_DR: Record<string, string> = { URGENT: "فوری", NORMAL: "معمولی", LOW: "کم‌اهمیت" };

export default function RequestsMonitor() {
  const { pick, lang } = useLanguage();
  const [summary, setSummary] = useState<RequestSummary | null>(null);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        // Use the shared backend-backed request service so LAN clients see the same data.
        const raw = await getFirebaseRequests({});
        const allReqs: any[] = Array.isArray(raw) ? raw : [];
        if (!alive) return;
        const normalized: RequestRecord[] = allReqs.map((r: any) => ({
          id: r.id,
          tracking_id: r.tracking_id || r.trackingId || `#${r.id}`,
          status: r.status,
          request_level: r.request_level || r.requestLevel || "NORMAL",
          faculty_name: r.faculty_name || r.facultyName || "—",
          department_name: r.department_name || r.departmentName || "—",
          created_at: r.created_at || r.createdAt || "",
        }));
        setRequests(normalized);
        setSummary(buildSummary(allReqs));
      } catch (e) {
        console.warn("RequestsMonitor load error:", e);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  const statusMap = lang === "dr" ? STATUS_DR : STATUS_PS;
  const levelMap = lang === "dr" ? LEVEL_DR : LEVEL_PS;

  // Donut chart data
  const donutLabels = summary
    ? [
        statusMap.PENDING,
        statusMap.CONFIRMED,
        statusMap.SENT_TO_PROCUREMENT,
        statusMap.READY_FOR_DELIVERY,
        statusMap.DELIVERED,
        statusMap.COMPLETED,
        statusMap.REJECTED,
      ]
    : [];
  const donutSeries = summary
    ? [
        Number(summary.pending_count ?? 0),
        Number(summary.confirmed_count ?? 0),
        Number(summary.procurement_count ?? 0),
        Number(summary.ready_count ?? 0),
        Number(summary.delivered_count ?? 0),
        Number(summary.completed_count ?? 0),
        Number(summary.rejected_count ?? 0),
      ]
    : [];

  const donutHasData = donutSeries.some(v => v > 0);

  const donutOptions: ApexOptions = {
    chart: { type: "donut", fontFamily: "inherit", background: "transparent" },
    labels: donutLabels,
    colors: ["#f59e0b", "#3b82f6", "#6366f1", "#8b5cf6", "#14b8a6", "#10b981", "#ef4444"],
    legend: { position: "bottom", fontFamily: "inherit", labels: { colors: "#6b7280" } },
    dataLabels: { style: { fontFamily: "inherit", fontSize: "11px" } },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            total: { show: true, label: pick("ټول", "مجموع"), fontFamily: "inherit", color: "#374151" },
          },
        },
      },
    },
    tooltip: { theme: "light", style: { fontFamily: "inherit" } },
  };

  // Level bar
  const levelOptions: ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit", background: "transparent" },
    plotOptions: { bar: { borderRadius: 6, columnWidth: "50%" } },
    colors: ["#ef4444", "#3b82f6", "#9ca3af"],
    dataLabels: { enabled: true, style: { fontFamily: "inherit" } },
    xaxis: { categories: [levelMap.URGENT, levelMap.NORMAL, levelMap.LOW], labels: { style: { fontFamily: "inherit" } } },
    grid: { borderColor: "#f3f4f6", strokeDashArray: 4 },
    tooltip: { theme: "light", style: { fontFamily: "inherit" } },
  };

  const levelSeries = summary
    ? [{ name: pick("شمېر", "تعداد"), data: [Number(summary.urgent_count ?? 0), Number(summary.normal_count ?? 0), Number(summary.low_count ?? 0)] }]
    : [{ name: "", data: [] }];

  const levelHasData = summary ? (Number(summary.urgent_count) + Number(summary.normal_count) + Number(summary.low_count)) > 0 : false;

  return (
    <>
      <PageMeta title={pick("غوښتنې نظارت", "نظارت درخواست‌ها") + " | Kandahar WMS"} description="" />
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
              📋 {pick("غوښتنې نظارت", "نظارت درخواست‌ها")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {pick("یوازې کتنه — د غوښتنو ثبت نه کیږي", "فقط مشاهده — بدون ثبت درخواست")}
            </p>
          </div>
          <Link to="/superadmin" className="text-xs text-primary hover:underline">{pick("← شاته", "← برگشت")}</Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton-shimmer h-24 rounded-2xl" />)
          ) : summary ? (
            <>
              <StatCard label={pick("ټولې غوښتنې", "همه درخواست‌ها")} value={summary.total_requests ?? 0} icon="📋" color="bg-purple-500" to="/requests" />
              <StatCard label={pick("پاتې", "منتظر")} value={summary.pending_count ?? 0} icon="⏳" color={Number(summary.pending_count) > 0 ? "bg-amber-500" : "bg-gray-400"} to="/requests?status=PENDING" />
              <StatCard label={pick("تایید شوي", "تأیید شده")} value={summary.confirmed_count ?? 0} icon="✅" color="bg-blue-500" to="/requests?status=CONFIRMED" />
              <StatCard label={pick("تدارکاتو ته", "به تدارکات")} value={summary.procurement_count ?? 0} icon="🛒" color="bg-indigo-500" to="/requests?status=SENT_TO_PROCUREMENT" />
              <StatCard label={pick("د تسلیمۍ لپاره", "آماده تحویل")} value={summary.ready_count ?? 0} icon="📦" color="bg-violet-500" to="/requests?status=READY_FOR_DELIVERY" />
              <StatCard label={pick("تسلیم شوي", "تحویل داده شده")} value={summary.delivered_count ?? 0} icon="🚚" color="bg-teal-500" to="/requests?status=DELIVERED" />
              <StatCard label={pick("بشپړ شوي", "تکمیل شده")} value={summary.completed_count ?? 0} icon="🏁" color="bg-green-500" to="/requests?status=COMPLETED" />
              <StatCard label={pick("رد شوي", "رد شده")} value={summary.rejected_count ?? 0} icon="🚫" color={Number(summary.rejected_count) > 0 ? "bg-red-500" : "bg-gray-400"} alert={Number(summary.rejected_count) > 0} to="/requests?status=REJECTED" />
            </>
          ) : (
            <div className="col-span-4"><EmptyState message={pick("د غوښتنو معلومات شتون نه لري", "اطلاعات درخواست‌ها یافت نشد")} /></div>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="mb-4 text-base font-bold text-gray-800 dark:text-white/90">{pick("د وضعیت له مخې ویش", "توزیع بر اساس وضعیت")}</h2>
            {loading ? (
              <div className="skeleton-shimmer h-64 rounded-xl" />
            ) : !donutHasData ? (
              <EmptyState message={pick("کومه غوښتنه ثبت نه ده شوې", "هیچ درخواستی ثبت نشده است")} />
            ) : (
              <ReactApexChart key={lang + "-req-donut"} options={donutOptions} series={donutSeries} type="donut" height={280} />
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="mb-4 text-base font-bold text-gray-800 dark:text-white/90">{pick("د بیړي درجې له مخې ویش", "توزیع بر اساس درجه اهمیت")}</h2>
            {loading ? (
              <div className="skeleton-shimmer h-64 rounded-xl" />
            ) : !levelHasData ? (
              <EmptyState message={pick("کومه غوښتنه ثبت نه ده شوې", "هیچ درخواستی ثبت نشده است")} />
            ) : (
              <ReactApexChart key={lang + "-req-level"} options={levelOptions} series={levelSeries} type="bar" height={280} />
            )}
          </div>
        </div>

        {/* Requests Table */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800 dark:text-white/90">
              {pick("وروستي غوښتنې", "آخرین درخواست‌ها")} ({requests.length})
            </h2>
            <Link to="/reports/requests" className="text-xs text-primary hover:underline">
              {pick("بشپړ راپور ←", "گزارش کامل ←")}
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton-shimmer h-12 rounded-lg" />)}</div>
          ) : requests.length === 0 ? (
            <EmptyState message={pick("کومه غوښتنه ثبت نه ده شوې", "هیچ درخواستی ثبت نشده است")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("ټراکینګ", "شناسه")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("پوهنځی", "دانشکده")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("ریاست", "اداره")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("بیړیتوب", "اولویت")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("وضعیت", "وضعیت")}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.slice(0, 20).map(r => (
                    <tr key={r.id} onClick={() => window.location.href = `/requests/details/${r.id}`} className="border-b border-gray-50 hover:bg-blue-50/50 dark:border-gray-800/50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                      <td className="py-2.5 px-3 font-mono text-xs text-primary">{r.tracking_id || `#${r.id}`}</td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{r.faculty_name || "—"}</td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{r.department_name || "—"}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.request_level === "URGENT" ? "bg-red-100 text-red-700" : r.request_level === "NORMAL" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                          {levelMap[r.request_level] || r.request_level}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(r.status) || "bg-gray-100 text-gray-600"}`}>
                          {statusMap[r.status] || r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {requests.length > 20 && (
                <p className="mt-3 text-center text-xs text-gray-400">
                  {pick(`له ${requests.length} غوښتنو ${20} ښودل کیږي`, `از ${requests.length} درخواست فقط ${20} نمایش داده می‌شود`)}
                </p>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
