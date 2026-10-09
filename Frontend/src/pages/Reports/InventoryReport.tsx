import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getInventoryReport, exportToCSV } from "../../firebase/reports";
import Button from "../../components/ui/button/Button";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

export default function InventoryReport() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await getInventoryReport();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  };

  const handlePrint = () => window.print();

  const handleExport = () => {
    const exportData = items.map(i => ({
      'کود': i.item_code || i.itemCode || "",
      'نوم': i.name_ps || i.name || "",
      'کټګوري': i.category_name || i.category || "",
      'واحد': i.unit_name || i.unit || "",
      'ګدام': i.warehouse_name || "",
      'مجموعي داخل': i.total_in || 0,
      'مجموعي صادر': i.total_out || 0,
      'موجودي': i.current_stock ?? i.currentQuantity ?? 0,
      'لږترلږه موجودي': i.minimum_stock ?? i.minimumStockLevel ?? 0,
    }));
    exportToCSV(exportData, "inventory_report");
  };

  return (
    <>
      <PageMeta title="د موجودۍ راپور | Kandahar University WMS" description="د اجناسو لیست او ارزښت" />
      <Breadcrumb pageTitle="د موجودۍ راپور / گزارش موجودی" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">د اجناسو د موجودۍ راپور</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>🖨️ چاپ</Button>
            <Button variant="outline" size="sm" onClick={handleExport}>📊 اکسل</Button>
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-right table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white/90">
                <th className="px-4 py-4 border">کود</th>
                <th className="px-4 py-4 border">نوم</th>
                <th className="px-4 py-4 border">کټګوري</th>
                <th className="px-4 py-4 border">واحد</th>
                <th className="px-4 py-4 border">ګدام</th>
                <th className="px-4 py-4 border">موجودي</th>
                <th className="px-4 py-4 border">لږترلږه</th>
                <th className="px-4 py-4 border">مجموعي داخل</th>
                <th className="px-4 py-4 border">مجموعي صادر</th>
                <th className="px-4 py-4 border">حالت</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10">بارول...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10">معلومات نشته.</td></tr>
              ) : items.map((i, idx) => {
                const stock = i.current_stock ?? i.currentQuantity ?? 0;
                const minStock = i.minimum_stock ?? i.minimumStockLevel ?? 0;
                const isLow = stock > 0 && stock <= minStock;
                const isOut = stock === 0;
                return (
                  <tr key={idx} className="border-b hover:bg-gray-50 transition">
                    <td className="px-4 py-2 border text-xs text-gray-500">{i.item_code || i.itemCode}</td>
                    <td className="px-4 py-2 border font-bold">{i.name_ps || i.name}</td>
                    <td className="px-4 py-2 border text-xs">{i.category_name || i.category}</td>
                    <td className="px-4 py-2 border text-xs">{i.unit_name || i.unit}</td>
                    <td className="px-4 py-2 border text-xs">{i.warehouse_name}</td>
                    <td className={`px-4 py-2 border font-black text-lg ${isOut ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-green-600'}`}>{stock}</td>
                    <td className="px-4 py-2 border text-gray-500">{minStock}</td>
                    <td className="px-4 py-2 border text-green-600 font-bold">{i.total_in || 0}</td>
                    <td className="px-4 py-2 border text-red-600 font-bold">{i.total_out || 0}</td>
                    <td className="px-4 py-2 border">
                      {isOut ? (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">تمام شوی</span>
                      ) : isLow ? (
                        <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-bold">کم موجودي</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">سم دی</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
