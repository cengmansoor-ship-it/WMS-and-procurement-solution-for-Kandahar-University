import { useEffect, useState, useMemo } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Button from "../../components/ui/button/Button";
import { getRequests, InventoryRequest } from "../../firebase/requests";
import { getEmailLogs, saveEmailDraft } from "../../firebase/notifications";
import type { DemoEmailLog } from "../../firebase/localStore";
import { useLanguage } from "../../context/LanguageContext";
import { useCalendar } from "../../context/CalendarContext";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

const LEVELS_PS = ["ډېر عاجل", "ډېر مهم", "متوسط", "عادي", "لږ مهم"];
const LEVELS_DR = ["بسیار عاجل", "بسیار مهم", "متوسط", "عادی", "کم‌اهمیت"];

const STATUS_PS: Record<string, string> = {
  Submitted: "لیږل شوی", ConfirmedByRequestConfirmer: "تایید شوی",
  ApprovedBySuperAdmin: "منل شوی", StockAvailable: "جنس شتون لري",
  StockNotAvailable: "جنس نشته", ProcurementPending: "تدارکاتو ته لیږل شو", Delivered: "تسلیم شو",
};
const STATUS_DR: Record<string, string> = {
  Submitted: "ارسال شد", ConfirmedByRequestConfirmer: "تأیید شد",
  ApprovedBySuperAdmin: "تصویب شد", StockAvailable: "موجود است",
  StockNotAvailable: "موجود نیست", ProcurementPending: "به تدارکات ارسال شد", Delivered: "تحویل داده شد",
};

