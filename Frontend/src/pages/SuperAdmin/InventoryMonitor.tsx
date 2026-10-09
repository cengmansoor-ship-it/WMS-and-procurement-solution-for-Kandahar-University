import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import PageMeta from "../../components/common/PageMeta";
import { useLanguage } from "../../context/LanguageContext";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";
import SuperAdminMonitoringService, {
  InventorySummary,
  InventoryItem,
  StockMovementRecord,
} from "../../services/superAdminMonitoringService";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  alert?: boolean;
  to: string;
}

function StatCard({ label, value, icon, color, alert, to }: StatCardProps) {
  return (
    <Link
      to={to}
      className={`group rounded-2xl border bg-white p-5 hover:shadow-lg transition-all dark:bg-white/[0.03] ${alert ? "border-red-200 dark:border-red-800/50 hover:border-red-400" : "border-gray-200 dark:border-gray-800 hover:border-primary/40"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl transition-transform group-hover:scale-125 duration-300">{icon}</span>
        <div className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-full ${color} ${alert ? "animate-ping" : "animate-pulse"}`} />
          <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold group-hover:text-primary transition-colors ${alert ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-white/90"}`}>
        {value}
      </p>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
      <span className="text-5xl">📭</span>
      <span>{message}</span>
    </div>
  );
}

export default function InventoryMonitor() {
  const { pick, lang } = useLanguage();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movement, setMovement] = useState<StockMovementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const [s, i, m] = await Promise.all([
          SuperAdminMonitoringService.getInventorySummary(),
          SuperAdminMonitoringService.getInventoryItems(),
          SuperAdminMonitoringService.getRecentStockMovement(),
        ]);
        if (!alive) return;
        setSummary(s);
        setItems(Array.isArray(i) ? i : []);
        setMovement(Array.isArray(m) ? m.slice(0, 50) : []);
      } catch (e) {
        console.warn("InventoryMonitor load error:", e);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  const categoryMap: Record<string, number> = {};
  items.forEach(item => {
    const cat = item.category_name || (pick("نور", "سایر"));
    categoryMap[cat] = (categoryMap[cat] || 0) + Number(item.current_stock || 0);
  });
  const catLabels = Object.keys(categoryMap);
  const catValues = Object.values(categoryMap);

  const txInCounts: Record<string, number> = {};
  const txOutCounts: Record<string, number> = {};
  movement.forEach(tx => {
    const dateKey = tx.created_at ? new Date(tx.created_at).toLocaleDateString('ps-AF-u-ca-persian', { month: 'short' }) : '?';
    if (tx.transaction_type === 'IN') txInCounts[dateKey] = (txInCounts[dateKey] || 0) + Number(tx.quantity || 0);
    else txOutCounts[dateKey] = (txOutCounts[dateKey] || 0) + Number(tx.quantity || 0);
  });

  const lowStockItems = items.filter(i => Number(i.current_stock) > 0 && Number(i.current_stock) <= Number(i.minimum_stock));
  const outOfStockItems = items.filter(i => Number(i.current_stock) === 0);

  const catChartOptions: ApexOptions = {
    chart: {
      type: "bar", toolbar: { show: false }, fontFamily: "inherit", background: "transparent",
      events: {
        dataPointSelection: (_e, _chart, config) => {
          const cat = catLabels[config.dataPointIndex];
          if (cat) navigate(`/inventory/items?filter=cat`);
        },
      },
    },
    plotOptions: { bar: { borderRadius: 4, horizontal: true } },
    colors: ["#6366f1"],
    dataLabels: { enabled: false },
    xaxis: { categories: catLabels, labels: { style: { fontFamily: "inherit", fontSize: "11px" } } },
    yaxis: { labels: { style: { fontFamily: "inherit", fontSize: "11px" } } },
    grid: { borderColor: "#f3f4f6", strokeDashArray: 4 },
    tooltip: { theme: "light", style: { fontFamily: "inherit" } },
  };

  return (
    <>
      <PageMeta title={pick("موجودي نظارت", "نظارت موجودی") + " | Kandahar WMS"} description="" />
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
              📦 {pick("موجودي نظارت", "نظارت موجودی")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {pick("یوازې کتنه — ثبت، تعدیل او حذف نه کیږي", "فقط مشاهده — بدون ثبت، ویرایش یا حذف")}
            </p>
          </div>
          <Link to="/superadmin" className="text-xs text-primary hover:underline">{pick("← شاته", "← برگشت")}</Link>
        </div>

        {/* Summary KPI — all clickable */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-24 rounded-2xl" />
            ))
          ) : summary ? (
            <>
              <StatCard label={pick("ټول اجناس", "تمام اجناس")} value={summary.total_items ?? 0} icon="📦" color="bg-blue-500" to="/inventory/items" />
              <StatCard label={pick("ټول واحدونه", "مجموع واحدها")} value={Number(summary.total_stock_units ?? 0).toLocaleString()} icon="🔢" color="bg-indigo-500" to="/inventory/items?filter=unit" />
              <StatCard label={pick("ټول کټګورۍ", "تمام دسته‌بندی‌ها")} value={summary.total_categories ?? 0} icon="🗂️" color="bg-purple-500" to="/inventory/items?filter=cat" />
              <StatCard label={pick("ټول ګدامونه", "تمام انبارها")} value={summary.total_warehouses ?? 0} icon="🏭" color="bg-cyan-500" to="/inventory/items" />
              <StatCard label={pick("کمه موجودي", "موجودی کم")} value={summary.low_stock_count ?? 0} icon="⚠️" color={Number(summary.low_stock_count) > 0 ? "bg-orange-500" : "bg-gray-300"} alert={Number(summary.low_stock_count) > 0} to="/inventory/items?filter=low" />
              <StatCard label={pick("ختم شوي", "تمام‌شده")} value={summary.out_of_stock_count ?? 0} icon="❌" color={Number(summary.out_of_stock_count) > 0 ? "bg-red-500" : "bg-gray-300"} alert={Number(summary.out_of_stock_count) > 0} to="/inventory/items?filter=out" />
            </>
          ) : (
            <div className="col-span-6"><EmptyState message={pick("د موجودۍ معلومات شتون نه لري", "اطلاعات موجودی یافت نشد")} /></div>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-800 dark:text-white/90">{pick("د کټګورۍ له مخې موجودي", "موجودی بر اساس دسته‌بندی")}</h2>
              <Link to="/inventory/items?filter=cat" className="text-xs text-primary hover:underline">{pick("د کټګورۍ له مخې ←", "بر اساس دسته ←")}</Link>
            </div>
            {loading ? (
              <div className="skeleton-shimmer h-64 rounded-xl" />
            ) : catLabels.length === 0 ? (
              <EmptyState message={pick("کومه کټګوري ثبت نه ده شوې", "هیچ دسته‌بندی ثبت نشده است")} />
            ) : (
              <div className="cursor-pointer" title={pick("د کټګورۍ له مخې کلیک وکړئ", "برای فیلتر کلیک کنید")}>
                <ReactApexChart key={lang + "-cat"} options={catChartOptions} series={[{ name: pick("مقدار", "مقدار"), data: catValues }]} type="bar" height={260} />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-800 dark:text-white/90">{pick("وروستي حرکات", "آخرین تراکنش‌ها")}</h2>
              <div className="flex items-center gap-2">
                <Link to="/inventory/ledger?type=IN" className="text-xs text-green-600 hover:underline">📥 {pick("داخل", "ورودی")}</Link>
                <Link to="/inventory/ledger?type=OUT" className="text-xs text-red-500 hover:underline">📤 {pick("خارج", "خروجی")}</Link>
                <Link to="/inventory/ledger" className="text-xs text-primary hover:underline">{pick("ټول ←", "همه ←")}</Link>
              </div>
            </div>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton-shimmer h-10 rounded-lg" />)}</div>
            ) : movement.length === 0 ? (
              <EmptyState message={pick("کوم حرکت نه دی ثبت شوی", "هیچ تراکنشی ثبت نشده است")} />
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {movement.map((tx, idx) => (
                  <Link
                    key={tx.id || idx}
                    to={`/inventory/ledger?type=${tx.transaction_type}`}
                    className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors"
                  >
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/80">{tx.item_name}</p>
                      <p className="text-xs text-gray-500">{tx.item_code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{Number(tx.quantity).toLocaleString()}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${tx.transaction_type === "IN" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                        {tx.transaction_type === "IN" ? pick("داخل", "ورودی") : pick("خارج", "خروجی")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Alert Tables — rows clickable */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-orange-200 bg-white p-6 dark:border-orange-800/30 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-orange-600 dark:text-orange-400">
                ⚠️ {pick("کمه موجودي لرونکي اجناس", "اجناس با موجودی کم")} ({lowStockItems.length})
              </h2>
              <Link to="/inventory/items?filter=low" className="text-xs text-orange-500 hover:underline">
                {pick("ټول ←", "همه ←")}
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-shimmer h-10 rounded-lg" />)}</div>
            ) : lowStockItems.length === 0 ? (
              <EmptyState message={pick("کوم جنس نه دی کم موجودي", "هیچ جنسی با موجودی کم وجود ندارد")} />
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {lowStockItems.map(item => (
                  <Link
                    key={item.id}
                    to={`/inventory/items?filter=low`}
                    className="flex items-center justify-between rounded-xl bg-orange-50 px-3 py-2 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors"
                  >
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/80">{item.name_ps}</p>
                      <p className="text-xs text-gray-500">{item.category_name}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-orange-600">{item.current_stock}</p>
                      <p className="text-xs text-gray-400">{pick("لږترلږه:", "حداقل:")} {item.minimum_stock}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-red-200 bg-white p-6 dark:border-red-800/30 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-red-600 dark:text-red-400">
                ❌ {pick("ختم شوي اجناس", "اجناس تمام‌شده")} ({outOfStockItems.length})
              </h2>
              <Link to="/inventory/items?filter=out" className="text-xs text-red-500 hover:underline">
                {pick("ټول ←", "همه ←")}
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-shimmer h-10 rounded-lg" />)}</div>
            ) : outOfStockItems.length === 0 ? (
              <EmptyState message={pick("ټول اجناس موجود دي", "همه اجناس موجود هستند")} />
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {outOfStockItems.map(item => (
                  <Link
                    key={item.id}
                    to={`/inventory/items?filter=out`}
                    className="flex items-center justify-between rounded-xl bg-red-50 px-3 py-2 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/80">{item.name_ps}</p>
                      <p className="text-xs text-gray-500">{item.category_name} — {item.warehouse_name}</p>
                    </div>
                    <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-lg dark:bg-red-900/40 dark:text-red-300">
                      {pick("ختم", "تمام")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Full Items Table — rows clickable */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800 dark:text-white/90">
              {pick("د اجناسو بشپړ لیست", "فهرست کامل اجناس")} ({items.length})
            </h2>
            <div className="flex items-center gap-3">
              <Link to="/inventory/items" className="text-xs text-primary hover:underline">
                {pick("ټول اجناس ←", "همه اجناس ←")}
              </Link>
              <Link to="/reports/inventory" className="text-xs text-gray-500 hover:underline">
                {pick("بشپړ راپور ←", "گزارش کامل ←")}
              </Link>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton-shimmer h-12 rounded-lg" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState message={pick("کوم جنس ثبت نه دی شوی", "هیچ جنسی ثبت نشده است")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("نوم", "نام")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("کوډ", "کد")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("کټګوري", "دسته")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("ګدام", "انبار")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("موجودي", "موجودی")}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">{pick("وضعیت", "وضعیت")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 30).map(item => {
                    const stock = Number(item.current_stock);
                    const min = Number(item.minimum_stock);
                    const status = stock === 0 ? "out" : stock <= min ? "low" : "ok";
                    const toLink = status === "out"
                      ? "/inventory/items?filter=out"
                      : status === "low"
                      ? "/inventory/items?filter=low"
                      : "/inventory/items";
                    return (
                      <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800/50 group">
                        <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-white/80">
                          <Link to={toLink} className="group-hover:text-primary transition-colors hover:underline">{item.name_ps}</Link>
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">{item.item_code}</td>
                        <td className="py-2.5 px-3">
                          <Link to="/inventory/items?filter=cat" className="text-gray-500 hover:text-purple-600 transition-colors">{item.category_name}</Link>
                        </td>
                        <td className="py-2.5 px-3 text-gray-500">{item.warehouse_name}</td>
                        <td className="py-2.5 px-3 font-bold text-gray-700 dark:text-gray-300">{stock.toLocaleString()} {item.unit_name}</td>
                        <td className="py-2.5 px-3">
                          <Link to={toLink} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status === "out" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : status === "low" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}`}>
                            {status === "out" ? pick("ختم", "تمام") : status === "low" ? pick("کم", "کم") : pick("سم", "موجود")}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {items.length > 30 && (
                <div className="mt-3 text-center">
                  <Link to="/inventory/items" className="text-xs text-primary hover:underline">
                    {pick(`نور ${items.length - 30} اجناس وګورئ ←`, `مشاهده ${items.length - 30} جنس دیگر ←`)}
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
