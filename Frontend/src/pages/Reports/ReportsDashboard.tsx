import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getReportSummary } from "../../firebase/reports";
import { Link } from "react-router";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

export default function ReportsDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    const data = await getReportSummary();
    setStats(data);
    setLoading(false);
  };

  const cards = [
    { label: "ټول اجناس", value: stats?.totalItems, sub: "قلمه", color: "bg-blue-500", path: "/reports/inventory" },
    { label: "مجموعي ارزښت", value: stats?.totalValue != null ? `${stats.totalValue.toLocaleString()} AFN` : "—", sub: "افغانۍ", color: "bg-green-500", path: "/reports/inventory" },
    { label: "کمه موجودي", value: stats?.lowStockCount, sub: "قلمه", color: "bg-orange-500", path: "/reports/inventory" },
    { label: "ټولې غوښتنې", value: stats?.totalRequests, sub: "درخواستونه", color: "bg-purple-500", path: "/reports/requests" },
    { label: "جاري غوښتنې", value: stats?.pendingRequests, sub: "د کار لاندې", color: "bg-indigo-500", path: "/reports/requests" },
    { label: "تدارکاتي لګښت", value: stats?.totalProcurementCost != null ? `${stats.totalProcurementCost.toLocaleString()} AFN` : "—", sub: "ټول لګښت", color: "bg-red-500", path: "/reports/procurement" },
    { label: "سپارل شوي اجناس", value: stats?.totalAssignedItems, sub: "قلمه", color: "bg-teal-500", path: "/reports/delivery" },
    { label: "میاشتنی وتل (OUT)", value: stats?.monthlyStockOut, sub: "تغیر", color: "bg-gray-700", path: "/reports/movement" },
  ];

  const quickLinks = [
    { name: "د موجودۍ راپور", path: "/reports/inventory" },
    { name: "د حرکت راپور", path: "/reports/movement" },
    { name: "د غوښتنو تحلیل", path: "/reports/requests" },
    { name: "تدارکاتي تحلیل", path: "/reports/procurement" },
    { name: "د سپارلو کهاته", path: "/reports/delivery" },
    { name: "د اجناسو د واپسي راپور او کهاته", path: "/reports/returns" },
    { name: "کلنۍ اړتیاوې", path: "/reports/needs" },
    { name: "د وړاندوینې راپور", path: "/reports/forecast" },
    { name: "د فعالیتونو لړۍ", path: "/reports/audit" },
  ];

  return (
    <>
      <PageMeta title="د راپورونو ډاشبورډ | Kandahar University WMS" description="د سیسټم عمومي راپورونه او تحلیل" />
      <Breadcrumb pageTitle="د راپورونو عمومي پاڼه / داشبورد گزارش‌ها" />

      <div className="space-y-6 page-enter">

        {/* Date badge */}
        <div className="flex justify-end" dir="rtl">
          <CurrentDateBadge />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i}
                  className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] flex flex-col items-center gap-3"
                  style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="skeleton-shimmer h-12 w-12 rounded-xl" />
                  <div className="skeleton-shimmer h-3 w-20 rounded" />
                  <div className="skeleton-shimmer h-6 w-16 rounded" />
                </div>
              ))
            : cards.map((card, idx) => (
                <Link key={idx} to={card.path}
                  className="group p-6 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl card-interactive hover:shadow-xl flex flex-col items-center text-center stat-card-load"
                  style={{ animationDelay: `${idx * 60}ms` }}>
                  <div className={`w-12 h-12 ${card.color} rounded-xl mb-4 flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">{card.label}</h4>
                  <div className="text-xl font-black text-gray-800 dark:text-white/90 group-hover:text-primary transition-colors">{card.value ?? "—"}</div>
                  <span className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wide">{card.sub}</span>
                </Link>
              ))
          }
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Quick Links */}
          <div className="p-6 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl animate-slide-up" style={{ animationDelay: "200ms" }}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">تخصصي راپورونه</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickLinks.map((l, i) => (
                <Link key={i} to={l.path}
                  className="group px-4 py-3 bg-gray-50 dark:bg-white/5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-primary hover:text-white transition-all card-interactive animate-fade-in"
                  style={{ animationDelay: `${250 + i * 50}ms` }}>
                  <span className="group-hover:translate-x-1 inline-block transition-transform">{l.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Analysis Box */}
          <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col justify-center items-center text-center animate-scale-in" style={{ animationDelay: "300ms" }}>
            <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mb-4 text-2xl shadow-xl animate-bounce-gentle">💡</div>
            <h3 className="text-xl font-bold text-primary mb-2">د وړاندوینې او تحلیل برخه</h3>
            <p className="text-sm text-primary/70 leading-relaxed max-w-sm">
              دا سیسټم د تیرې یوې میاشتې ډاټا په اساس ستاسو د راتلونکي کال احتمالي اړتیاوې په اتوماتیک ډول محاسبه کوي. مهرباني وکړئ د کلنۍ اړتیاوو برخې ته سر ورښکاره کړئ.
            </p>
            <Link to="/reports/needs" className="mt-4 px-6 py-2.5 bg-primary text-gray-900 font-bold rounded-xl hover:bg-primary/90 transition shadow-lg btn-press">
              تحلیل کتل
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
