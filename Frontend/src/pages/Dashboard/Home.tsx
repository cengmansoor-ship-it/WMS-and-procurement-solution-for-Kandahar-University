import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import PageMeta from "../../components/common/PageMeta";
import { getItems, getRecentTransactions, WarehouseItem, StockTransaction } from "../../firebase/inventory";
import { getRequests, InventoryRequest } from "../../firebase/requests";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useCalendar } from "../../context/CalendarContext";
import { ROLES } from "../../constants/roles";

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildMonthlyStockData(transactions: StockTransaction[], months: string[], selectedYear: number, getYearFromDate: (d: Date) => number, getMonthIndexFromDate: (d: Date) => number) {
  const txForYear = transactions.filter(tx => {
    if (!tx.date) return false;
    const d = typeof tx.date === "number" ? new Date(tx.date) : new Date(String(tx.date));
    return getYearFromDate(d) === selectedYear;
  });
  const inCounts = new Array(12).fill(0);
  const outCounts = new Array(12).fill(0);
  txForYear.forEach(tx => {
    try {
      const d = typeof tx.date === "number" ? new Date(tx.date) : new Date(tx.date!);
      const idx = getMonthIndexFromDate(d);
      if (idx >= 0 && idx < 12) {
        if (tx.type === "IN") inCounts[idx] += Number(tx.quantity) || 0;
        else outCounts[idx] += Number(tx.quantity) || 0;
      }
    } catch {}
  });
  return { inData: inCounts, outData: outCounts };
}

function buildRequestStatusData(reqs: InventoryRequest[], lang: "ps" | "dr") {
  const MAP_PS: Record<string, string> = {
    Delivered: "تسلیم شوی", Submitted: "ثبت شوی", StockAvailable: "جنس شتون لري",
    StockNotAvailable: "تدارکاتو ته", PurchaseOrderCreated: "آمر خریداري",
    WinnerSelected: "اخیستونکی ټاکل شو", TenderCreated: "داوطلبي",
    ApprovedBySuperAdmin: "سوپر اډمین تایید", ConfirmedByRequestConfirmer: "تاییدوونکی تایید",
  };
  const MAP_DR: Record<string, string> = {
    Delivered: "تحویل داده شد", Submitted: "ثبت شد", StockAvailable: "موجود است",
    StockNotAvailable: "به تدارکات", PurchaseOrderCreated: "امر خرید",
    WinnerSelected: "برنده انتخاب شد", TenderCreated: "مناقصه",
    ApprovedBySuperAdmin: "تأیید سوپر ادمین", ConfirmedByRequestConfirmer: "تأیید تأییدکننده",
  };
  const map = lang === "dr" ? MAP_DR : MAP_PS;
  const statusMap: Record<string, number> = {};
  reqs.forEach(r => {
    const label = map[r.status] || r.status;
    statusMap[label] = (statusMap[label] || 0) + 1;
  });
  return { labels: Object.keys(statusMap), series: Object.values(statusMap) };
}

function buildCategoryData(items: WarehouseItem[]) {
  const catMap: Record<string, number> = {};
  items.forEach(item => {
    const cat = item.category || "نور";
    catMap[cat] = (catMap[cat] || 0) + item.currentQuantity;
  });
  return { labels: Object.keys(catMap), series: Object.values(catMap) };
}

const staggerDelay = (i: number) => ({ animationDelay: `${i * 60}ms` });

// ─── role groups ──────────────────────────────────────────────────────────────
const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
const WAREHOUSE_ROLES = [ROLES.WAREHOUSE_DIRECTOR, ROLES.WAREHOUSE_ENTRY_PERSON];
const PROCUREMENT_ROLES = [ROLES.PROCUREMENT_DIRECTOR];
const REQUESTER_ROLES = [ROLES.REQUESTER];
const CONFIRMER_ROLES = [ROLES.REQUEST_CONFIRMER];

function hasRole(role: string | undefined, roles: string[]) {
  return !!role && roles.includes(role);
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, to }: { label: string; value: string | number; icon: string; color: string; to: string }) {
  return (
    <Link to={to}
      className="group rounded-2xl border border-gray-200 bg-white p-5 card-interactive hover:shadow-lg hover:border-primary/30 dark:border-gray-800 dark:bg-white/[0.03] animate-scale-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl transition-transform group-hover:scale-125 duration-300">{icon}</span>
        <div className={`w-2.5 h-2.5 rounded-full ${color} animate-pulse-ring`}></div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90 group-hover:text-primary transition-colors stat-pop">{value}</p>
    </Link>
  );
}

function SectionCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div style={style} className={`rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-fade-in ${className}`}>
      {children}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function Home() {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [myRequests, setMyRequests] = useState<InventoryRequest[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const { pick, lang } = useLanguage();
  const { calendarType, getMonthNames, getCurrentYear, getYearFromDate, getMonthIndexFromDate, getCurrentDateString } = useCalendar();
  const calLabel = calendarType === "shamsi" ? "شمسي" : calendarType === "qamari" ? "قمري" : "میلادي";
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  const role = profile?.role;
  const isAdmin = hasRole(role, ADMIN_ROLES);
  const isWarehouse = hasRole(role, WAREHOUSE_ROLES);
  const isProcurement = hasRole(role, PROCUREMENT_ROLES);
  const isRequester = hasRole(role, REQUESTER_ROLES);
  const isConfirmer = hasRole(role, CONFIRMER_ROLES);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const promises: Promise<any>[] = [getRequests()];
        if (isAdmin || isWarehouse) {
          promises.push(getItems(), getRecentTransactions(60));
        } else if (isProcurement) {
          promises.push(getItems());
        }
        const results = await Promise.all(promises);
        if (!alive) return;

        const allReqs: InventoryRequest[] = results[0] || [];
        let filteredReqs = allReqs;
        if (profile && profile.role === ROLES.REQUEST_CONFIRMER && profile.faculty_id) {
          filteredReqs = allReqs.filter(r => r.faculty_id !== undefined && r.faculty_id !== null && String(r.faculty_id) === String(profile.faculty_id));
        }
        setRequests(filteredReqs);

        if (profile) {
          const mine = allReqs.filter(r =>
            r.requesterId === profile.uid || r.requesterName === profile.name
          );
          setMyRequests(mine);
        }

        if (isAdmin || isWarehouse) {
          setItems(results[1] || []);
          setTransactions(results[2] || []);
        } else if (isProcurement) {
          setItems(results[1] || []);
        }
      } catch (err) {
        console.warn("Dashboard load failed:", err);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [role]);

  const months = useMemo(() => getMonthNames(lang), [lang, calendarType]);

  const availableYears = useMemo(() => {
    const cur = getCurrentYear();
    const s = new Set<number>([cur]);
    transactions.forEach(tx => {
      if (tx.date) {
        const d = typeof tx.date === "number" ? new Date(tx.date) : new Date(String(tx.date));
        const y = getYearFromDate(d);
        if (y > 1200 && y <= cur + 1) s.add(y);
      }
    });
    return Array.from(s).sort((a, b) => b - a);
  }, [transactions, calendarType]);

  const [selectedYear, setSelectedYear] = useState<number>(() => getCurrentYear());
  useEffect(() => { setSelectedYear(getCurrentYear()); }, [calendarType]);

  const { inData, outData } = useMemo(
    () => buildMonthlyStockData(transactions, months, selectedYear, getYearFromDate, getMonthIndexFromDate),
    [transactions, selectedYear, months, calendarType]
  );

  // ── derived stats ──
  const totalValue = items.reduce((s, i) => s + (Number(i.currentQuantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const lowStock = items.filter(i => i.currentQuantity > 0 && i.currentQuantity <= i.minimumStockLevel).length;
  const outOfStock = items.filter(i => i.currentQuantity === 0).length;
  const pendingReqs = requests.filter(r => r.progress < 100).length;
  const completedReqs = requests.filter(r => r.progress >= 100).length;
  const myPending = myRequests.filter(r => r.progress < 100).length;
  const myCompleted = myRequests.filter(r => r.progress >= 100).length;
  const procurementReqs = requests.filter(r =>
    ["StockNotAvailable", "ProcurementPending", "TenderCreated", "OffersReceived",
     "ComparisonCreated", "WinnerSelected", "PurchaseOrderCreated"].includes(r.status)
  ).length;
  const pendingConfirmations = requests.filter(r => ["Submitted", "PendingReview"].includes(r.status)).length;
  const confirmedByMe = requests.filter(r => r.status === "ConfirmedByRequestConfirmer").length;

  const { labels: statusLabels, series: statusSeries } = buildRequestStatusData(
    isRequester ? myRequests : requests, lang
  );
  const { labels: catLabels, series: catSeries } = buildCategoryData(items);

  // ── chart options ──
  const stockBarOptions: ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit", background: "transparent",
      events: { dataPointSelection: (_e, _c, cfg) => {
        navigateRef.current(cfg.seriesIndex === 0 ? "/inventory/ledger?type=IN" : "/inventory/ledger?type=OUT");
      }},
    },
    plotOptions: { bar: { borderRadius: 6, columnWidth: "55%" } },
    dataLabels: { enabled: false },
    colors: ["#3b82f6", "#f97316"],
    xaxis: { categories: months, labels: { style: { fontFamily: "inherit", fontSize: "11px" } } },
    yaxis: { labels: { style: { fontFamily: "inherit" } } },
    legend: { position: "top", fontFamily: "inherit", labels: { colors: "#6b7280" } },
    grid: { borderColor: "#f3f4f6", strokeDashArray: 4 },
    tooltip: { theme: "light", style: { fontFamily: "inherit" } },
  };

  const stockBarSeries = [
    { name: pick("داخل", "ورودی"), data: inData },
    { name: pick("خارج", "خروجی"), data: outData },
  ];

  const requestDonutOptions: ApexOptions = {
    chart: { type: "donut", fontFamily: "inherit", background: "transparent",
      events: { dataPointSelection: () => { navigateRef.current("/requests"); } },
    },
    labels: statusLabels,
    colors: ["#10b981","#3b82f6","#8b5cf6","#f97316","#ef4444","#06b6d4","#f59e0b","#6366f1","#ec4899"],
    legend: { position: "bottom", fontFamily: "inherit", labels: { colors: "#6b7280" } },
    dataLabels: { style: { fontFamily: "inherit", fontSize: "11px" } },
    plotOptions: { pie: { donut: { size: "65%", labels: { show: true, total: { show: true, label: pick("ټول", "مجموع"), fontFamily: "inherit", color: "#374151" } } } } },
    tooltip: { theme: "light", style: { fontFamily: "inherit" } },
  };

  const categoryBarOptions: ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit", background: "transparent",
      events: { dataPointSelection: () => { navigateRef.current("/inventory/items"); } },
    },
    plotOptions: { bar: { borderRadius: 6, horizontal: true } },
    dataLabels: { enabled: true, style: { fontFamily: "inherit", fontSize: "11px" } },
    colors: ["#6366f1"],
    xaxis: { categories: catLabels, labels: { style: { fontFamily: "inherit", fontSize: "11px" } } },
    yaxis: { labels: { style: { fontFamily: "inherit", fontSize: "12px" } } },
    grid: { borderColor: "#f3f4f6", strokeDashArray: 4 },
    tooltip: { theme: "light", style: { fontFamily: "inherit" } },
  };

  const categoryBarSeries = [{ name: pick("مقدار", "مقدار"), data: catSeries }];

  // ── hero banner ──
  const HeroBanner = () => (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-white to-blue-50 p-6 dark:from-primary/20 dark:via-white/[0.03] dark:to-blue-900/10 dark:border-primary/30 animate-slide-down">
      <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-6 right-10 w-28 h-28 rounded-full bg-blue-400/10 blur-2xl pointer-events-none" />
      <h1 className="text-xl font-bold text-gray-800 dark:text-white/90 relative z-10">
        {pick("د کندهار پوهنتون د عمومي ګدام او تدارکاتو مدیریت سیستم", "سیستم مدیریت انبار و تدارکات پوهنتون کندهار")}
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 relative z-10">
        {pick("د موجودۍ، غوښتنو، تدارکاتو، ترلاسه کولو، تسلیمۍ او راپورونو لپاره یو واحد سیستم.", "یک سیستم واحد برای موجودی، درخواست‌ها، تدارکات، تحویل‌گیری و گزارش‌ها.")}
      </p>
      {profile && (
        <p className="mt-2 text-xs text-primary font-medium relative z-10">
          {pick("ښه راغلاست،", "خوش آمدید،")} <span className="font-bold">{profile.name}</span> — <span className="opacity-70">{profile.role}</span>
        </p>
      )}
      <div className="mt-3 relative z-10">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-white/70 dark:bg-white/5 px-3 py-1 text-xs font-medium text-primary dark:text-primary/80" dir="rtl">
          📅 {getCurrentDateString()} <span className="opacity-60">({calLabel})</span>
        </span>
      </div>
    </div>
  );

  const SkeletonCards = ({ count = 4 }: { count?: number }) => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]" style={staggerDelay(i)}>
          <div className="skeleton-shimmer h-6 w-8 rounded mb-3" />
          <div className="skeleton-shimmer h-3 w-20 rounded mb-2" />
          <div className="skeleton-shimmer h-7 w-14 rounded" />
        </div>
      ))}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SUPER ADMIN / ADMIN — full dashboard
  // ─────────────────────────────────────────────────────────────────────────
  if (isAdmin) {
    const adminCards = [
      { label: pick("ټول اجناس", "تمام اجناس"), value: items.length, to: "/inventory/items", color: "bg-blue-500", icon: "📦" },
      { label: pick("د موجودۍ ارزښت", "ارزش موجودی"), value: `${totalValue.toLocaleString()} ؋`, to: "/reports/inventory", color: "bg-green-500", icon: "💰" },
      { label: pick("کمه موجودي", "موجودی کم"), value: lowStock, to: "/inventory/items?filter=low", color: lowStock > 0 ? "bg-orange-500" : "bg-gray-400", icon: "⚠️" },
      { label: pick("ختم شوي اجناس", "اجناس تمام‌شده"), value: outOfStock, to: "/inventory/items?filter=out", color: outOfStock > 0 ? "bg-red-500" : "bg-gray-400", icon: "❌" },
      { label: pick("ټولې غوښتنې", "همه درخواست‌ها"), value: requests.length, to: "/requests", color: "bg-purple-500", icon: "📋" },
      { label: pick("پاتې غوښتنې", "درخواست‌های باقی‌مانده"), value: pendingReqs, to: "/requests?filter=pending", color: pendingReqs > 0 ? "bg-indigo-500" : "bg-gray-400", icon: "⏳" },
      { label: pick("بشپړې غوښتنې", "درخواست‌های تکمیل‌شده"), value: completedReqs, to: "/requests?filter=completed", color: "bg-teal-500", icon: "✅" },
      { label: pick("تدارکاتي غوښتنې", "درخواست‌های تدارکاتی"), value: procurementReqs, to: "/procurement", color: procurementReqs > 0 ? "bg-amber-500" : "bg-gray-400", icon: "🛒" },
    ];
    const adminModules = [
      { title: pick("موجودي", "موجودی"), desc: pick("د اجناسو ثبت او لیست", "ثبت و لیست اجناس"), to: "/inventory/items" },
      { title: pick("غوښتنې", "درخواست‌ها"), desc: pick("د اجناسو غوښتنه او تعقیب", "درخواست و پیگیری"), to: "/requests" },
      { title: pick("تدارکات", "تدارکات"), desc: pick("مراحل او پیشنهادونه", "مراحل تدارکاتی"), to: "/procurement" },
      { title: pick("ترلاسه کول", "تحویل‌گیری"), desc: pick("رسید او تسلیمي", "رسید و تحویل‌دهی"), to: "/receiving" },
      { title: pick("راپورونه", "گزارش‌ها"), desc: pick("موجودي، غوښتنې او وړاندوینې", "موجودی و درخواست‌ها"), to: "/reports" },
      { title: pick("کاروونکي", "کاربران"), desc: pick("د کاروونکو مدیریت", "مدیریت کاربران"), to: "/user-management" },
    ];

    return (
      <>
        <PageMeta title={pick("عمومي پاڼه", "داشبورد") + " | Kandahar University WMS"} description="" />
        <div className="space-y-6 page-enter" dir="rtl">
          <HeroBanner />

          {/* Stat cards */}
          {loading ? <SkeletonCards count={8} /> : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {adminCards.map((c, i) => <StatCard key={c.label} {...c} />)}
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <SectionCard className="xl:col-span-2" style={{ animationDelay: "150ms" } as any}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-gray-800 dark:text-white/90">{pick("د ګدام داخل / خارج", "ورودی / خروجی انبار")}</h2>
                  <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <Link to="/inventory/ledger" className="text-xs text-primary hover:underline">{pick("د راکړې ورکړې ثبت ←", "ثبت معاملات ←")}</Link>
              </div>
              {loading ? <div className="space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="skeleton-shimmer h-10 rounded-lg" />)}</div>
                : <ReactApexChart key={lang} options={stockBarOptions} series={stockBarSeries} type="bar" height={280} />}
            </SectionCard>

            <SectionCard style={{ animationDelay: "220ms" } as any}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 dark:text-white/90">{pick("د غوښتنو وضعیت", "وضعیت درخواست‌ها")}</h2>
                <Link to="/requests" className="text-xs text-primary hover:underline">{pick("ټولې ←", "همه ←")}</Link>
              </div>
              {loading ? <div className="flex items-center justify-center h-[280px]"><div className="skeleton-shimmer h-48 w-48 rounded-full" /></div>
                : requests.length === 0 ? <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">{pick("کومه غوښتنه نشته", "هیچ درخواستی وجود ندارد")}</div>
                : <ReactApexChart key={lang+"-donut"} options={requestDonutOptions} series={statusSeries} type="donut" height={280} />}
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <SectionCard style={{ animationDelay: "100ms" } as any}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 dark:text-white/90">{pick("د کټګورۍ موجودي", "موجودی بر اساس دسته‌بندی")}</h2>
                <Link to="/inventory/items" className="text-xs text-primary hover:underline">{pick("ټول اجناس ←", "همه اجناس ←")}</Link>
              </div>
              {loading ? <div className="space-y-2">{Array.from({length:4}).map((_,i)=><div key={i} className="skeleton-shimmer h-8 rounded-lg" />)}</div>
                : items.length === 0 ? <div className="flex items-center justify-center h-[240px] text-gray-400 text-sm">{pick("کوم جنس نشته", "هیچ جنسی وجود ندارد")}</div>
                : <ReactApexChart key={lang+"-cat"} options={categoryBarOptions} series={categoryBarSeries} type="bar" height={240} />}
            </SectionCard>

            <SectionCard style={{ animationDelay: "180ms" } as any}>
              <h2 className="mb-4 text-base font-bold text-gray-800 dark:text-white/90">{pick("د سیستم برخې", "بخش‌های سیستم")}</h2>
              <div className="grid grid-cols-1 gap-2">
                {adminModules.map((m, i) => (
                  <Link key={m.to} to={m.to} style={staggerDelay(i)}
                    className="group flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 card-interactive hover:border-primary hover:bg-primary/5 dark:border-gray-800 dark:hover:bg-white/[0.04]">
                    <h3 className="font-bold text-sm text-gray-800 dark:text-white/90 group-hover:text-primary transition-colors">{m.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.desc}</p>
                  </Link>
                ))}
              </div>
            </SectionCard>

            <SectionCard style={{ animationDelay: "240ms" } as any}>
              <h2 className="mb-4 text-base font-bold text-gray-800 dark:text-white/90">{pick("وروستي حرکات", "آخرین تراکنش‌ها")}</h2>
              <div className="space-y-2">
                {loading ? Array.from({length:5}).map((_,i)=><div key={i} className="skeleton-shimmer h-12 rounded-xl" style={staggerDelay(i)} />)
                  : transactions.length === 0
                    ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-white/[0.04] text-center">{pick("کوم حرکت نه دی ثبت شوی.", "هیچ تراکنشی ثبت نشده است.")}</p>
                    : transactions.slice(0, 8).map((tx, i) => (
                        <Link to="/inventory/ledger" key={tx.id || i} style={staggerDelay(i)}
                          className="flex items-center justify-between rounded-xl bg-gray-50 p-3 table-row-hover dark:bg-white/[0.04] dark:hover:bg-white/[0.07]">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{tx.itemName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{tx.quantity} {tx.unit}</p>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${tx.type === "IN" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                            {tx.type === "IN" ? pick("داخل","ورودی") : pick("خارج","خروجی")}
                          </span>
                        </Link>
                      ))
                }
              </div>
              {transactions.length > 0 && (
                <Link to="/inventory/ledger" className="mt-4 block text-center text-xs text-primary hover:underline">
                  {pick("ټول حرکات ←", "همه تراکنش‌ها ←")}
                </Link>
              )}
            </SectionCard>
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WAREHOUSE DIRECTOR / ENTRY PERSON — inventory-focused
  // ─────────────────────────────────────────────────────────────────────────
  if (isWarehouse) {
    const warehouseCards = [
      { label: pick("ټول اجناس", "تمام اجناس"), value: items.length, to: "/inventory/items", color: "bg-blue-500", icon: "📦" },
      { label: pick("کمه موجودي", "موجودی کم"), value: lowStock, to: "/inventory/items?filter=low", color: lowStock > 0 ? "bg-orange-500" : "bg-gray-400", icon: "⚠️" },
      { label: pick("ختم شوي اجناس", "اجناس تمام‌شده"), value: outOfStock, to: "/inventory/items?filter=out", color: outOfStock > 0 ? "bg-red-500" : "bg-gray-400", icon: "❌" },
      { label: pick("د موجودۍ ارزښت", "ارزش موجودی"), value: `${totalValue.toLocaleString()} ؋`, to: "/reports/inventory", color: "bg-green-500", icon: "💰" },
    ];
    return (
      <>
        <PageMeta title={pick("د ګدام ډشبورډ", "داشبورد انبار") + " | Kandahar University WMS"} description="" />
        <div className="space-y-6 page-enter" dir="rtl">
          <HeroBanner />
          {loading ? <SkeletonCards count={4} /> : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {warehouseCards.map(c => <StatCard key={c.label} {...c} />)}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <SectionCard className="xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-gray-800 dark:text-white/90">{pick("د ګدام داخل / خارج", "ورودی / خروجی انبار")}</h2>
                  <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <Link to="/inventory/ledger" className="text-xs text-primary hover:underline">{pick("د راکړې ورکړې ثبت ←", "ثبت معاملات ←")}</Link>
              </div>
              {loading ? <div className="space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="skeleton-shimmer h-10 rounded-lg" />)}</div>
                : <ReactApexChart key={lang} options={stockBarOptions} series={stockBarSeries} type="bar" height={280} />}
            </SectionCard>
            <SectionCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 dark:text-white/90">{pick("د کټګورۍ موجودي", "موجودی بر اساس دسته‌بندی")}</h2>
                <Link to="/inventory/items" className="text-xs text-primary hover:underline">{pick("ټول ←", "همه ←")}</Link>
              </div>
              {loading ? <div className="space-y-2">{Array.from({length:4}).map((_,i)=><div key={i} className="skeleton-shimmer h-8 rounded-lg" />)}</div>
                : items.length === 0 ? <div className="flex items-center justify-center h-[240px] text-gray-400 text-sm">{pick("کوم جنس نشته", "هیچ جنسی وجود ندارد")}</div>
                : <ReactApexChart key={lang+"-cat"} options={categoryBarOptions} series={categoryBarSeries} type="bar" height={240} />}
            </SectionCard>
          </div>
          <SectionCard>
            <h2 className="mb-4 text-base font-bold text-gray-800 dark:text-white/90">{pick("وروستي حرکات", "آخرین تراکنش‌ها")}</h2>
            <div className="space-y-2">
              {loading ? Array.from({length:5}).map((_,i)=><div key={i} className="skeleton-shimmer h-12 rounded-xl" style={staggerDelay(i)} />)
                : transactions.length === 0
                  ? <p className="text-sm text-gray-400 text-center py-6">{pick("کوم حرکت نه دی ثبت شوی.", "هیچ تراکنشی ثبت نشده است.")}</p>
                  : transactions.slice(0, 10).map((tx, i) => (
                      <Link to="/inventory/ledger" key={tx.id || i} style={staggerDelay(i)}
                        className="flex items-center justify-between rounded-xl bg-gray-50 p-3 table-row-hover dark:bg-white/[0.04] dark:hover:bg-white/[0.07]">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{tx.itemName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{tx.quantity} {tx.unit}</p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${tx.type === "IN" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                          {tx.type === "IN" ? pick("داخل","ورودی") : pick("خارج","خروجی")}
                        </span>
                      </Link>
                    ))
              }
            </div>
            {transactions.length > 0 && <Link to="/inventory/ledger" className="mt-4 block text-center text-xs text-primary hover:underline">{pick("ټول حرکات ←", "همه تراکنش‌ها ←")}</Link>}
          </SectionCard>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { title: pick("د اجناسو لیست", "لیست اجناس"), desc: pick("د ټولو اجناسو لیست", "لیست همه اجناس"), to: "/inventory/items", icon: "📦" },
              { title: pick("د ترلاسه کول", "تحویل‌گیری"), desc: pick("رسید او تسلیمي", "رسید و تحویل‌دهی"), to: "/receiving", icon: "📥" },
              { title: pick("رسمي فورمونه", "فرم‌های رسمی"), desc: pick("ف.س.۵ او نور", "فرم‌های رسمی"), to: "/official-forms", icon: "📄" },
            ].map((m, i) => (
              <Link key={m.to} to={m.to} style={staggerDelay(i)}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 card-interactive hover:border-primary hover:bg-primary/5 dark:border-gray-800">
                <span className="text-2xl">{m.icon}</span>
                <div>
                  <h3 className="font-bold text-sm text-gray-800 dark:text-white/90 group-hover:text-primary transition-colors">{m.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{m.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROCUREMENT DIRECTOR — procurement-focused
  // ─────────────────────────────────────────────────────────────────────────
  if (isProcurement) {
    const tenderReqs = requests.filter(r => ["TenderCreated","OffersReceived","ComparisonCreated","WinnerSelected","PurchaseOrderCreated"].includes(r.status));
    const procCards = [
      { label: pick("تدارکاتي غوښتنې", "درخواست‌های تدارکاتی"), value: procurementReqs, to: "/procurement", color: "bg-amber-500", icon: "🛒" },
      { label: pick("داوطلبي مرحله", "مرحله مناقصه"), value: tenderReqs.length, to: "/procurement", color: tenderReqs.length > 0 ? "bg-blue-500" : "bg-gray-400", icon: "📊" },
      { label: pick("پاتې غوښتنې", "درخواست‌های باقی"), value: pendingReqs, to: "/requests", color: pendingReqs > 0 ? "bg-indigo-500" : "bg-gray-400", icon: "⏳" },
      { label: pick("بشپړې غوښتنې", "تکمیل‌شده‌ها"), value: completedReqs, to: "/requests?filter=completed", color: "bg-teal-500", icon: "✅" },
    ];
    return (
      <>
        <PageMeta title={pick("د تدارکاتو ډشبورډ", "داشبورد تدارکات") + " | Kandahar University WMS"} description="" />
        <div className="space-y-6 page-enter" dir="rtl">
          <HeroBanner />
          {loading ? <SkeletonCards count={4} /> : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {procCards.map(c => <StatCard key={c.label} {...c} />)}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 dark:text-white/90">{pick("د تدارکاتي غوښتنو وضعیت", "وضعیت درخواست‌های تدارکاتی")}</h2>
                <Link to="/procurement" className="text-xs text-primary hover:underline">{pick("ټولې ←", "همه ←")}</Link>
              </div>
              {loading ? <div className="flex items-center justify-center h-[280px]"><div className="skeleton-shimmer h-48 w-48 rounded-full" /></div>
                : requests.length === 0 ? <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">{pick("کومه غوښتنه نشته", "هیچ درخواستی وجود ندارد")}</div>
                : <ReactApexChart key={lang+"-donut"} options={requestDonutOptions} series={statusSeries} type="donut" height={280} />}
            </SectionCard>
            <SectionCard>
              <h2 className="mb-4 text-base font-bold text-gray-800 dark:text-white/90">{pick("د تدارکاتو وروستي غوښتنې", "آخرین درخواست‌های تدارکاتی")}</h2>
              <div className="space-y-2">
                {loading ? Array.from({length:5}).map((_,i)=><div key={i} className="skeleton-shimmer h-14 rounded-xl" style={staggerDelay(i)} />)
                  : requests.filter(r => !["Submitted","ConfirmedByRequestConfirmer","ApprovedBySuperAdmin","StockAvailable","Delivered"].includes(r.status)).slice(0,8).map((req, i) => (
                      <Link to="/procurement" key={req.id} style={staggerDelay(i)}
                        className="flex items-center justify-between rounded-xl border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5 transition-colors">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-800 dark:text-white/90 truncate max-w-[160px]">{req.requesterName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{req.faculty}</p>
                        </div>
                        <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">{req.status}</span>
                      </Link>
                    ))
                }
              </div>
              <Link to="/procurement" className="mt-4 block text-center text-xs text-primary hover:underline">{pick("ټولې تدارکاتي غوښتنې ←", "همه درخواست‌های تدارکاتی ←")}</Link>
            </SectionCard>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { title: pick("تدارکات", "تدارکات"), desc: pick("د تدارکاتو مراحل", "مراحل تدارکاتی"), to: "/procurement", icon: "🛒" },
              { title: pick("د شرکتانو وړاندیزونه", "پیشنهادات شرکت‌ها"), desc: pick("د شرکتانو مقایسه", "مقایسه پیشنهادات"), to: "/procurement/vendor-offers", icon: "📊" },
              { title: pick("راپورونه", "گزارش‌ها"), desc: pick("د تدارکاتو راپور", "گزارش تدارکات"), to: "/reports/procurement", icon: "📈" },
            ].map((m, i) => (
              <Link key={m.to} to={m.to} style={staggerDelay(i)}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 card-interactive hover:border-primary hover:bg-primary/5 dark:border-gray-800">
                <span className="text-2xl">{m.icon}</span>
                <div>
                  <h3 className="font-bold text-sm text-gray-800 dark:text-white/90 group-hover:text-primary transition-colors">{m.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{m.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REQUESTER — my requests only
  // ─────────────────────────────────────────────────────────────────────────
  if (isRequester) {
    const reqCards = [
      { label: pick("زما ټولې غوښتنې", "همه درخواست‌های من"), value: myRequests.length, to: "/requests", color: "bg-purple-500", icon: "📋" },
      { label: pick("پاتې غوښتنې", "درخواست‌های باقی"), value: myPending, to: "/requests?filter=pending", color: myPending > 0 ? "bg-indigo-500" : "bg-gray-400", icon: "⏳" },
      { label: pick("بشپړې غوښتنې", "درخواست‌های تکمیل‌شده"), value: myCompleted, to: "/requests?filter=completed", color: "bg-teal-500", icon: "✅" },
    ];
    return (
      <>
        <PageMeta title={pick("زما ډشبورډ", "داشبورد من") + " | Kandahar University WMS"} description="" />
        <div className="space-y-6 page-enter" dir="rtl">
          <HeroBanner />
          {loading ? <SkeletonCards count={3} /> : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {reqCards.map(c => <StatCard key={c.label} {...c} />)}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 dark:text-white/90">{pick("زما د غوښتنو وضعیت", "وضعیت درخواست‌های من")}</h2>
                <Link to="/requests" className="text-xs text-primary hover:underline">{pick("ټولې ←", "همه ←")}</Link>
              </div>
              {loading ? <div className="flex items-center justify-center h-[260px]"><div className="skeleton-shimmer h-40 w-40 rounded-full" /></div>
                : myRequests.length === 0 ? <div className="flex flex-col items-center justify-center h-[260px] gap-2 text-gray-400"><span className="text-4xl">📋</span><p className="text-sm">{pick("کومه غوښتنه نشته", "هیچ درخواستی وجود ندارد")}</p></div>
                : <ReactApexChart key={lang+"-donut"} options={requestDonutOptions} series={statusSeries} type="donut" height={260} />}
            </SectionCard>
            <SectionCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 dark:text-white/90">{pick("زما وروستي غوښتنې", "آخرین درخواست‌های من")}</h2>
                <Link to="/requests" className="text-xs text-primary hover:underline">{pick("ټولې ←", "همه ←")}</Link>
              </div>
              <div className="space-y-2">
                {loading ? Array.from({length:5}).map((_,i)=><div key={i} className="skeleton-shimmer h-14 rounded-xl" style={staggerDelay(i)} />)
                  : myRequests.length === 0
                    ? <div className="text-center py-8"><span className="text-4xl">📬</span><p className="text-sm text-gray-400 mt-2">{pick("لا کومه غوښتنه نه ده ثبت شوې", "هنوز درخواستی ثبت نشده است")}</p>
                        <Link to="/requests" className="mt-3 inline-block text-xs text-primary hover:underline">{pick("د لومړۍ غوښتنې ثبت کول ←", "ثبت اولین درخواست ←")}</Link>
                      </div>
                    : myRequests.slice(0, 6).map((req, i) => (
                        <Link to="/requests" key={req.id} style={staggerDelay(i)}
                          className="flex items-center justify-between rounded-xl border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5 transition-colors">
                          <div className="text-right">
                            <p className="text-xs text-gray-500 dark:text-gray-400">{req.faculty}{req.departmentOrPerson ? ` — ${req.departmentOrPerson}` : ""}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500">{req.currentRequestLevel}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            req.progress >= 100 ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
                              : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                          }`}>{req.progress >= 100 ? pick("بشپړه", "تکمیل") : pick("روان", "در جریان")}</span>
                        </Link>
                      ))
                }
              </div>
            </SectionCard>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { title: pick("نوې غوښتنه ثبت کول", "ثبت درخواست جدید"), desc: pick("د اجناسو غوښتنه", "درخواست اجناس"), to: "/requests/create", icon: "➕" },
              { title: pick("زما غوښتنې", "درخواست‌های من"), desc: pick("د غوښتنو تعقیب", "پیگیری درخواست‌ها"), to: "/requests", icon: "📋" },
            ].map((m, i) => (
              <Link key={m.to + i} to={m.to} style={staggerDelay(i)}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-4 card-interactive hover:border-primary hover:bg-primary/5 dark:border-gray-800">
                <span className="text-3xl">{m.icon}</span>
                <div>
                  <h3 className="font-bold text-sm text-gray-800 dark:text-white/90 group-hover:text-primary transition-colors">{m.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{m.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REQUEST CONFIRMER — confirmations-focused
  // ─────────────────────────────────────────────────────────────────────────
  if (isConfirmer) {
    const confirmCards = [
      { label: pick("د تایید لپاره غوښتنې", "درخواست‌های نیاز به تأیید"), value: pendingConfirmations, to: "/requests", color: pendingConfirmations > 0 ? "bg-orange-500" : "bg-gray-400", icon: "🔔" },
      { label: pick("تاییدي غوښتنې", "درخواست‌های تأییدشده"), value: confirmedByMe, to: "/requests", color: "bg-teal-500", icon: "✅" },
      { label: pick("ټولې غوښتنې", "همه درخواست‌ها"), value: requests.length, to: "/requests", color: "bg-purple-500", icon: "📋" },
    ];
    return (
      <>
        <PageMeta title={pick("د تایید ډشبورډ", "داشبورد تأیید") + " | Kandahar University WMS"} description="" />
        <div className="space-y-6 page-enter" dir="rtl">
          <HeroBanner />
          {loading ? <SkeletonCards count={3} /> : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {confirmCards.map(c => <StatCard key={c.label} {...c} />)}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 dark:text-white/90">{pick("د تایید انتظار غوښتنې", "درخواست‌های منتظر تأیید")}</h2>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pendingConfirmations > 0 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>{pendingConfirmations}</span>
              </div>
              <div className="space-y-2">
                {loading ? Array.from({length:5}).map((_,i)=><div key={i} className="skeleton-shimmer h-14 rounded-xl" style={staggerDelay(i)} />)
                  : requests.filter(r => r.status === "Submitted").length === 0
                    ? <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400"><span className="text-4xl">✅</span><p className="text-sm">{pick("ټولې غوښتنې تایید شوي", "همه درخواست‌ها تأیید شده‌اند")}</p></div>
                    : requests.filter(r => r.status === "Submitted").slice(0, 8).map((req, i) => (
                        <Link to="/requests" key={req.id} style={staggerDelay(i)}
                          className="flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50 p-3 hover:bg-orange-100 dark:bg-orange-900/20 dark:border-orange-800/40 dark:hover:bg-orange-900/30 transition-colors">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{req.requesterName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{req.faculty}{req.departmentOrPerson ? ` — ${req.departmentOrPerson}` : ""}</p>
                          </div>
                          <span className="text-xs bg-orange-200 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200 px-2 py-0.5 rounded-full font-bold shrink-0">
                            {pick("تایید ته اړتیا", "نیاز به تأیید")}
                          </span>
                        </Link>
                      ))
                }
              </div>
            </SectionCard>
            <SectionCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 dark:text-white/90">{pick("د غوښتنو وضعیت", "وضعیت درخواست‌ها")}</h2>
                <Link to="/requests" className="text-xs text-primary hover:underline">{pick("ټولې ←", "همه ←")}</Link>
              </div>
              {loading ? <div className="flex items-center justify-center h-[260px]"><div className="skeleton-shimmer h-40 w-40 rounded-full" /></div>
                : requests.length === 0 ? <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">{pick("کومه غوښتنه نشته", "هیچ درخواستی وجود ندارد")}</div>
                : <ReactApexChart key={lang+"-donut"} options={requestDonutOptions} series={statusSeries} type="donut" height={260} />}
            </SectionCard>
          </div>
          <Link to="/requests"
            className="group flex items-center gap-4 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 p-5 hover:bg-orange-100 dark:bg-orange-900/10 dark:border-orange-800/40 dark:hover:bg-orange-900/20 transition-colors">
            <span className="text-3xl">🔔</span>
            <div>
              <h3 className="font-bold text-base text-gray-800 dark:text-white/90 group-hover:text-primary transition-colors">{pick("د غوښتنو تایید ته لاړ شئ", "برای تأیید درخواست‌ها بروید")}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{pendingConfirmations > 0 ? pick(`${pendingConfirmations} غوښتنې د تایید انتظار کوي`, `${pendingConfirmations} درخواست منتظر تأیید است`) : pick("اوس مهال هیڅ غوښتنه نشته", "در حال حاضر هیچ درخواستی نیست")}</p>
            </div>
            <span className="mr-auto text-primary text-lg">←</span>
          </Link>
        </div>
      </>
    );
  }

  // ─── fallback (unknown role or loading) ───────────────────────────────────
  return (
    <>
      <PageMeta title="Kandahar University WMS" description="" />
      <div className="space-y-6 page-enter" dir="rtl">
        <HeroBanner />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <span className="text-5xl">⏳</span>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{pick("مهرباني وکړئ انتظار وکړئ...", "لطفاً صبر کنید...")}</p>
          </div>
        </div>
      </div>
    </>
  );
}
