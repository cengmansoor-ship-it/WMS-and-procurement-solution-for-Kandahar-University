import { useCallback, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";
import Button from "../../components/ui/button/Button";
import { apiClient } from "../../api/apiClient";
import { getHijriShamsiDate } from "../../utils/dateUtils";
import { exportToCSV } from "../../firebase/reports";

interface ReturnReportRow {
  id: number;
  return_number: string;
  item_name: string;
  item_code: string;
  unit_name?: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  supplier_name?: string;
  returned_to: string;
  return_reference?: string;
  reason: string;
  condition_status?: string;
  returned_by_name?: string;
  created_by_name?: string;
  created_at: string;
}

interface ReturnSummary {
  total_returns?: number;
  total_quantity?: number | string;
  distinct_items?: number;
}

export default function ReturnReport() {
  const [rows, setRows] = useState<ReturnReportRow[]>([]);
  const [summary, setSummary] = useState<ReturnSummary>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", from_date: "", to_date: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
      const [records, totals] = await Promise.all([
        apiClient.get(`/inventory/returns${params.toString() ? `?${params}` : ""}`),
        apiClient.get("/inventory/returns/summary"),
      ]);
      setRows(Array.isArray(records) ? records : []);
      setSummary(totals || {});
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredTotal = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    [rows],
  );

  const exportCsv = () => exportToCSV(rows.map(row => ({
    "شمسي نېټه": getHijriShamsiDate(new Date(row.created_at)),
    "د واپسي سند": row.return_number,
    "جنس": row.item_name,
    "کود": row.item_code,
    "مقدار": row.quantity,
    "واحد": row.unit_name,
    "عرضه کوونکی": row.supplier_name,
    "واپس اخیستونکی": row.returned_to,
    "حواله": row.return_reference,
    "دلیل": row.reason,
    "مخکنۍ موجودي": row.previous_stock,
    "نوې موجودي": row.new_stock,
    "ثبت کوونکی": row.returned_by_name || row.created_by_name,
  })), "stock_return_khata");

  return (
    <>
      <PageMeta title="د اجناسو د واپسي راپور او کهاته | Kandahar University WMS" description="د ټولو واپس شویو اجناسو مفصل راپور" />
      <Breadcrumb pageTitle="د اجناسو د واپسي راپور او کهاته" />
      <div className="mb-3 flex justify-end" dir="rtl"><CurrentDateBadge forceShamsi /></div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4" dir="rtl">
        {[
          ["ټولې واپسۍ", summary.total_returns || 0],
          ["ټول واپس مقدار", summary.total_quantity || 0],
          ["بېلابېل اجناس", summary.distinct_items || 0],
          ["د فلټر مقدار", filteredTotal],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="text-xs font-bold text-gray-500">{label}</div>
            <div className="mt-1 text-2xl font-black text-amber-600">{Number(value).toLocaleString("fa-AF")}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]" dir="rtl">
        <div className="no-print mb-5 flex flex-wrap items-end gap-2">
          <div className="min-w-60 flex-1">
            <label className="mb-1 block text-xs font-bold">لټون</label>
            <input
              value={filters.search}
              onChange={e => setFilters(old => ({ ...old, search: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="سند، جنس، کود یا عرضه کوونکی..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold">له نېټې</label>
            <input type="date" value={filters.from_date} onChange={e => setFilters(old => ({ ...old, from_date: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold">تر نېټې</label>
            <input type="date" value={filters.to_date} onChange={e => setFilters(old => ({ ...old, to_date: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm" />
          </div>
          <Button variant="outline" size="sm" onClick={load}>فلټر</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>🖨️ چاپ</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>📊 اکسل</Button>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse text-right text-sm">
            <thead><tr className="bg-gray-100 dark:bg-gray-800">
              <th className="border px-3 py-2">شمسي نېټه</th>
              <th className="border px-3 py-2">سند</th>
              <th className="border px-3 py-2">جنس / کود</th>
              <th className="border px-3 py-2">مقدار</th>
              <th className="border px-3 py-2">موجودي مخکې ← وروسته</th>
              <th className="border px-3 py-2">واپس اخیستونکی</th>
              <th className="border px-3 py-2">حواله</th>
              <th className="border px-3 py-2">دلیل / حالت</th>
              <th className="border px-3 py-2">ثبت کوونکی</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="border py-10 text-center">بارول...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="border py-10 text-center">واپسي ونه موندل شوه.</td></tr>
              ) : rows.map(row => (
                <tr key={row.id}>
                  <td className="border px-3 py-2 text-xs">{getHijriShamsiDate(new Date(row.created_at))}</td>
                  <td className="border px-3 py-2 font-mono text-[11px]" dir="ltr">{row.return_number}</td>
                  <td className="border px-3 py-2"><b>{row.item_name}</b><div className="text-[11px] text-gray-500" dir="ltr">{row.item_code}</div></td>
                  <td className="border px-3 py-2 text-center font-black">{row.quantity} {row.unit_name}</td>
                  <td className="border px-3 py-2 text-center">{row.previous_stock} ← {row.new_stock}</td>
                  <td className="border px-3 py-2">{row.returned_to}</td>
                  <td className="border px-3 py-2">{row.return_reference || "—"}</td>
                  <td className="border px-3 py-2">{row.reason}<div className="text-[10px] text-gray-500">{row.condition_status}</div></td>
                  <td className="border px-3 py-2">{row.returned_by_name || row.created_by_name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
