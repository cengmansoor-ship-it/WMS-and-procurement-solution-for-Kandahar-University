import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";
import SecureDeleteModal from "../../components/common/SecureDeleteModal";
import { apiClient } from "../../api/apiClient";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}

interface CreateBackupResult {
  filename?: string;
  latestFilename?: string;
  directory?: string;
}

function formatBytes(b: number): string {
  if (b < 1024)       return `${b} B`;
  if (b < 1024*1024)  return `${(b/1024).toFixed(1)} KB`;
  return `${(b/(1024*1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BackupManagement() {
  const { pick } = useLanguage();
  const { profile } = useAuth();
  const [backups, setBackups]       = useState<BackupFile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [deletingFile, setDeleting] = useState<string | null>(null);
  const [message, setMessage]       = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingDeleteFile, setPendingDeleteFile] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiClient.get("/backup/list")
      .then((res: any) => setBackups(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
      .catch(() => setBackups([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createBackup = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const res: CreateBackupResult = await apiClient.post("/backup/create", {});
      const displayName = res.latestFilename || res.filename || "";
      const location = res.directory ? ` (${res.directory})` : "";
      setMessage({
        type: "success",
        text: `${pick("SQL بیکپ بریالیتوب سره جوړ شو", "پشتیبان SQL موفق شد")}: ${displayName}${location}`,
      });
      load();
    } catch (err: any) {
      setMessage({ type: "error", text: pick("د بیکپ جوړولو کې ستونزه", "خطا در ایجاد پشتیبان") });
    } finally {
      setCreating(false);
    }
  };

  const deleteBackup = async (_reason: string) => {
    if (!pendingDeleteFile) return;
    const filename = pendingDeleteFile;
    setPendingDeleteFile(null);
    setDeleting(filename);
    try {
      await apiClient.delete(`/backup/${filename}`);
      setMessage({ type: "success", text: pick("بیکپ حذف شو", "پشتیبان حذف شد") });
      load();
    } catch {
      setMessage({ type: "error", text: pick("د حذف کولو کې ستونزه", "خطا در حذف") });
    } finally {
      setDeleting(null);
    }
  };

  const downloadBackup = (filename: string) => {
    window.open(`/api/backup/download/${encodeURIComponent(filename)}`, "_blank");
  };

  return (
    <>
      <PageMeta title="د بیکپ مدیریت | WMS" description="د سیستم خودکار بیکپ مدیریت" />
      <Breadcrumb pageTitle={pick("د بیکپ مدیریت", "مدیریت پشتیبان‌گیری")} />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="space-y-6">

        {/* Info banner */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800/40 p-5">
          <div className="flex items-start gap-4">
            <span className="text-3xl">💾</span>
            <div>
              <h3 className="font-bold text-blue-800 dark:text-blue-200 text-base">
                {pick("خودکار بیکپ سیستم", "سیستم پشتیبان‌گیری خودکار")}
              </h3>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                {pick(
                  "سیستم هر ۳ ساعته خودکار د ټول ډیټابیس MySQL SQL بیکپ جوړوي او مستقیم یې د پروژې Backup فولډر ته اچوي.",
                  "سیستم هر ۳ ساعت به‌طور خودکار پشتیبان MySQL SQL از کل پایگاه داده می‌سازد و مستقیم در پوشه Backup پروژه ذخیره می‌کند."
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <span className="bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-semibold">⏰ هر ۳ ساعت</span>
                <span className="bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-semibold">📊 SQL (.sql)</span>
                <span className="bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-semibold">🗂️ ټول جدولونه</span>
                <span className="bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-semibold">📁 تر ۵۰ فایله ذخیره</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:bg-white/[0.03] dark:border-gray-800 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-800 dark:text-white/90">
                {pick("د بیکپ فایلونه", "فایل‌های پشتیبان")}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {backups.length} {pick("بیکپ موجود", "پشتیبان موجود")}
              </p>
            </div>
            <button
              onClick={createBackup}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition disabled:opacity-50"
            >
              {creating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {pick("جوړیږي...", "در حال ساخت...")}
                </>
              ) : (
                <>💾 {pick("اوس بیکپ واخله", "پشتیبان‌گیری الان")}</>
              )}
            </button>
          </div>

          {message && (
            <div className={`mt-4 rounded-xl p-3 text-sm font-medium border ${
              message.type === "success"
                ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
                : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
            }`}>
              {message.type === "success" ? "✅" : "❌"} {message.text}
            </div>
          )}
        </div>

        {/* Backup files list */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:bg-white/[0.03] dark:border-gray-800 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-500 text-sm">{pick("بارول...", "بارگذاری...")}</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="text-5xl opacity-30">💾</span>
              <p className="text-gray-400 font-medium">{pick("هیڅ بیکپ نشته", "هیچ پشتیبانی یافت نشد")}</p>
              <p className="text-gray-400 text-sm">{pick("لومړی بیکپ واخله", "اولین پشتیبان را بگیرید")}</p>
            </div>
          ) : (
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  {[
                    pick("د فایل نوم", "نام فایل"),
                    pick("اندازه", "حجم"),
                    pick("جوړ شوي نیټه", "تاریخ ایجاد"),
                    pick("عملیات", "عملیات"),
                  ].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {backups.map((bf, idx) => (
                  <tr key={bf.filename} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${idx === 0 ? "bg-green-50/50 dark:bg-green-900/10" : ""}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📊</span>
                        <div>
                          <div className="font-mono text-xs text-gray-700 dark:text-gray-300">{bf.filename}</div>
                          {idx === 0 && (
                            <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">
                              {pick("وروستۍ بیکپ", "آخرین پشتیبان")}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400 font-medium">{formatBytes(bf.size)}</td>
                    <td className="px-5 py-4 text-gray-500 font-mono text-xs">{formatDate(bf.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => downloadBackup(bf.filename)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                        >
                          ⬇ {pick("ډاونلوډ", "دانلود")}
                        </button>
                        <button
                          onClick={() => setPendingDeleteFile(bf.filename)}
                          disabled={deletingFile === bf.filename}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 text-xs font-bold rounded-lg transition disabled:opacity-50"
                        >
                          {deletingFile === bf.filename ? pick("حذف کیږي...", "حذف...") : `🗑 ${pick("حذف", "حذف")}`}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Instructions */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:bg-white/[0.03] dark:border-gray-800 p-5">
          <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3">
            📋 {pick("د بهرني هارډ ډیسک ته د ذخیرې لارښود", "راهنمای ذخیره در هارد اکسترنال")}
          </h3>
          <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400" dir="rtl">
            <li className="flex items-start gap-2"><span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">۱</span><span>{pick("پورتنۍ لیست ته وګورئ او تر ټولو نوي بیکپ باندې کلیک وکړئ.", "به لیست بالا نگاه کنید و روی جدیدترین پشتیبان کلیک کنید.")}</span></li>
            <li className="flex items-start gap-2"><span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">۲</span><span>{pick("د بیکپ بټن باندې کلیک وکړئ. فایل به مستقیم د پروژې Backup فولډر ته ولاړ شي.", "روی دکمه پشتیبان کلیک کنید. فایل مستقیم در پوشه Backup پروژه ذخیره می‌شود.")}</span></li>
            <li className="flex items-start gap-2"><span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">۳</span><span>{pick("د Backup فولډر latest.sql فایل په بل کمپیوټر کې import کړئ.", "فایل latest.sql پوشه Backup را در کامپیوتر دیگر import کنید.")}</span></li>
            <li className="flex items-start gap-2"><span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">۴</span><span>{pick("سیستم پخپله هر ۳ ساعت نوی بیکپ جوړوي. تاسو اړ نه یاست چي لاسي یې جوړ کړئ.", "سیستم هر ۳ ساعت به‌طور خودکار پشتیبان جدید می‌سازد. نیازی به ساخت دستی نیست.")}</span></li>
          </ol>
        </div>

      </div>

      {pendingDeleteFile && (
        <SecureDeleteModal
          title={pick("⚠️ د بیکپ حذف کول", "⚠️ حذف پشتیبان")}
          description={`"${pendingDeleteFile}" ${pick("دایمي حذف کیږي.", "به صورت دایمی حذف می‌شود.")}`}
          currentUserEmail={profile?.email || ""}
          requireReason={true}
          onCancel={() => setPendingDeleteFile(null)}
          onConfirm={deleteBackup}
        />
      )}
    </>
  );
}

