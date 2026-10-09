import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getRequests, InventoryRequest } from "../../firebase/requests";
import { safeSortByCreatedAt } from "../../firebase/safeQuery";
import { getWorkflowStage } from "../../constants/workflow";
import { useCalendar } from "../../context/CalendarContext";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

const STATUS_LABELS: Record<string, string> = {
  StockNotAvailable: "جنس نشته — تدارکاتو ته",
  ProcurementPending: "تدارکاتو ته لیږل شو",
  TenderCreated: "جګړه پاڼه جوړه شوه",
  OffersReceived: "قیمتونه راغلل",
  ComparisonCreated: "مقایسه شوه",
  WinnerSelected: "ګټونکی ټاکل شو",
  PurchaseOrderCreated: "آمر خریداري",
};

const STATUS_COLORS: Record<string, string> = {
  StockNotAvailable: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  ProcurementPending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  TenderCreated: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  OffersReceived: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  ComparisonCreated: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  WinnerSelected: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  PurchaseOrderCreated: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

export default function ProcurementRequestList() {
  const { pickDate } = useCalendar();
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const all = await getRequests();
      const filtered = all.filter((r: InventoryRequest) =>
        ["StockNotAvailable", "ProcurementPending", "TenderCreated", "OffersReceived",
         "ComparisonCreated", "WinnerSelected", "PurchaseOrderCreated"].includes(r.status)
      );
      setRequests(safeSortByCreatedAt(filtered));
    } catch (e) {
      console.error("Error loading procurement requests:", e);
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
      (r.currentRequestLevel || "").toLowerCase().includes(q) ||
      (STATUS_LABELS[r.status] || r.status || "").toLowerCase().includes(q) ||
      (r.items || []).some(i => (i.name || "").toLowerCase().includes(q))
    );
  }, [requests, search]);

  return (
    <>
      <PageMeta title="تدارکاتي غوښتنې | Kandahar University WMS" description="تدارکاتو ته راجع شوې غوښتنې" />
      <Breadcrumb pageTitle="تدارکاتي غوښتنې / درخواست‌های تدارکاتی" />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">تدارکاتو ته راجع شوې غوښتنې</h3>
          <div className="flex items-center gap-3">
            <CurrentDateBadge />
            <span className="text-xs text-gray-400 dark:text-gray-500">{requests.length} ټولې / کل</span>
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
              placeholder="لټون... (پوهنځی، درجه، حالت، اجناس)"
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
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">درجه</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">حالت</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">پرمختګ</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">عمل</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-500 animate-fade-in">
                    {search ? `"${search}" لپاره هیڅ تدارکاتي غوښتنه ونه موندل شوه.` : "هیڅ تدارکاتي غوښتنه نشته."}
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r) => (
                  <tr key={r.id}
                    className="border-b border-gray-100 table-row-hover dark:border-gray-800 animate-slide-up"
                    style={{ animationDelay: `${Math.min(filteredRequests.indexOf(r), 15) * 35}ms` }}>
                    <td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400 text-right whitespace-nowrap">{pickDate(r.createdAtHijriShamsi, r.createdAtHijriQamari)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="font-bold text-gray-800 dark:text-white/90">{r.faculty || "-"}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{r.requesterName}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{r.departmentOrPerson}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-400 text-right">{r.items?.length || 0} قلمه</td>
                    <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-400 text-right whitespace-nowrap">{r.currentRequestLevel || "عادي"}</td>
                    <td className="px-4 py-4 text-right">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="w-20 bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 mr-auto">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.max(getWorkflowStage(r.status).progressPercent, (r.progress ?? 0))}%` }}></div>
                      </div>
                      <span className="text-[10px] text-gray-500">{Math.max(getWorkflowStage(r.status).progressPercent, (r.progress ?? 0))}%</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Link to={`/procurement/details/${r.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition font-bold">مدیریت</Link>
                        <Link to={`/procurement/offers/${r.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 transition">قیمتونه</Link>
                      </div>
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
