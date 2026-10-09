import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getRecentTransactions, StockTransaction } from "../../firebase/inventory";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";
import { getHijriShamsiDate } from "../../utils/dateUtils";

export default function InventoryLedger() {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const typeFilter = searchParams.get("type");
  const itemFilter = searchParams.get("item");

  useEffect(() => { fetchTransactions(); }, []);

  const fetchTransactions = async () => {
    try {
      const data = await getRecentTransactions(200);
      setTransactions(data);
    } catch (error) {
      console.error("Error fetching ledger:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (typeFilter === "IN") list = list.filter(t => t.type === "IN");
    else if (typeFilter === "OUT") list = list.filter(t => t.type === "OUT");
    else if (typeFilter === "RETURN") list = list.filter(t => t.sourceType === "RETURN_TO_SUPPLIER");
    if (itemFilter) list = list.filter(t => t.itemId === itemFilter);
    return list;
  }, [transactions, typeFilter, itemFilter]);

  const getBadgeClass = (type: string, sourceType?: string) => {
    if (sourceType === "RETURN_TO_SUPPLIER") {
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    }
    switch (type) {
      case 'IN': return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case 'OUT': return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case 'ADJUSTMENT': return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const filterLabel = typeFilter === "IN"
    ? "داخل شوي اجناس"
    : typeFilter === "OUT"
    ? "خارج شوي اجناس"
    : typeFilter === "RETURN"
    ? "واپس شوي اجناس"
    : itemFilter
    ? "د جنس حرکات"
    : "د راکړې ورکړې تاریخچه / تاریخچه تراکنش‌ها";

  return (
    <>
      <PageMeta
        title="د موجودۍ کهاته | Kandahar University WMS"
        description="د ګودام د راکړې ورکړې کهاته"
      />
      <Breadcrumb pageTitle="د موجودۍ کهاته / دفتر موجودی" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge forceShamsi /></div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 text-right">
            {filterLabel}
            {!loading && (
              <span className="mr-2 text-sm font-normal text-gray-400">({filteredTransactions.length})</span>
            )}
          </h3>

          {/* Filter tabs */}
          <div className="flex items-center gap-2" dir="rtl">
            <Link
              to="/inventory/ledger"
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${!typeFilter && !itemFilter ? "bg-primary text-white border-primary" : "border-gray-300 text-gray-600 hover:border-primary hover:text-primary dark:border-gray-700 dark:text-gray-400"}`}
            >
              ټول
            </Link>
            <Link
              to="/inventory/ledger?type=IN"
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${typeFilter === "IN" ? "bg-green-600 text-white border-green-600" : "border-gray-300 text-gray-600 hover:border-green-500 hover:text-green-600 dark:border-gray-700 dark:text-gray-400"}`}
            >
              📥 داخل
            </Link>
            <Link
              to="/inventory/ledger?type=OUT"
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${typeFilter === "OUT" ? "bg-red-600 text-white border-red-600" : "border-gray-300 text-gray-600 hover:border-red-500 hover:text-red-600 dark:border-gray-700 dark:text-gray-400"}`}
            >
              📤 خارج
            </Link>
            <Link
              to="/inventory/ledger?type=RETURN"
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${typeFilter === "RETURN" ? "bg-amber-600 text-white border-amber-600" : "border-gray-300 text-gray-600 hover:border-amber-500 hover:text-amber-700 dark:border-gray-700 dark:text-gray-400"}`}
            >
              ↩ واپسي
            </Link>
          </div>
        </div>

        {(typeFilter || itemFilter) && (
          <div className="mb-4 flex items-center gap-2" dir="rtl">
            <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${typeFilter === "IN" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : typeFilter === "OUT" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : typeFilter === "RETURN" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" : "bg-blue-100 text-blue-700"}`}>
              {typeFilter === "IN" ? "📥 یوازې داخل ښودل کیږي" : typeFilter === "OUT" ? "📤 یوازې خارج ښودل کیږي" : typeFilter === "RETURN" ? "↩ یوازې واپسۍ ښودل کیږي" : "🔍 د جنس له مخې فلتر"}
            </span>
            <Link to="/inventory/ledger" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">✕ لرې کول</Link>
          </div>
        )}

        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left dark:bg-gray-800">
                <th className="px-4 py-4 font-medium text-gray-800 dark:text-white/90 text-right">نیټه (شمسي)</th>
                <th className="px-4 py-4 font-medium text-gray-800 dark:text-white/90 text-right">د جنس نوم</th>
                <th className="px-4 py-4 font-medium text-gray-800 dark:text-white/90 text-right">ډول</th>
                <th className="px-4 py-4 font-medium text-gray-800 dark:text-white/90 text-right">مقدار</th>
                <th className="px-4 py-4 font-medium text-gray-800 dark:text-white/90 text-right">مخکې/وروسته</th>
                <th className="px-4 py-4 font-medium text-gray-800 dark:text-white/90 text-right">ترسره کوونکی</th>
                <th className="px-4 py-4 font-medium text-gray-800 dark:text-white/90 text-right">علت</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-500">بارول...</td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-500">
                    {typeFilter === "IN" ? "کوم داخل شوی جنس نه دی موندل شوی." : typeFilter === "OUT" ? "کوم خارج شوی جنس نه دی موندل شوی." : typeFilter === "RETURN" ? "کوم واپس شوی جنس نه دی موندل شوی." : "هیڅ ریکارډ ونه موندل شو."}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t, idx) => (
                  <tr key={t.id || idx} className="border-b border-gray-100 dark:border-gray-800 table-row-hover animate-slide-up" style={{ animationDelay: `${Math.min(idx, 20) * 30}ms` }}>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-400 text-sm text-right">
                      {getHijriShamsiDate(new Date(t.createdAt))}
                    </td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-400 text-right font-medium">
                      <Link to={`/inventory/ledger?item=${t.itemId}`} className="hover:text-primary transition-colors hover:underline">
                        {t.itemName}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        to={`/inventory/ledger?type=${t.sourceType === "RETURN_TO_SUPPLIER" ? "RETURN" : t.type}`}
                        className={`px-2 py-0.5 rounded text-xs font-bold ${getBadgeClass(t.type, t.sourceType)} hover:opacity-80 transition-opacity`}
                      >
                        {t.sourceType === "RETURN_TO_SUPPLIER" ? "واپسي" : t.type === 'IN' ? 'داخل' : t.type === 'OUT' ? 'خارج' : 'اصلاح'}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-400 text-right">{t.quantity} {t.unit}</td>
                    <td className="px-4 py-4 text-gray-500 dark:text-gray-500 text-xs text-right">
                      {t.stockBefore} → {t.stockAfter}
                    </td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-400 text-right">{t.performedByName}</td>
                    <td className="px-4 py-4 text-gray-500 dark:text-gray-500 text-sm text-right max-w-[200px] truncate" title={t.reason}>
                      {t.reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredTransactions.length > 0 && (
          <p className="mt-3 text-xs text-gray-400 text-right">
            {filteredTransactions.length} ریکارډ ښودل کیږي
          </p>
        )}
      </div>
    </>
  );
}
