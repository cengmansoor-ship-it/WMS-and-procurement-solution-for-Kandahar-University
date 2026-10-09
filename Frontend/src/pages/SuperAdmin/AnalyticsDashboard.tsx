import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate, Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useLanguage } from "../../context/LanguageContext";
import { useCalendar } from "../../context/CalendarContext";
import { apiClient } from "../../api/apiClient";
import { getRequests as getFirebaseRequests } from "../../firebase/requests";

// Compute request summary from the shared backend-backed request array.
function computeReqSummary(reqs: any[]): ReqSummary {
  const c: ReqSummary = {
    total_requests: reqs.length,
    pending_count: 0, confirmed_count: 0, procurement_count: 0,
    ready_count: 0, delivered_count: 0, completed_count: 0, rejected_count: 0,
    urgent_count: 0, normal_count: 0, low_count: 0,
  };
  for (const r of reqs) {
    const s = (r.status || "").trim();
    if (["REJECTED","RejectedByRequestConfirmer","RejectedBySuperAdmin","RejectedByAdmin"].includes(s)) c.rejected_count++;
    else if (["COMPLETED","Completed"].includes(s)) c.completed_count++;
    else if (["DELIVERED","Delivered","FinalDeliveryApproved"].includes(s)) c.delivered_count++;
    else if (["READY_FOR_DELIVERY","ReceiptReportCreated","ReceivedToInventory","FS5Created","DeliveryConfirmedByRequestConfirmer"].includes(s)) c.ready_count++;
    else if (["SENT_TO_PROCUREMENT","StockNotAvailable","StockAvailable","ProcurementPending","TenderCreated","OffersReceived","ComparisonCreated","WinnerSelected","PurchaseOrderCreated"].includes(s)) c.procurement_count++;
    else if (["CONFIRMED","ConfirmedByRequestConfirmer","ApprovedBySuperAdmin","ReturnedToSuperAdmin"].includes(s)) c.confirmed_count++;
    else c.pending_count++;
    const lvl = (r.request_level || r.requestLevel || "NORMAL").toUpperCase();
    if (lvl === "URGENT") c.urgent_count++;
    else if (lvl === "LOW") c.low_count++;
    else c.normal_count++;
  }
  return c;
}

const Chart = lazy(() => import("react-apexcharts"));

interface InvSummary {
  total_items: number;
  total_stock_units: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_categories: number;
  total_warehouses: number;
}
interface ReqSummary {
  total_requests: number;
  pending_count: number;
  confirmed_count: number;
  procurement_count: number;
  ready_count: number;
  delivered_count: number;
  completed_count: number;
  rejected_count: number;
  urgent_count: number;
  normal_count: number;
  low_count: number;
}
interface ProcSummary {
  total_cases: number;
  open_count: number;
  winner_selected_count: number;
  po_created_count: number;
  total_po_amount: number;
}
interface RecSummary {
  total_receiving_records: number;
  total_units_received: number;
  total_deliveries: number;
  total_units_delivered: number;
}

function Skeleton({ h = "h-48" }: { h?: string }) {
  return <div className={`rounded-2xl skeleton-shimmer ${h} w-full`} />;
}

