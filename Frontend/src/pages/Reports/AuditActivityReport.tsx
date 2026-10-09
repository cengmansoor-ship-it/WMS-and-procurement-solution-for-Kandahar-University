import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getAuditLogs, exportToCSV } from "../../firebase/reports";
import Button from "../../components/ui/button/Button";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

export default function AuditActivityReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ entity_type: "", action: "" });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filter.entity_type) params.entity_type = filter.entity_type;
      if (filter.action) params.action = filter.action;
      const rows = await getAuditLogs(params);
      setData(Array.isArray(rows) ? rows : []);
    } catch {
      setData([]);
    }
    setLoading(false);
  };

  const handlePrint = () => window.print();

  const handleExport = () => {
    const exportData = data.map(l => ({
      'نیټه': l.created_at ? new Date(l.created_at).toLocaleString() : (l.timestampHijriShamsi || ""),
      'ډول': l.entity_type || "",
      'ID': l.entity_id || "",
      'عمل': l.action || "",
      'نوي ارزښت': JSON.stringify(l.new_value || {}),
    }));
    exportToCSV(exportData, "audit_report");
  };

  return (
    <>
      <PageMeta title="د سیسټم فعالیتونه | Kandahar University WMS" description="د سیسټم د ټولو امنیتي او کاري فعالیتونو تاریخچه (Audit Log)." />
      <Breadcrumb pageTitle="د سیسټم فعالیتونه / فعالیتهای سیستم" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">د سیسټم د فعالیتونو تاریخچه (Audit Log)</h3>
          <div className="flex gap-2">
            <select
              className="border rounded px-2 py-1 text-sm"
              value={filter.entity_type}
              onChange={e => setFilter(f => ({ ...f, entity_type: e.target.value }))}
            >
              <option value="">ټول ډولونه</option>
              <option value="REQUEST">غوښتنه</option>
              <option value="PROCUREMENT_CASE">تدارکات</option>
              <option value="RECEIVING_RECORD">رسید</option>
              <option value="DELIVERY">تسلیمي</option>
              <option value="ITEM">جنس</option>
            </select>
            <Button variant="outline" size="sm" onClick={fetchData}>فلټر</Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>🖨️ چاپ</Button>
            <Button variant="outline" size="sm" onClick={handleExport}>📊 اکسل</Button>
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-right table-auto border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="px-4 py-3 border">نیټه</th>
                <th className="px-4 py-3 border">ډول</th>
                <th className="px-4 py-3 border">ID</th>
                <th className="px-4 py-3 border">عمل</th>
                <th className="px-4 py-3 border">نوي ارزښت</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10">بارول...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10">معلومات نشته.</td></tr>
              ) : data.map((l, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-2 border whitespace-nowrap">{l.created_at ? new Date(l.created_at).toLocaleString() : (l.timestampHijriShamsi || l.createdAtHijriShamsi || "")}</td>
                  <td className="px-4 py-2 border">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-bold">{l.entity_type}</span>
                  </td>
                  <td className="px-4 py-2 border text-gray-500">{l.entity_id}</td>
                  <td className="px-4 py-2 border font-bold text-primary">{l.action}</td>
                  <td className="px-4 py-2 border max-w-xs truncate text-gray-500">{typeof l.new_value === 'object' ? JSON.stringify(l.new_value) : (l.new_value || JSON.stringify(l.details || {}))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