export default function NotificationsPage() {
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [logs, setLogs] = useState<DemoEmailLog[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [form, setForm] = useState({
    to: "",
    subject: "",
    body: "",
    requestId: "",
    requestLevel: "عادي",
  });
  const { pick, lang } = useLanguage();
  const { pickDate } = useCalendar();

  const levels = lang === "dr" ? LEVELS_DR : LEVELS_PS;
  const ALL_LABEL = pick("ټولې درجې", "همه درجه‌ها");
  const statusMap = lang === "dr" ? STATUS_DR : STATUS_PS;

  const load = async () => {
    const [reqs, emailLogs] = await Promise.all([getRequests(), getEmailLogs()]);
    setRequests(reqs);
    const seen = new Set<string>();
    const deduped = emailLogs.filter(l => {
      const key = `${l.to}|${l.subject}|${l.createdAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setLogs(deduped);
  };

  useEffect(() => { load(); }, []);

  // Pre-fill from URL params (e.g., from RR Print button)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestIdFromUrl = params.get('requestId');
    const toFromUrl = params.get('to');
    if (requestIdFromUrl && toFromUrl !== null && requests.length > 0) {
      const req = requests.find(r => r.id === requestIdFromUrl);
      if (req) {
        const statusLabel = statusMap[req.status] || req.status;
        setForm({
          requestId: requestIdFromUrl,
          to: toFromUrl,
          requestLevel: req.currentRequestLevel,
          subject: pick(
            `د غوښتنې خبرتیا — ${req.faculty}`,
            `اطلاع‌رسانی درخواست — ${req.faculty}`
          ),
          body: pick(
            `سلامونه ${req.requesterName}،\n\nستاسې غوښتنه (${req.faculty} — ${req.departmentOrPerson}) د ${req.currentRequestLevel} درجې سره د "${statusLabel}" مرحلې پر بنسټ ده.\n\nمهرباني وکړئ د سیستم له لارې پرمختګ وګورئ.\n\nمننه\nد کندهار پوهنتون د اجناسو مدیریت`,
            `سلام ${req.requesterName}،\n\nدرخواست شما (${req.faculty} — ${req.departmentOrPerson}) با درجه ${req.currentRequestLevel} در مرحله "${statusLabel}" قرار دارد.\n\nلطفاً از طریق سیستم پیشرفت را دنبال کنید.\n\nبا احترام\nانبار پوهنتون کندهار`
          ),
        });
        // Clean URL params after pre-fill
        window.history.replaceState({}, '', '/notifications');
      }
    }
  }, [requests]);

  useEffect(() => {
    setForm(prev => ({ ...prev, requestLevel: levels[3] }));
  }, [lang]);

  const handleSelectRequest = (requestId: string) => {
    const req = requests.find(r => r.id === requestId);
    const statusLabel = req ? (statusMap[req.status] || req.status) : "";
    setForm(prev => ({
      ...prev,
      requestId,
      requestLevel: req?.currentRequestLevel || prev.requestLevel,
      to: "",
      subject: req
        ? pick(`د غوښتنې خبرتیا — ${req.faculty}`, `اطلاع‌رسانی درخواست — ${req.faculty}`)
        : prev.subject,
      body: req
        ? pick(
            `سلامونه ${req.requesterName}،\n\nستاسې غوښتنه (${req.faculty} — ${req.departmentOrPerson}) د ${req.currentRequestLevel} درجې سره د "${statusLabel}" مرحلې پر بنسټ ده.\n\nمهرباني وکړئ د سیستم له لارې پرمختګ وګورئ.\n\nمننه\nد کندهار پوهنتون د اجناسو مدیریت`,
            `سلام ${req.requesterName}،\n\nدرخواست شما (${req.faculty} — ${req.departmentOrPerson}) با درجه ${req.currentRequestLevel} در مرحله "${statusLabel}" قرار دارد.\n\nلطفاً از طریق سیستم پیشرفت را دنبال کنید.\n\nبا احترام\nانبار پوهنتون کندهار`
          )
        : prev.body,
    }));
  };

  const handleSend = async () => {
    if (!form.to.trim()) {
      setMsg({ text: pick("مهرباني وکړئ د ایمیل پته ولیکئ.", "لطفاً آدرس ایمیل را وارد کنید."), type: "error" });
      return;
    }
    if (!form.subject.trim() || !form.body.trim()) {
      setMsg({ text: pick("موضوع او متن ډک کړئ.", "موضوع و متن را پر کنید."), type: "error" });
      return;
    }
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: form.to, subject: form.subject, body: form.body }),
      });
      const data = await res.json();

      if (data.success) {
        await saveEmailDraft({ to: form.to, subject: form.subject, body: form.body, relatedRequestId: form.requestId, requestLevel: form.requestLevel, status: "Sent" });
        await load();
        setMsg({ text: pick(`✅ ایمیل ${form.to} ته وفرستل شو.`, `✅ ایمیل به ${form.to} ارسال شد.`), type: "success" });
        setForm(prev => ({ ...prev, to: "", subject: "", body: "", requestId: "" }));
      } else if (data.message === "SMTP_NOT_CONFIGURED") {
        setMsg({
          text: pick(
            "⚙️ SMTP تنظیم شوی نه دی. مهرباني وکړئ د سیستم مدیر سره اړیکه ونیسئ چې SMTP_USER او SMTP_PASS چاپیریال متغیرونه وټاکي.",
            "⚙️ SMTP پیکربندی نشده است. لطفاً با مدیر سیستم تماس بگیرید تا SMTP_USER و SMTP_PASS را تنظیم کند."
          ),
          type: "info",
        });
        await saveEmailDraft({ to: form.to, subject: form.subject, body: form.body, relatedRequestId: form.requestId, requestLevel: form.requestLevel, status: "Draft" });
        await load();
      } else {
        throw new Error(data.message);
      }
    } catch (e: any) {
      setMsg({
        text: pick(
          `تېروتنه: ${e.message || "بیا هڅه وکړئ"}`,
          `خطا: ${e.message || "دوباره تلاش کنید"}`
        ),
        type: "error",
      });
    } finally {
      setSending(false);
      setTimeout(() => setMsg(null), 10000);
    }
  };

  const visibleLogs = useMemo(
    () => logs.filter(l => filter === "ALL" || l.requestLevel === filter),
    [logs, filter]
  );

  return (
    <>
      <PageMeta title={pick("خبرتیاوې", "اعلانات") + " | Kandahar University WMS"} description="" />
      <Breadcrumb pageTitle="خبرتیاوې / اعلانات" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="space-y-6 page-enter" dir="rtl">
        {msg && (
          <div className={`rounded-xl border p-4 text-sm flex items-start gap-3 animate-slide-down ${
            msg.type === "success"
              ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
              : msg.type === "info"
              ? "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
          }`}>
            <span className="leading-relaxed">{msg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Compose */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-slide-up card-interactive" style={{ animationDelay: "60ms" }}>
            <h2 className="mb-4 text-lg font-bold text-gray-800 dark:text-white/90">✉️ {pick("ایمیل استول", "ارسال ایمیل")}</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {pick("اړوند غوښتنه (اختیاري)", "درخواست مرتبط (اختیاری)")}
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-right text-sm text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                  value={form.requestId} onChange={e => handleSelectRequest(e.target.value)}>
                  <option value="">— {pick("بې له غوښتنې", "بدون درخواست")} —</option>
                  {requests.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.faculty} — {r.requesterName} ({r.currentRequestLevel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {pick("د ترلاسه کوونکي ایمیل", "ایمیل گیرنده")} <span className="text-red-500">*</span>
                </label>
                <input type="email"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-right text-sm text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                  value={form.to} onChange={e => setForm({ ...form, to: e.target.value })}
                  placeholder="example@gmail.com" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {pick("درجه", "درجه")}
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-right text-sm text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                  value={form.requestLevel} onChange={e => setForm({ ...form, requestLevel: e.target.value })}>
                  {levels.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {pick("موضوع", "موضوع")} <span className="text-red-500">*</span>
                </label>
                <input type="text"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-right text-sm text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                  value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                  placeholder={pick("د ایمیل موضوع...", "موضوع ایمیل...")} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {pick("متن", "متن")} <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="h-36 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-right text-sm text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white/90 resize-none"
                  value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
                  placeholder={pick("د ایمیل متن...", "متن ایمیل...")} />
              </div>

              <Button onClick={handleSend} disabled={sending} fullWidth>
                {sending
                  ? pick("استول...", "در حال ارسال...")
                  : `📤 ${pick("ایمیل استول", "ارسال ایمیل")}`}
              </Button>
            </div>
          </div>

          {/* History */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-slide-up card-interactive" style={{ animationDelay: "120ms" }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">📋 {pick("د ایمیل تاریخچه", "تاریخچه ایمیل")}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{visibleLogs.length} {pick("ایمیل", "ایمیل")}</span>
                <select
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-right text-xs text-gray-700 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  value={filter} onChange={e => setFilter(e.target.value)}>
                  <option value="ALL">{ALL_LABEL}</option>
                  {levels.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
              {visibleLogs.length === 0 ? (
                <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
                  {pick("تاریخچه نشته.", "تاریخچه‌ای وجود ندارد.")}
                </div>
              ) : (
                visibleLogs.map((log, idx) => (
                  <div key={log.id}
                    className="rounded-xl border border-gray-100 p-4 dark:border-gray-700 dark:bg-white/[0.02] animate-fade-in hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
                    style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-sm text-gray-800 dark:text-white/90 leading-tight">{log.subject}</strong>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                        log.status === "Sent"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : log.status === "Queued"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      }`}>
                        {log.status === "Sent"
                          ? pick("استول شوی", "ارسال شد")
                          : log.status === "Queued"
                          ? pick("انتظار", "در انتظار")
                          : pick("مسوده", "پیش‌نویس")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {log.to} · {pickDate(log.createdAtHijriShamsi || "", log.createdAtHijriQamari || "")} · {log.requestLevel}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{log.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