function ClickHint() {
  return (
    <p className="text-xs text-indigo-400 dark:text-indigo-500 mb-2 flex items-center gap-1">
      <span>👆</span>
      <span>کلیک وکړئ ترڅو مستقیم پاڼې ته لاړ شئ</span>
    </p>
  );
}

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { pick } = useLanguage();
  const { getCurrentDateString, calendarType } = useCalendar();

  const [inv, setInv] = useState<InvSummary | null>(null);
  const [req, setReq] = useState<ReqSummary | null>(null);
  const [proc, setProc] = useState<ProcSummary | null>(null);
  const [rec, setRec] = useState<RecSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const calLabel = calendarType === "shamsi" ? "شمسي" : calendarType === "qamari" ? "قمري" : "میلادي";

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r3, r4, allReqs] = await Promise.allSettled([
        apiClient.get("/reports/inventory-summary"),
        apiClient.get("/reports/procurement-summary"),
        apiClient.get("/reports/receiving-delivery-summary"),
        getFirebaseRequests({}),
      ]);
      if (r1.status === "fulfilled") setInv(r1.value as InvSummary);
      if (r3.status === "fulfilled") setProc(r3.value as ProcSummary);
      if (r4.status === "fulfilled") setRec(r4.value as RecSummary);
      // Compute request summary from the same request source used by the list pages.
      if (allReqs.status === "fulfilled") {
        setReq(computeReqSummary(Array.isArray(allReqs.value) ? allReqs.value : []));
      } else {
        // fallback: try backend summary
        try {
          const s = await apiClient.get("/reports/request-summary");
          setReq(s as ReqSummary);
        } catch (_) {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const isDark = document.documentElement.classList.contains("dark");
  const textColor = isDark ? "#9ca3af" : "#374151";
  const gridColor = isDark ? "#374151" : "#e5e7eb";

  const normalStock = Math.max(0,
    (inv?.total_items ?? 0) - (inv?.low_stock_count ?? 0) - (inv?.out_of_stock_count ?? 0)
  );

  // ── Inventory Donut ─────────────────────────────────────
  const invDonutRoutes = [
    "/superadmin/inventory",
    "/inventory/items?filter=low",
    "/inventory/items?filter=out",
  ];
  const invDonutOptions: ApexCharts.ApexOptions = {
    chart: {
      type: "donut",
      background: "transparent",
      animations: { enabled: true, speed: 700 },
      events: {
        dataPointSelection: (_e: any, _ctx: any, cfg: any) => {
          const route = invDonutRoutes[cfg.dataPointIndex];
          if (route) navigate(route);
        },
      },
    },
    labels: [
      pick("نورمال موجودي", "موجودی عادی"),
      pick("کمه موجودي", "موجودی کم"),
      pick("ختم شوی", "تمام‌شده"),
    ],
    colors: ["#10b981", "#f59e0b", "#ef4444"],
    legend: { position: "bottom", labels: { colors: textColor }, itemMargin: { horizontal: 8 } },
    dataLabels: { enabled: true, style: { fontSize: "12px", fontWeight: "600" } },
    plotOptions: {
      pie: {
        donut: {
          size: "58%",
          labels: {
            show: true,
            total: { show: true, label: pick("ټول", "کل"), color: textColor, fontSize: "13px" },
            value: { color: textColor, fontSize: "20px", fontWeight: "700" },
          },
        },
        expandOnClick: true,
      },
    },
    states: { hover: { filter: ({ type: "lighten", value: 0.1 } as any) } },
    tooltip: { y: { formatter: (v: number) => `${v} ${pick("جنس", "جنس")}` } },
    theme: { mode: isDark ? "dark" : "light" },
  };
  const invDonutSeries = [
    normalStock,
    Number(inv?.low_stock_count ?? 0),
    Number(inv?.out_of_stock_count ?? 0),
  ];

  // ── Request Horizontal Bar ───────────────────────────────
  const reqBarRoutes = [
    "/superadmin/requests",
    "/superadmin/requests",
    "/superadmin/requests",
    "/superadmin/procurement",
    "/superadmin/receiving",
    "/superadmin/requests",
    "/superadmin/requests",
  ];
  const reqCategories = [
    pick("ټول غوښتنې", "کل درخواست‌ها"),
    pick("پاتې / معلق", "معلق"),
    pick("تصویب شوي", "تأییدشده"),
    pick("تدارکاتو کې", "در تدارکات"),
    pick("وړاندې شوي", "تحویل‌شده"),
    pick("بشپړ شوي", "تکمیل‌شده"),
    pick("رد شوي", "ردشده"),
  ];
  const reqBarColors = ["#6366f1", "#f59e0b", "#10b981", "#8b5cf6", "#3b82f6", "#14b8a6", "#ef4444"];
  const reqBarSeries = [
    Number(req?.total_requests ?? 0),
    Number(req?.pending_count ?? 0),
    Number(req?.confirmed_count ?? 0),
    Number(req?.procurement_count ?? 0),
    Number(req?.delivered_count ?? 0),
    Number(req?.completed_count ?? 0),
    Number(req?.rejected_count ?? 0),
  ];
  const reqBarOptions: ApexCharts.ApexOptions = {
    chart: {
      type: "bar",
      background: "transparent",
      toolbar: { show: false },
      events: {
        dataPointSelection: (_e: any, _ctx: any, cfg: any) => {
          const route = reqBarRoutes[cfg.dataPointIndex];
          if (route) navigate(route);
        },
      },
    },
    plotOptions: { bar: { horizontal: true, borderRadius: 5, distributed: true, barHeight: "65%" } },
    colors: reqBarColors,
    xaxis: { categories: reqCategories, labels: { style: { colors: textColor, fontSize: "12px" } } },
    yaxis: { labels: { style: { colors: textColor, fontSize: "11px" } } },
    grid: { borderColor: gridColor, strokeDashArray: 4 },
    dataLabels: { enabled: true, style: { colors: ["#fff"], fontSize: "11px", fontWeight: "600" } },
    legend: { show: false },
    tooltip: { y: { formatter: (v: number) => `${v} ${pick("غوښتنه", "درخواست")}` } },
    states: { hover: { filter: ({ type: "darken", value: 0.15 } as any) } },
    theme: { mode: isDark ? "dark" : "light" },
  };

  // ── Urgency Pie ──────────────────────────────────────────
  const urgencyOptions: ApexCharts.ApexOptions = {
    chart: {
      type: "pie",
      background: "transparent",
      events: {
        dataPointSelection: () => navigate("/superadmin/requests"),
      },
    },
    labels: [
      pick("فوري", "فوری") + ` (${Number(req?.urgent_count ?? 0)})`,
      pick("عادي", "عادی") + ` (${Number(req?.normal_count ?? 0)})`,
      pick("ټیټ", "پایین") + ` (${Number(req?.low_count ?? 0)})`,
    ],
    colors: ["#ef4444", "#3b82f6", "#6b7280"],
    legend: { position: "bottom", labels: { colors: textColor }, fontSize: "11px" },
    dataLabels: { enabled: true, style: { fontSize: "11px" } },
    tooltip: { y: { formatter: (v: number) => `${v} ${pick("غوښتنه", "درخواست")}` } },
    states: { hover: { filter: ({ type: "lighten", value: 0.1 } as any) } },
    theme: { mode: isDark ? "dark" : "light" },
  };
  const urgencySeries = [
    Number(req?.urgent_count ?? 0),
    Number(req?.normal_count ?? 0),
    Number(req?.low_count ?? 0),
  ];

  // ── Procurement Column Bar ────────────────────────────────
  const procBarOptions: ApexCharts.ApexOptions = {
    chart: {
      type: "bar",
      background: "transparent",
      toolbar: { show: false },
      events: {
        dataPointSelection: () => navigate("/superadmin/procurement"),
      },
    },
    plotOptions: { bar: { columnWidth: "55%", borderRadius: 6, distributed: true } },
    colors: ["#8b5cf6", "#06b6d4", "#f59e0b"],
    xaxis: {
      categories: [
        pick("جاري قضیې", "پرونده‌های باز"),
        pick("ګټونکی ټاکل", "برنده انتخاب"),
        pick("د پیرود امر", "امر خرید"),
      ],
      labels: { style: { colors: textColor, fontSize: "11px" } },
    },
    yaxis: { labels: { style: { colors: textColor } } },
    grid: { borderColor: gridColor, strokeDashArray: 4 },
    dataLabels: { enabled: true, style: { fontWeight: "700", fontSize: "13px" } },
    legend: { show: false },
    tooltip: { y: { formatter: (v: number) => `${v} ${pick("قضیه", "پرونده")}` } },
    states: { hover: { filter: ({ type: "darken", value: 0.15 } as any) } },
    theme: { mode: isDark ? "dark" : "light" },
  };
  const procBarSeries = [{
    name: pick("شمیر", "تعداد"),
    data: [
      Number(proc?.open_count ?? 0),
      Number(proc?.winner_selected_count ?? 0),
      Number(proc?.po_created_count ?? 0),
    ],
  }];

  // ── Receiving Radial ──────────────────────────────────────
  const maxUnits = Math.max(
    Number(rec?.total_units_received ?? 0),
    Number(rec?.total_units_delivered ?? 0),
    1
  );
  const recRadialOptions: ApexCharts.ApexOptions = {
    chart: {
      type: "radialBar",
      background: "transparent",
      events: {
        dataPointSelection: () => navigate("/superadmin/receiving"),
        click: () => navigate("/superadmin/receiving"),
      },
    },
    plotOptions: {
      radialBar: {
        offsetY: 0,
        startAngle: -135,
        endAngle: 135,
        hollow: { size: "30%" },
        track: { background: gridColor, strokeWidth: "100%" },
        dataLabels: {
          name: { show: true, fontSize: "11px", color: textColor, offsetY: -10 },
          value: { show: true, fontSize: "15px", fontWeight: "700", color: textColor, offsetY: 5 },
          total: {
            show: true,
            label: pick("ترلاسه شوي", "دریافتی"),
            fontSize: "10px",
            color: textColor,
            formatter: () => String(Number(rec?.total_units_received ?? 0).toLocaleString()),
          },
        },
      },
    },
    labels: [pick("ترلاسه واحدونه", "واحد دریافتی"), pick("سپارل شوي واحدونه", "واحد تحویل‌شده")],
    colors: ["#10b981", "#3b82f6"],
    stroke: { lineCap: "round" },
    theme: { mode: isDark ? "dark" : "light" },
  };
  const recRadialSeries = [
    Math.round((Number(rec?.total_units_received ?? 0) / maxUnits) * 100),
    Math.round((Number(rec?.total_units_delivered ?? 0) / maxUnits) * 100),
  ];

  // ── Summary progress bars ─────────────────────────────────
  const summaryItems = [
    { icon: "✅", label: pick("تصویب شوي", "تأییدشده"), value: Number(req?.confirmed_count ?? 0), total: Number(req?.total_requests ?? 0), color: "bg-green-500", to: "/superadmin/requests" },
    { icon: "⏳", label: pick("پاتې / معلق", "معلق"), value: Number(req?.pending_count ?? 0), total: Number(req?.total_requests ?? 0), color: "bg-yellow-400", to: "/superadmin/requests" },
    { icon: "🚚", label: pick("سپارل شوي", "تحویل‌شده"), value: Number(req?.delivered_count ?? 0), total: Number(req?.total_requests ?? 0), color: "bg-blue-500", to: "/superadmin/receiving" },
    { icon: "❌", label: pick("رد شوي", "ردشده"), value: Number(req?.rejected_count ?? 0), total: Number(req?.total_requests ?? 0), color: "bg-red-400", to: "/superadmin/requests" },
    { icon: "🔄", label: pick("بشپړ شوي", "تکمیل‌شده"), value: Number(req?.completed_count ?? 0), total: Number(req?.total_requests ?? 0), color: "bg-teal-500", to: "/superadmin/requests" },
    { icon: "📦", label: pick("تدارکاتو کې", "در تدارکات"), value: Number(req?.procurement_count ?? 0), total: Number(req?.total_requests ?? 0), color: "bg-purple-500", to: "/superadmin/procurement" },
  ];

  return (
    <>
      <PageMeta
        title={pick("د احصائيې ډشبورډ", "داشبورد آماری") + " | Kandahar WMS"}
        description=""
      />
      <div className="space-y-6" dir="rtl">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-300/40 bg-gradient-to-l from-indigo-700 via-purple-600 to-blue-600 p-6 text-white shadow-lg">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_white,_transparent)] pointer-events-none" />
          <div className="flex items-start justify-between gap-4 flex-wrap relative z-10">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                📊 {pick("د احصائيې ډشبورډ", "داشبورد آماری")}
              </h1>
              <p className="mt-1 text-sm text-white/70">
                {pick("بشپړ آماري تحلیل — هر چارټ کلیک‌ایبل دی", "تحلیل آماری کامل — هر نمودار قابل کلیک است")}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="rounded-xl border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium">
                📅 {getCurrentDateString()} ({calLabel})
              </span>
              <button
                onClick={load}
                disabled={loading}
                className="rounded-xl border border-white/30 bg-white/10 hover:bg-white/20 px-4 py-1.5 text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1"
              >
                {loading ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : "🔄"}
                {pick("نوی کول", "بروزرسانی")}
              </button>
            </div>
          </div>
        </div>

        {/* ── Clickable Metric Cards ──────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { icon: "📦", value: inv?.total_items ?? 0, label: pick("ټول اجناس", "کل اجناس"), border: "border-blue-200 dark:border-blue-800/50", bg: "hover:bg-blue-50 dark:hover:bg-blue-900/10", to: "/superadmin/inventory" },
              { icon: "⚠️", value: inv?.low_stock_count ?? 0, label: pick("کمه موجودي", "موجودی کم"), border: "border-amber-200 dark:border-amber-800/50", bg: "hover:bg-amber-50 dark:hover:bg-amber-900/10", to: "/inventory/items?filter=low" },
              { icon: "❌", value: inv?.out_of_stock_count ?? 0, label: pick("ختم شوي اجناس", "تمام‌شده"), border: "border-red-200 dark:border-red-800/50", bg: "hover:bg-red-50 dark:hover:bg-red-900/10", to: "/inventory/items?filter=out" },
              { icon: "📋", value: req?.total_requests ?? 0, label: pick("ټول غوښتنې", "کل درخواست‌ها"), border: "border-indigo-200 dark:border-indigo-800/50", bg: "hover:bg-indigo-50 dark:hover:bg-indigo-900/10", to: "/superadmin/requests" },
              { icon: "🏷️", value: proc?.total_cases ?? 0, label: pick("تدارکاتي قضیې", "پرونده‌های تدارکاتی"), border: "border-purple-200 dark:border-purple-800/50", bg: "hover:bg-purple-50 dark:hover:bg-purple-900/10", to: "/superadmin/procurement" },
              { icon: "📥", value: rec?.total_receiving_records ?? 0, label: pick("ترلاسه ثبتونه", "ثبت‌های تحویل"), border: "border-teal-200 dark:border-teal-800/50", bg: "hover:bg-teal-50 dark:hover:bg-teal-900/10", to: "/superadmin/receiving" },
            ].map(card => (
              <Link
                key={card.label}
                to={card.to}
                className={`rounded-2xl border-2 ${card.border} ${card.bg} bg-white dark:bg-white/[0.03] p-4 flex items-center gap-3 transition-all hover:shadow-md cursor-pointer group`}
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">{card.icon}</span>
                <div>
                  <p className="text-xl font-extrabold text-gray-800 dark:text-white/90">{Number(card.value).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{card.label}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── Row 1: Inventory Donut + Request Bar ──────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Inventory Donut */}
          <div
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            title={pick("کلیک وکړئ", "کلیک کنید")}
          >
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-0.5">
              📦 {pick("د موجودۍ وضعیت", "وضعیت موجودی")}
            </h2>
            <ClickHint />
            {loading ? <Skeleton h="h-64" /> : (
              <Suspense fallback={<Skeleton h="h-64" />}>
                <Chart type="donut" options={invDonutOptions} series={invDonutSeries} height={280} />
              </Suspense>
            )}
            {!loading && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Link to="/superadmin/inventory" className="rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 text-center transition-colors">
                  <p className="text-lg font-bold text-blue-600">{inv?.total_categories ?? 0}</p>
                  <p className="text-xs text-gray-500">{pick("کټګوري", "دسته‌بندی")}</p>
                </Link>
                <Link to="/superadmin/inventory" className="rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/20 p-2 text-center transition-colors">
                  <p className="text-lg font-bold text-purple-600">{inv?.total_warehouses ?? 0}</p>
                  <p className="text-xs text-gray-500">{pick("ګدامونه", "انبارها")}</p>
                </Link>
                <Link to="/superadmin/inventory" className="rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-teal-50 dark:hover:bg-teal-900/20 p-2 text-center transition-colors">
                  <p className="text-lg font-bold text-teal-600">{Number(inv?.total_stock_units ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{pick("ټول واحدونه", "کل واحدها")}</p>
                </Link>
              </div>
            )}
          </div>

          {/* Request Bar */}
          <div
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
          >
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-0.5">
              📋 {pick("د غوښتنو وضعیت", "وضعیت درخواست‌ها")}
            </h2>
            <ClickHint />
            {loading ? <Skeleton h="h-72" /> : (
              <Suspense fallback={<Skeleton h="h-72" />}>
                <Chart type="bar" options={reqBarOptions} series={[{ name: pick("شمیر", "تعداد"), data: reqBarSeries }]} height={300} />
              </Suspense>
            )}
          </div>
        </div>

        {/* ── Row 2: Urgency + Procurement + Receiving ────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Urgency Pie */}
          <div
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5 cursor-pointer hover:border-red-300 dark:hover:border-red-700 transition-colors"
            onClick={() => navigate("/superadmin/requests")}
          >
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-0.5">
              🔥 {pick("د فوریت کچه", "سطح اولویت")}
            </h2>
            <ClickHint />
            {loading ? <Skeleton h="h-56" /> : (
              <Suspense fallback={<Skeleton h="h-56" />}>
                <Chart type="pie" options={urgencyOptions} series={urgencySeries} height={230} />
              </Suspense>
            )}
          </div>

          {/* Procurement Bar */}
          <div
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5 cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
            onClick={() => navigate("/superadmin/procurement")}
          >
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-0.5">
              🏷️ {pick("د تدارکاتو مرحلې", "مراحل تدارکاتی")}
            </h2>
            <ClickHint />
            {loading ? <Skeleton h="h-56" /> : (
              <Suspense fallback={<Skeleton h="h-56" />}>
                <Chart type="bar" options={procBarOptions} series={procBarSeries} height={220} />
              </Suspense>
            )}
            {!loading && (
              <div className="mt-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 p-3 text-center">
                <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                  ؋ {Number(proc?.total_po_amount ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-purple-500">{pick("د پیرود امرونو ټول مبلغ", "مجموع مبلغ امرهای خرید")}</p>
              </div>
            )}
          </div>

          {/* Receiving Radial */}
          <div
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5 cursor-pointer hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
            onClick={() => navigate("/superadmin/receiving")}
          >
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-0.5">
              📥 {pick("ترلاسه او سپارل", "دریافت و تحویل")}
            </h2>
            <ClickHint />
            {loading ? <Skeleton h="h-56" /> : (
              <Suspense fallback={<Skeleton h="h-56" />}>
                <Chart type="radialBar" options={recRadialOptions} series={recRadialSeries} height={230} />
              </Suspense>
            )}
            {!loading && (
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-2 text-center">
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{Number(rec?.total_units_received ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{pick("ترلاسه واحدونه", "واحد دریافتی")}</p>
                </div>
                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-2 text-center">
                  <p className="text-base font-bold text-blue-700 dark:text-blue-300">{Number(rec?.total_units_delivered ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">{pick("سپارل شوي واحدونه", "واحد تحویل‌شده")}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Clickable Progress Summary ───────────────────── */}
        {!loading && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-l from-slate-50 to-white dark:from-slate-900/40 dark:to-white/[0.02] p-5">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">
              📈 {pick("د غوښتنو د حالت تفصیلي لنډیز", "خلاصه تفصیلی وضعیت درخواست‌ها")}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              {summaryItems.map(item => {
                const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-3 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg group-hover:scale-110 transition-transform">{item.icon}</span>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{item.value}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 leading-tight">{item.label}</p>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${item.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-left">{pct}%</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
