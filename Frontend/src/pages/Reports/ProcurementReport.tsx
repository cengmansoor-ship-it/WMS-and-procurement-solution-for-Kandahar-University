import { useEffect, useState, useMemo } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getProcurementReport, exportToCSV } from "../../firebase/reports";
import Button from "../../components/ui/button/Button";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

type QuickFilter = "all" | "today" | "month" | "year";

function getQuickDates(q: QuickFilter): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (q === "today") {
    const t = fmt(now);
    return { from: t, to: t };
  }
  if (q === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: fmt(from), to: fmt(to) };
  }
  if (q === "year") {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
  }
  return { from: "", to: "" };
}

export default function ProcurementReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const rows = await getProcurementReport();
      setData(Array.isArray(rows) ? rows : []);
    } catch {
      setData([]);
    }
    setLoading(false);
  };

  const applyQuick = (q: QuickFilter) => {
    setQuickFilter(q);
    if (q === "all") { setFromDate(""); setToDate(""); return; }
    const { from, to } = getQuickDates(q);
    setFromDate(from);
    setToDate(to);
  };

  const filtered = useMemo(() => {
    if (!fromDate && !toDate) return data;
    return data.filter(p => {
      const d = p.created_at ? new Date(p.created_at) : null;
      if (!d) return true;
      const ds = d.toISOString().slice(0, 10);
      if (fromDate && ds < fromDate) return false;
      if (toDate && ds > toDate) return false;
      return true;
    });
  }, [data, fromDate, toDate]);

  const handlePrint = () => window.print();

  const handleExport = () => {
    const exportData = filtered.map(p => ({
      'د غوښتنې کود': p.request_tracking_id || "",
      'حالت': p.status || "",
      'PO نمبر': p.po_number || "نشته",
      'ګټونکی شرکت': p.vendor_name || 'نشته',
      'مجموعي قیمت': p.total_amount || 0,
      'نیټه': p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
    }));
    exportToCSV(exportData, "procurement_report");
  };

  return (
    <>
      <PageMeta title="د تدارکاتو راپور | Kandahar University WMS" description="د تدارکاتي پروسو، د نرخونو د ورکړې او د ګټونکو شرکتونو بشپړ راپور." />
      <Breadcrumb pageTitle="د تدارکاتو راپور / گزارش تدارکات" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 no-print">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">د تدارکاتي پروسو تحلیلي راپور</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>🖨️ چاپ</Button>
            <Button variant="outline" size="sm" onClick={handleExport}>📊 اکسل</Button>
          </div>
        </div>

        {/* فلټر برخه */}
        <div className="flex flex-wrap gap-3 items-center mb-5 no-print p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-gray-800" dir="rtl">
          <div className="flex gap-2 flex-wrap">
            {([
              ["all", "ټول"],
              ["today", "نن"],
              ["month", "دا میاشت"],
              ["year", "دا کال"],
            ] as [QuickFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => applyQuick(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  quickFilter === key
                    ? "bg-brand-100 text-gray-900 border border-brand-300 shadow dark:bg-brand-900/40 dark:text-white dark:border-brand-700"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400">له:</span>
            <input
              type="date"
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white/90 outline-none focus:border-primary"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setQuickFilter("all"); }}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">تر:</span>
            <input
              type="date"
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white/90 outline-none focus:border-primary"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setQuickFilter("all"); }}
            />
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(""); setToDate(""); setQuickFilter("all"); }}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg border border-red-200 hover:border-red-400 transition"
              >
                ✕ لغوه
              </button>
            )}
          </div>
          <span className="text-xs text-gray-400 mr-auto">{filtered.length} پایله</span>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-right table-auto border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="px-4 py-3 border">د غوښتنې کود</th>
                <th className="px-4 py-3 border">حالت</th>
                <th className="px-4 py-3 border">PO نمبر</th>
                <th className="px-4 py-3 border">ګټونکی شرکت</th>
                <th className="px-4 py-3 border">مجموعي قیمت (افغاني)</th>
                <th className="px-4 py-3 border">نیټه</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10">بارول...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10">معلومات نشته.</td></tr>
              ) : filtered.map((p, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-white/5 transition">
                  <td className="px-4 py-2 border text-xs text-gray-500">{p.request_tracking_id}</td>
                  <td className="px-4 py-2 border text-xs">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{p.status}</span>
                  </td>
                  <td className="px-4 py-2 border text-xs">{p.po_number || "—"}</td>
                  <td className="px-4 py-2 border text-green-600 font-bold">{p.vendor_name || "—"}</td>
                  <td className="px-4 py-2 border font-bold text-primary">{Number(p.total_amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-2 border text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
