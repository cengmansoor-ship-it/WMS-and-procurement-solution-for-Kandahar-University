import { useEffect, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getItems } from "../../firebase/inventory";
import { useCalendar } from "../../context/CalendarContext";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";

export default function InventoryDashboard() {
  const { getCurrentDateString, calendarType } = useCalendar();
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalItems: 0,
    totalQuantity: 0,
    totalValue: 0,
    lowStock: 0,
    outOfStock: 0,
    totalCategories: 0,
    totalUnits: 0,
  });
  const [loading, setLoading] = useState(true);
  const calLabel = calendarType === "shamsi" ? "شمسي" : calendarType === "qamari" ? "قمري" : "میلادي";

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const items = await getItems();
      const cats = new Set<string>();
      const units = new Set<string>();
      const summary = items.reduce(
        (acc: { totalItems: number; totalQuantity: number; totalValue: number; outOfStock: number; lowStock: number }, item: { currentQuantity: number; minimumStockLevel: number; unitPrice: number; category?: string; unit?: string }) => {
          acc.totalItems++;
          acc.totalQuantity += Number(item.currentQuantity) || 0;
          acc.totalValue += (Number(item.currentQuantity) || 0) * (Number(item.unitPrice) || 0);
          if (Number(item.currentQuantity) === 0) acc.outOfStock++;
          else if (Number(item.currentQuantity) <= Number(item.minimumStockLevel)) acc.lowStock++;
          if (item.category) cats.add(item.category);
          if (item.unit) units.add(item.unit);
          return acc;
        },
        { totalItems: 0, totalQuantity: 0, totalValue: 0, lowStock: 0, outOfStock: 0 }
      );
      setStats({ ...summary, totalCategories: cats.size, totalUnits: units.size });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      title: "ټول اجناس",
      value: stats.totalItems,
      colorClass: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
      to: "/inventory/items",
      icon: (
        <svg className="fill-current" width="22" height="22" viewBox="0 0 24 24">
          <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.39 7.8 12 11.41 4.61 7.8 12 4.18zM4 17.5V9.41l7 3.5v8.09l-7-3.5zm9 3.5V12.91l7-3.5v8.09l-7 3.5z" />
        </svg>
      ),
    },
    {
      title: "ټول کټګورۍ",
      value: stats.totalCategories,
      colorClass: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
      to: "/inventory/items?filter=cat",
      icon: (
        <svg className="fill-current" width="22" height="22" viewBox="0 0 24 24">
          <path d="M12 2l-5.5 9h11L12 2zm0 3.84L14.6 10h-5.2L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5S15.01 22 17.5 22s4.5-2.01 4.5-4.5S19.99 13 17.5 13zm0 7a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z"/>
        </svg>
      ),
    },
    {
      title: "ټول واحدونه",
      value: stats.totalUnits,
      colorClass: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
      to: "/inventory/items?filter=unit",
      icon: (
        <svg className="fill-current" width="22" height="22" viewBox="0 0 24 24">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/>
        </svg>
      ),
    },
    {
      title: "ټوله موجوده اندازه",
      value: stats.totalQuantity.toLocaleString(),
      colorClass: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
      to: "/inventory/ledger",
      icon: (
        <svg className="fill-current" width="22" height="22" viewBox="0 0 24 24">
          <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
        </svg>
      ),
    },
    {
      title: "ټول ارزښت",
      value: `${stats.totalValue.toLocaleString()} ؋`,
      colorClass: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
      to: "/reports/inventory",
      icon: (
        <svg className="fill-current" width="22" height="22" viewBox="0 0 24 24">
          <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
        </svg>
      ),
    },
    {
      title: "کمه موجودي",
      value: stats.lowStock,
      colorClass: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
      to: "/inventory/items?filter=low",
      alert: stats.lowStock > 0,
      icon: (
        <svg className="fill-current" width="22" height="22" viewBox="0 0 24 24">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
        </svg>
      ),
    },
    {
      title: "ختم شوي اجناس",
      value: stats.outOfStock,
      colorClass: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
      to: "/inventory/items?filter=out",
      alert: stats.outOfStock > 0,
      icon: (
        <svg className="fill-current" width="22" height="22" viewBox="0 0 24 24">
          <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
        </svg>
      ),
    },
  ];

  const staggerDelay = (i: number) => ({ animationDelay: `${i * 70}ms` });
  const quickActions = [
    {
      to: "/inventory/add",
      icon: "➕",
      label: "جنس اضافه کول",
      hover: "hover:border-primary hover:bg-primary/5",
      roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_ENTRY_PERSON, ROLES.WAREHOUSE_DIRECTOR],
    },
    {
      to: "/inventory/stock-in",
      icon: "📥",
      label: "د ګدام داخل",
      hover: "hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20",
      roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_ENTRY_PERSON, ROLES.WAREHOUSE_DIRECTOR],
    },
    {
      to: "/inventory/stock-out",
      icon: "📤",
      label: "د ګدام خارج",
      hover: "hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20",
      roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR],
    },
    {
      to: "/inventory/returns",
      icon: "↩️",
      label: "د اجناسو واپسي",
      hover: "hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20",
      roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR],
    },
    {
      to: "/inventory/ledger",
      icon: "📊",
      label: "د موجودۍ کهاته",
      hover: "hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20",
      roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR],
    },
  ].filter(action => profile?.role && action.roles.some(role => role === profile.role));

  return (
    <>
      <PageMeta title="د ګودام عمومي پاڼه | Kandahar University WMS" description="د موجودي عمومي ارقام" />
      <Breadcrumb pageTitle="د موجودۍ ډشبورډ / داشبورد موجودی" />

      <div className="space-y-6 page-enter">
        {/* Date badge */}
        <div className="flex justify-end" dir="rtl">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary dark:border-primary/30 dark:bg-primary/10">
            📅 {getCurrentDateString()} <span className="opacity-60">({calLabel})</span>
          </span>
        </div>
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          {loading
            ? Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]" style={staggerDelay(i)}>
                  <div className="skeleton-shimmer h-10 w-10 rounded-xl mb-3" />
                  <div className="skeleton-shimmer h-3 w-20 rounded mb-2" />
                  <div className="skeleton-shimmer h-7 w-14 rounded" />
                </div>
              ))
            : cards.map((card, i) => (
                <Link
                  key={card.title}
                  to={card.to}
                  className={`group rounded-2xl border bg-white p-5 shadow-sm card-interactive hover:shadow-xl dark:bg-white/[0.03] stat-card-load transition-all duration-300 ${
                    (card as { alert?: boolean }).alert
                      ? "border-red-200 hover:border-red-400 dark:border-red-800/50"
                      : "border-gray-200 hover:border-primary/30 dark:border-gray-800"
                  }`}
                  style={staggerDelay(i)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.colorClass} transition-transform group-hover:scale-110 duration-300`}>
                      {card.icon}
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.title}</span>
                  <h4 className="mt-1 text-xl font-bold text-gray-800 dark:text-white/90 group-hover:text-primary transition-colors">{card.value}</h4>
                </Link>
              ))
          }
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-slide-up" style={{ animationDelay: '500ms' }}>
          <h2 className="mb-4 text-lg font-bold text-gray-800 dark:text-white/90" dir="rtl">چټکې عملیات</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" dir="rtl">
            {quickActions.map((action, i) => (
              <Link key={action.to} to={action.to}
                className={`group flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4 card-interactive ${action.hover} dark:border-gray-700 animate-scale-in`}
                style={staggerDelay(i)}>
                <span className="text-2xl transition-transform group-hover:scale-125 duration-300">{action.icon}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
