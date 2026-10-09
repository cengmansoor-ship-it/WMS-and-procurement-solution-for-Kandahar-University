import { useLocation, Link, Outlet } from "react-router";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../constants/roles";
import { useLanguage } from "../context/LanguageContext";

interface ReportTab {
  ps: string;
  dr: string;
  path: string;
  exact?: boolean;
  roles?: string[];
}

const reportTabs: ReportTab[] = [
  { ps: "عمومي پاڼه", dr: "داشبورد", path: "/reports", exact: true },
  { ps: "موجودي", dr: "موجودی", path: "/reports/inventory", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR] },
  { ps: "حرکت", dr: "حرکت", path: "/reports/movement", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR] },
  { ps: "غوښتنې", dr: "درخواست‌ها", path: "/reports/requests", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN] },
  { ps: "تدارکات", dr: "تدارکات", path: "/reports/procurement", roles: [ROLES.SUPER_ADMIN, ROLES.PROCUREMENT_DIRECTOR] },
  { ps: "ترلاسه کول", dr: "تحویل", path: "/reports/delivery", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR] },
  { ps: "واپسي", dr: "برگشت", path: "/reports/returns", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR] },
  { ps: "پوهنځي", dr: "دانشکده", path: "/reports/faculty", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR] },
  { ps: "ریاست", dr: "ریاست", path: "/reports/department", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR] },
  { ps: "کسان", dr: "اشخاص", path: "/reports/person-assignment", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR] },
  { ps: "کلنۍ اړتیاوې", dr: "نیازها", path: "/reports/needs", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN] },
  { ps: "وړاندوینه", dr: "پیش‌بینی", path: "/reports/forecast", roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN] },
  { ps: "فعالیتونه", dr: "فعالیت‌ها", path: "/reports/audit", roles: [ROLES.SUPER_ADMIN] },
];

export default function ReportsLayout() {
  const location = useLocation();
  const { profile } = useAuth();
  const { pick } = useLanguage();

  const visibleTabs = reportTabs.filter(
    (tab) => !tab.roles || (profile?.role && tab.roles.includes(profile.role))
  );

  const isActive = (tab: ReportTab) =>
    tab.exact ? location.pathname === tab.path : location.pathname === tab.path;

  return (
    <div dir="rtl">
      <div className="no-print mb-6 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 pt-1 border-b border-gray-200 dark:border-gray-700">
          <div className="flex overflow-x-auto gap-0.5 custom-scrollbar [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgba(0,0,0,0.2)_transparent]">
            {visibleTabs.map((tab) => (
              <Link
                key={tab.path}
                to={tab.path}
                className={`whitespace-nowrap px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-200 shrink-0
                  ${isActive(tab)
                    ? "border-primary text-primary bg-primary/5 dark:bg-primary/10 rounded-t-lg"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-t-lg"
                  }`}
              >
                {pick(tab.ps, tab.dr)}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
