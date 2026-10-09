import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getPersonAssignmentReport, exportToCSV } from "../../firebase/reports";
import Button from "../../components/ui/button/Button";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

export default function PersonAssignmentReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const rows = await getPersonAssignmentReport();
      setData(Array.isArray(rows) ? rows : []);
    } catch {
      setData([]);
    }
    setLoading(false);
  };

  const handlePrint = () => window.print();

  const handleExport = () => {
    const exportData = data.map(a => ({
      'شخص': a.person_name || a.assignedToName || "",
      'پوهنځی': a.faculty_name || a.facultyName || "",
      'ډیپارټمنټ': a.department_name || "",
      'جنس': a.item_name || a.itemName || "",
      'کود': a.item_code || "",
      'واحد': a.unit_name || a.unit || "",
      'مقدار': a.quantity || 0,
      'حالت': a.status || "",
      'نیټه': a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : (a.assignedAtHijriShamsi || ""),
    }));
    exportToCSV(exportData, "person_assignment_report");
  };

  return (
    <>
      <PageMeta title="د اشخاصو ثبت شوي اجناس | Kandahar University WMS" description="د هغه اجناسو لړۍ چې د اشخاصو په نامه ثبت شوي دي." />
      <Breadcrumb pageTitle="د اشخاصو ثبت شوي اجناس / اجناس ثبتشده اشخاص" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">د اشخاصو په نامه د ثبت شویو اجناسو لړۍ</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>🖨️ چاپ</Button>
            <Button variant="outline" size="sm" onClick={handleExport}>📊 اکسل</Button>
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-right table-auto border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="px-4 py-3 border">نیټه</th>
                <th className="px-4 py-3 border">شخص / غوښتونکی</th>
                <th className="px-4 py-3 border">پوهنځی</th>
                <th className="px-4 py-3 border">ډیپارټمنټ</th>
                <th className="px-4 py-3 border">جنس</th>
                <th className="px-4 py-3 border">واحد</th>
                <th className="px-4 py-3 border">مقدار</th>
                <th className="px-4 py-3 border">حالت</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10">بارول...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10">معلومات نشته.</td></tr>
              ) : data.map((a, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-2 border text-xs">{a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : (a.assignedAtHijriShamsi || "")}</td>
                  <td className="px-4 py-2 border font-bold">{a.person_name || a.assignedToName}</td>
                  <td className="px-4 py-2 border text-xs">{a.faculty_name || a.facultyName}</td>
                  <td className="px-4 py-2 border text-xs">{a.department_name}</td>
                  <td className="px-4 py-2 border font-bold">{a.item_name || a.itemName}</td>
                  <td className="px-4 py-2 border text-xs">{a.unit_name || a.unit}</td>
                  <td className="px-4 py-2 border text-primary font-black">{a.quantity}</td>
                  <td className="px-4 py-2 border text-[10px] font-bold text-green-600">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
