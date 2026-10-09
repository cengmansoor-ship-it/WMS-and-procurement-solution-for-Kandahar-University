import { useLocation, Link, Outlet } from "react-router";
import { useLanguage } from "../context/LanguageContext";

const settingsTabs = [
  { ps: "کاروونکي", dr: "کاربران", path: "/user-management" },
  { ps: "صلاحیتونه", dr: "دسترسی‌ها", path: "/role-management" },
  { ps: "سیستم تنظیمات", dr: "تنظیمات سیستم", path: "/settings" },
  { ps: "بودجه", dr: "بودجه", path: "/settings/budget-codes" },
  { ps: "حذف شوي", dr: "حذف‌شده‌ها", path: "/maintenance/trash" },
  { ps: "بیکپ", dr: "پشتیبان‌گیری", path: "/maintenance/backup" },
  { ps: "بیا رغونه", dr: "بازیابی", path: "/maintenance/recovery-history" },
  { ps: "روغتیا", dr: "سلامت", path: "/maintenance/health" },
  { ps: "وروستی کتنه", dr: "بررسی نهایی", path: "/maintenance/final-qa" },
];

export default function SettingsLayout() {
  const location = useLocation();
  const { pick } = useLanguage();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div dir="rtl">
      <div className="mb-6 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 pt-1 border-b border-gray-200 dark:border-gray-700">
          <div className="flex overflow-x-auto gap-0.5 custom-scrollbar [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgba(0,0,0,0.2)_transparent]">
            {settingsTabs.map((tab) => (
              <Link
                key={tab.path}
                to={tab.path}
                className={`whitespace-nowrap px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-200 shrink-0
                  ${isActive(tab.path)
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
