import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";

export default function NotFound() {
  return (
    <>
      <PageMeta
        title="404 | Kandahar University WMS"
        description="د پاڼې خطا"
      />
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden z-1 bg-white dark:bg-gray-900">
        <div className="mx-auto w-full max-w-[320px] text-center sm:max-w-[472px]" dir="rtl">
          <div className="mb-6 flex items-center justify-center">
            <span className="text-8xl font-bold text-brand-600 dark:text-brand-400">۴۰۴</span>
          </div>

          <div className="mb-4 flex items-center justify-center">
            <span className="text-6xl">🔍</span>
          </div>

          <h1 className="mb-4 text-2xl font-bold text-gray-800 dark:text-white/90 sm:text-3xl">
            پاڼه ونه موندله شوه
          </h1>
          <p className="mb-2 text-base text-gray-600 dark:text-gray-400">
            صفحه مورد نظر پیدا نشد
          </p>

          <p className="mt-4 mb-8 text-sm text-gray-500 dark:text-gray-500">
            هغه پاڼه چې تاسې یې لټوئ شتون نه لري یا لیږدول شوې ده.<br />
            <span className="text-xs">صفحه‌ای که دنبالش هستید وجود ندارد یا منتقل شده است.</span>
          </p>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-300 bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 dark:border-brand-700 dark:bg-brand-700 dark:hover:bg-brand-600 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            اصلي پاڼه ته ورشئ / برگشت به صفحه اصلی
          </Link>
        </div>

        <p className="absolute text-xs text-center text-gray-400 bottom-6 dark:text-gray-600">
          &copy; {new Date().getFullYear()} - د کندهار پوهنتون د ګدام سیستم
        </p>
      </div>
    </>
  );
}
