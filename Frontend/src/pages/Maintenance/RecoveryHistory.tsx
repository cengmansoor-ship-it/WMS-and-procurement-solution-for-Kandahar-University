import { useEffect, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getRecoveryHistory, TrashLog } from "../../firebase/maintenance";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

const ENTITY_ROUTE: Record<string, string> = {
  item: "/inventory/items",
  items: "/inventory/items",
  request: "/requests",
  requests: "/requests",
  procurement: "/procurement",
  warehouse_request: "/receiving",
  receiving: "/receiving",
  user: "/user-management",
  users: "/user-management",
};

export default function RecoveryHistory() {
  const [history, setHistory] = useState<TrashLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const data = await getRecoveryHistory();
    setHistory(data);
    setLoading(false);
  };

  return (
    <>
      <PageMeta title="د بیا رغونې تاریخچه | Kandahar University WMS" description="د سیسټم د معلوماتو د حذف او بېرته راګرځولو تاریخچه." />
      <Breadcrumb pageTitle="د بیا رغونې تاریخچه / تاریخچه بازیابی" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-6 border-b pb-2 dark:border-gray-700">د حذف او بیا رغونې بشپړ تاریخچه</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right table-auto border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="px-4 py-3 border">نیټه</th>
                <th className="px-4 py-3 border">عمل</th>
                <th className="px-4 py-3 border">ډول</th>
                <th className="px-4 py-3 border">نوم / لیبل</th>
                <th className="px-4 py-3 border">اجرا کوونکی</th>
                <th className="px-4 py-3 border">دلیل</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10">بارول...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">تاریخچه خالي ده.</td></tr>
              ) : history.map((log, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-2 border text-xs">{log.performedAtHijriShamsi}</td>
                  <td className="px-4 py-2 border">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.action === 'soft_deleted' ? 'bg-red-100 text-red-700' : 
                      log.action === 'restored' ? 'bg-green-100 text-green-700' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {log.action === 'soft_deleted' ? 'حذف شو' : log.action === 'restored' ? 'بیا رغول شو' : log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 border">
                    {ENTITY_ROUTE[log.entityType?.toLowerCase()] ? (
                      <Link to={ENTITY_ROUTE[log.entityType.toLowerCase()]} className="font-bold text-primary hover:underline cursor-pointer">
                        {log.entityType}
                      </Link>
                    ) : (
                      <span className="font-bold text-primary">{log.entityType}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 border">{log.entityLabel}</td>
                  <td className="px-4 py-2 border text-xs">{log.performedByName} ({log.performedByRole})</td>
                  <td className="px-4 py-2 border text-xs italic text-gray-500">{log.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
