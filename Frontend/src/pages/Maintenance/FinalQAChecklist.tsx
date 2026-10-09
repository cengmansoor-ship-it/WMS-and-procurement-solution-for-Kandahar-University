import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getQAChecklist, updateQAChecklist, QAChecklistItem } from "../../firebase/maintenance";
import { getAuditLogs } from "../../firebase/reports";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/button/Button";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

export default function FinalQAChecklist() {
  const [items, setItems] = useState<QAChecklistItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    fetchChecklist();
  }, []);

  const fetchChecklist = async () => {
    setLoading(true);
    try {
      const [data, logs] = await Promise.all([
        getQAChecklist(),
        getAuditLogs({}),
      ]);
      setItems(data);
      setActivityLogs(Array.isArray(logs) ? logs.slice(0, 50) : []);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, currentStatus: string) => {
    if (!user || !profile) return;
    const nextStatus = currentStatus === 'Pending' ? 'Passed' : currentStatus === 'Passed' ? 'Failed' : 'Pending';
    const notes = window.prompt("یادښت ولیکئ / یادداشت بنویسید:");
    
    try {
      await updateQAChecklist(id, { status: nextStatus as any, notes: notes || "" }, { uid: user.uid, name: profile.name });
      fetchChecklist();
    } catch (e) {
      alert("تېروتنه رامنځته شوه.");
    }
  };

  const categories = Array.from(new Set(items.map(i => i.category)));
  const readJson = (value: any) => {
    if (!value) return {};
    if (typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return {}; }
  };
  const actionLabel = (action: string) => ({
    LOGIN: "ننوتل",
    CREATE: "جوړول",
    CREATE_USER: "کاروونکی جوړول",
    UPDATE: "تازه کول",
    UPDATE_USER: "کاروونکی تازه کول",
    UPDATE_STATUS: "حالت بدلول",
    SET_USER_ACTIVE: "فعال/غیرفعال",
    SELECT_WINNER: "بریالی ټاکل",
    CREATE_PURCHASE_ORDER: "آمر خریداري",
  } as Record<string, string>)[action] || action || "-";
  const entityLabel = (entity: string) => ({
    AUTH: "ننوتل",
    USER: "کاروونکی",
    REQUEST: "غوښتنه",
    ITEM: "جنس",
    PROCUREMENT_CASE: "تدارکات",
    RECEIVING_RECORD: "رسید",
    DELIVERY: "تسلیمي",
  } as Record<string, string>)[entity] || entity || "-";
  const actorLabel = (log: any) => {
    const payload = readJson(log.new_value);
    return log.user_name || payload.actorName || payload.name || log.user_email || "سیسټم";
  };
  const detailLabel = (log: any) => {
    const payload = readJson(log.new_value);
    if (payload.email) return payload.email;
    if (payload.status) return `حالت: ${payload.status}`;
    if (payload.current_stage) return `مرحله: ${payload.current_stage}`;
    const entries = Object.entries(payload).filter(([key]) => !["actorName", "actorRole"].includes(key)).slice(0, 3);
    return entries.length ? entries.map(([key, value]) => `${key}: ${String(value)}`).join(" | ") : "";
  };
  const timeLabel = (value: any) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("ps-AF");
  };

  return (
    <>
      <PageMeta title="وروستی بررسی | Kandahar University WMS" description="د سیسټم د بشپړېدو وروستی امنیتي او تخنیکي چک لیست." />
      <Breadcrumb pageTitle="وروستی بررسی / بررسی نهایی QA" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="space-y-8">
        {loading ? (
          <div className="text-center py-20 italic">بارول...</div>
        ) : categories.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-2xl border">لا تر اوسه هیڅ د چک لیست ډاټا نشته.</div>
        ) : categories.map(cat => (
          <div key={cat} className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">{cat}</h3>
            <div className="space-y-3">
              {items.filter(i => i.category === cat).map(item => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex-1 min-w-[200px]">
                    <h4 className="font-bold text-gray-800 dark:text-white/90">{item.title}</h4>
                    <p className="text-xs text-gray-500 mt-1 italic">{item.notes || "یادښت نشته"}</p>
                    {item.checkedByName && (
                      <p className="text-[10px] text-primary mt-1 font-bold">
                        تایید شو د {item.checkedByName} لخوا په {item.checkedAtHijriShamsi}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.status === 'Passed' ? 'bg-green-100 text-green-700' : 
                      item.status === 'Failed' ? 'bg-red-100 text-red-700' : 
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {item.status === 'Passed' ? 'کامیاب ✅' : item.status === 'Failed' ? 'ناکام ❌' : 'په تمه ⏳'}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(item.id, item.status)}>تغیر</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]" dir="rtl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">وروستي حرکات / فعالیت‌های اخیر</h3>
            <Button variant="outline" size="sm" onClick={fetchChecklist}>تازه کول</Button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">بارول...</div>
          ) : activityLogs.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">تر اوسه فعالیت ثبت شوی نه دی.</div>
          ) : (
            <div className="space-y-3">
              {activityLogs.map((log, index) => (
                <div key={`${log.id || index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-white/90">
                        {actorLabel(log)}
                        <span className="mx-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {actionLabel(log.action)}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {entityLabel(log.entity_type)} {log.entity_id ? `#${log.entity_id}` : ""}
                        {log.ip_address ? ` | IP: ${log.ip_address}` : ""}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-gray-500">{timeLabel(log.created_at)}</span>
                  </div>
                  {detailLabel(log) && (
                    <p className="mt-2 text-xs text-gray-500">{detailLabel(log)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
