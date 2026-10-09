import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { generateFullBackup } from "../../firebase/maintenance";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/button/Button";
import { getCurrentHijriDates } from "../../utils/dateUtils";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

const escapeCell = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const toSheet = (name: string, rows: any[]) => {
  const safeRows = Array.isArray(rows) ? rows : [rows];
  const keys = Array.from(new Set(safeRows.flatMap((row) => Object.keys(row || {}))));
  const header = keys.map((key) => `<th>${escapeCell(key)}</th>`).join("");
  const body = safeRows
    .map((row) => `<tr>${keys.map((key) => `<td>${escapeCell(typeof row?.[key] === "object" ? JSON.stringify(row?.[key]) : row?.[key])}</td>`).join("")}</tr>`)
    .join("");
  return `<h2>${escapeCell(name)}</h2><table border="1"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table><br/>`;
};

export default function BackupExport() {
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();

  const handleFullBackup = async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      const data = await generateFullBackup({ uid: user.uid, name: profile.name, role: profile.role });
      const sheets = Object.entries(data).map(([name, rows]) => toSheet(name, rows as any[])).join("\n");
      const workbook = `<!doctype html><html><head><meta charset="UTF-8"><style>body,table{font-family:'Bahij Zar',Tahoma,sans-serif;direction:rtl}table{border-collapse:collapse;margin-bottom:24px}th,td{padding:6px 10px;text-align:right}th{background:#eef2ff}</style></head><body>${sheets}</body></html>`;
      const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dates = getCurrentHijriDates();
      link.href = url;
      link.download = `kandahar_wms_backup_${dates.shamsi.replace(/[ /]/g, "_")}.xls`;
      link.click();
      URL.revokeObjectURL(url);
      alert("بیکپ په بریالیتوب سره جوړ شو.");
    } catch (e) {
      alert("د بیکپ په جوړولو کې ستونزه پیدا شوه.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageMeta title="بیکپ او صادرات" description="د سیستم د معلوماتو بیکپ" />
      <Breadcrumb pageTitle="بیکپ او صادرات" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="max-w-3xl mx-auto space-y-6" dir="rtl">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="w-20 h-20 bg-brand-50 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-inner">
            📦
          </div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-white/90 mb-4">د ټولو معلوماتو اکسل بیکپ</h3>
          <p className="text-sm text-gray-500 mb-8 leading-7">
            دا بیکپ د کاروونکو، اجناسو، غوښتنو، پایپ لاین، رسمي فورمونو، ایمیلونو، تدارکاتو، تسلیمۍ او راپورونو معلومات په جلا جدولونو کې ښکته کوي. پټنومونه او محرمانه کلیدونه پکې نه شاملیږي.
          </p>
          <Button onClick={handleFullBackup} disabled={loading} fullWidth size="md">
            {loading ? "بیکپ جوړیږي..." : "اکسل بیکپ ډاونلوډ کړئ"}
          </Button>
        </div>

        <div className="p-5 bg-orange-50 border border-orange-100 rounded-2xl text-sm text-orange-700 leading-7">
          <strong>یادونه:</strong> د GitHub بیکپ لپاره باید وروسته خوندي backend یا server-side token تنظیم شي. په frontend کې token نه ساتل کېږي.
        </div>
      </div>
    </>
  );
}
