import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getReceivingDeliveryReport, exportToCSV } from "../../firebase/reports";
import Button from "../../components/ui/button/Button";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

export default function ReceivingDeliveryReport() {
  const [receiving, setReceiving] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [tab, setTab] = useState<'receiving' | 'delivery'>('delivery');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await getReceivingDeliveryReport();
      setReceiving(Array.isArray(result?.receiving) ? result.receiving : []);
      setDeliveries(Array.isArray(result?.delivery) ? result.delivery : []);
    } catch {
      setReceiving([]);
      setDeliveries([]);
    }
    setLoading(false);
  };

  const handlePrint = () => window.print();

  const handleExport = () => {
    if (tab === 'delivery') {
      const exportData = deliveries.map(d => ({
        'د غوښتنې کود': d.request_tracking_id || "",
        'ترلاسه کوونکی': d.person_name || d.delivered_to_name || "",
        'FS5 نمبر': d.fs5_number || "",
        'نیټه': d.created_at ? new Date(d.created_at).toLocaleDateString() : "",
        'حالت': d.status || "",
      }));
      exportToCSV(exportData, "delivery_report");
    } else {
      const exportData = receiving.map(r => ({
        'PO نمبر': r.po_number || "",
        'د غوښتنې کود': r.request_tracking_id || "",
        'نیټه': r.created_at ? new Date(r.created_at).toLocaleDateString() : "",
        'حالت': r.status || "",
        'یادداښتونه': r.notes || "",
      }));
      exportToCSV(exportData, "receiving_report");
    }
  };

  return (
    <>
      <PageMeta title="د ترلاسه کولو او سپارلو راپور | Kandahar University WMS" description="د اجناسو د ترلاسه کولو او هغو د ویش بشپړ لړۍ." />
      <Breadcrumb pageTitle="د ترلاسه کولو او سپارلو راپور / گزارش تحویلی" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('delivery')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${tab === 'delivery' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              تسلیمي (FS-5)
            </button>
            <button
              onClick={() => setTab('receiving')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${tab === 'receiving' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              رسید (تدارکات)
            </button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>🖨️ چاپ</Button>
            <Button variant="outline" size="sm" onClick={handleExport}>📊 اکسل</Button>
          </div>
        </div>

        {tab === 'delivery' && (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-right table-auto border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="px-4 py-3 border">د غوښتنې کود</th>
                  <th className="px-4 py-3 border">ترلاسه کوونکی</th>
                  <th className="px-4 py-3 border">FS5 نمبر</th>
                  <th className="px-4 py-3 border">نیټه</th>
                  <th className="px-4 py-3 border">حالت</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-10">بارول...</td></tr>
                ) : deliveries.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10">معلومات نشته.</td></tr>
                ) : deliveries.map((d, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 transition">
                    <td className="px-4 py-2 border text-xs text-gray-500">{d.request_tracking_id}</td>
                    <td className="px-4 py-2 border font-bold">{d.person_name || d.delivered_to_name || d.deliveredToName}</td>
                    <td className="px-4 py-2 border text-xs">{d.fs5_number || d.fs5Number || "—"}</td>
                    <td className="px-4 py-2 border text-xs">{d.created_at ? new Date(d.created_at).toLocaleDateString() : (d.deliveredAtHijriShamsi || "")}</td>
                    <td className="px-4 py-2 border text-green-600 font-bold text-xs">{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'receiving' && (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-right table-auto border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="px-4 py-3 border">PO نمبر</th>
                  <th className="px-4 py-3 border">د غوښتنې کود</th>
                  <th className="px-4 py-3 border">نیټه</th>
                  <th className="px-4 py-3 border">حالت</th>
                  <th className="px-4 py-3 border">یادداښتونه</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-10">بارول...</td></tr>
                ) : receiving.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10">معلومات نشته.</td></tr>
                ) : receiving.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 transition">
                    <td className="px-4 py-2 border font-bold text-xs">{r.po_number || "—"}</td>
                    <td className="px-4 py-2 border text-xs text-gray-500">{r.request_tracking_id}</td>
                    <td className="px-4 py-2 border text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</td>
                    <td className="px-4 py-2 border text-green-600 font-bold text-xs">{r.status}</td>
                    <td className="px-4 py-2 border text-xs text-gray-500">{r.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
