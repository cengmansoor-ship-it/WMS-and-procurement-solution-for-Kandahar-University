import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getDepartmentReport, exportToCSV } from "../../firebase/reports";
import Button from "../../components/ui/button/Button";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

export default function DepartmentReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const rows = await getDepartmentReport();
      setData(Array.isArray(rows) ? rows : []);
    } catch {
      setData([]);
    }
    setLoading(false);
  };

  const handlePrint = () => window.print();

  const handleExport = () => {
    const exportData = data.map(d => ({
      'ډیپارټمنټ': d.name_ps || d.name || "",
      'پوهنځی': d.faculty_name || d.faculty || "",
      'ډول': d.department_type || "",
      'مجموعي غوښتنې': d.total_requests || 0,
      'سپارل شوي': d.delivered_requests || 0,
    }));
    exportToCSV(exportData, "department_report");
  };

  return (
    <>
      <PageMeta title="د ډیپارټمنټ راپور | Kandahar University WMS" description="د پوهنتون په ډیپارټمنټونو کې د اجناسو د ویش وضعیت." />
      <Breadcrumb pageTitle="د ډیپارټمنټ راپور / گزارش دیپارتمنت" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">د ډیپارټمنټونو په کچه د اجناسو ویش</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>🖨️ چاپ</Button>
            <Button variant="outline" size="sm" onClick={handleExport}>📊 اکسل</Button>
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-right table-auto border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="px-4 py-3 border">ډیپارټمنټ</th>
                <th className="px-4 py-3 border">پوهنځی</th>
                <th className="px-4 py-3 border">ډول</th>
                <th className="px-4 py-3 border">مجموعي غوښتنې</th>
                <th className="px-4 py-3 border">سپارل شوي</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10">بارول...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10">معلومات نشته.</td></tr>
              ) : data.map((d, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-2 border font-bold text-gray-800 dark:text-white/90">{d.name_ps || d.name}</td>
                  <td className="px-4 py-2 border text-xs">{d.faculty_name || d.faculty || "—"}</td>
                  <td className="px-4 py-2 border">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${d.department_type === 'FACULTY' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {d.department_type === 'FACULTY' ? 'پوهنځی' : 'اداري'}
                    </span>
                  </td>
                  <td className="px-4 py-2 border text-center font-bold">{d.total_requests || 0}</td>
                  <td className="px-4 py-2 border text-center font-bold text-green-600">{d.delivered_requests || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
