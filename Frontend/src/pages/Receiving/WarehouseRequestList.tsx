import { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getRequests, InventoryRequest } from "../../firebase/requests";
import { safeSortByCreatedAt } from "../../firebase/safeQuery";
import { getWorkflowStage } from "../../constants/workflow";
import { useCalendar } from "../../context/CalendarContext";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

const STATUS_LABELS: Record<string, string> = {
  StockAvailable: "جنس شتون لري — سپارل",
  PurchaseOrderCreated: "د راپور رسید په تمه",
  ReceiptReportCreated: "راپور رسید جوړ شو",
  ReceivedToInventory: "ګدام ته داخل شو",
  FS5Created: "ف، س، ۵ جوړه شوه",
  Delivered: "تسلیم شو",
};

const STATUS_COLORS: Record<string, string> = {
  StockAvailable: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  PurchaseOrderCreated: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  ReceiptReportCreated: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  ReceivedToInventory: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  FS5Created: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  Delivered: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

const TAB_CONFIG: Record<string, { statuses: string[]; title: string; heading: string }> = {
  "receiving": {
    statuses: ["StockAvailable", "ReceiptReportCreated", "ReceivedToInventory", "FS5Created", "Delivered"],
    title: "رسید او ف، س، ۵ / دریافت و ف-۵-س",
    heading: "د رسید او ف، س، ۵ غوښتنې / مدیریت دریافت و فورم ۵-س",
  },
  "receipt-reports": {
    statuses: ["PurchaseOrderCreated"],
    title: "راپور رسید / گزارش دریافت",
    heading: "د راپور رسید غوښتنې / مدیریت گزارش دریافت",
  },
};

export default function WarehouseRequestList() {
  const location = useLocation();
  const tabKey = location.pathname === "/receiving/receipt-reports" ? "receipt-reports" : "receiving";
  const config = TAB_CONFIG[tabKey];

  const { pickDate } = useCalendar();
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchRequests();
  }, [tabKey]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const all = await getRequests();
      const filtered = all.filter((r: InventoryRequest) =>
        config.statuses.includes(r.status)
      );
      setRequests(safeSortByCreatedAt(filtered));
    } catch (e) {
      console.error("Error loading warehouse requests:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.trim().toLowerCase();
    return requests.filter(r =>
      (r.id || "").toLowerCase().includes(q) ||
      (r.faculty || "").toLowerCase().includes(q) ||
      (r.departmentOrPerson || "").toLowerCase().includes(q) ||
      (r.requesterName || "").toLowerCase().includes(q) ||
      (STATUS_LABELS[r.status] || r.status || "").toLowerCase().includes(q) ||
      (r.items || []).some(i => (i.name || "").toLowerCase().includes(q))
    );
  }, [requests, search]);

  return (
    <>
      <PageMeta title={`${config.title} | Kandahar University WMS`} description="د ترلاسه کولو او سپارلو مدیریت" />
      <Breadcrumb pageTitle={config.heading} />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{config.heading}</h3>
          <div className="flex items-center gap-3">
            <CurrentDateBadge />
            <span className="text-xs text-gray-400">{requests.length} ټولې</span>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="لټون... (پوهنځی، غوښتونکی، حالت، اجناس)"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-4 text-sm text-right text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              dir="rtl"
            />
          </div>
          {search && (
            <p className="mt-1 text-xs text-gray-400 text-right">{filteredRequests.length} پایله</p>
          )}
        </div>

        <div className="max-w-full overflow-x-auto">
          {loading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer h-16 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          ) : (
            <table className="w-full table-auto" dir="rtl">
              <thead>
                <tr className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/60">
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">نیټه</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">پوهنځی / غوښتونکی</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">اجناس</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">حالت</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">پرمختګ</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">عمل</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-500 animate-fade-in">
                      {search ? `"${search}" لپاره هیڅ غوښتنه ونه موندل شوه.` : "هیڅ غوښتنه نشته."}
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((r, idx) => (
                    <tr key={r.id}
                      className="border-b border-gray-100 table-row-hover dark:border-gray-800 animate-slide-up"
                      style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}>
                      <td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400 text-right whitespace-nowrap">{pickDate(r.createdAtHijriShamsi, r.createdAtHijriQamari)}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="font-bold text-gray-800 dark:text-white/90">{r.faculty || "-"}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{r.requesterName}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{r.departmentOrPerson}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-400 text-right max-w-[180px] truncate">
                        {(r.items || []).map(i => i.name).join("، ") || `${r.items?.length || 0} قلمه`}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="w-20 bg-gray-200 rounded-full h-2 dark:bg-gray-700 mr-auto overflow-hidden">
                          <div className="bg-gradient-to-r from-primary to-blue-400 h-2 rounded-full transition-all duration-700" style={{ width: `${Math.max(getWorkflowStage(r.status).progressPercent, (r.progress ?? 0))}%` }}></div>
                        </div>
                        <span className="text-[10px] text-gray-500 font-medium">{Math.max(getWorkflowStage(r.status).progressPercent, (r.progress ?? 0))}%</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          to={`/receiving/details/${r.id}`}
                          className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all font-bold btn-press"
                        >
                          مدیریت
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
