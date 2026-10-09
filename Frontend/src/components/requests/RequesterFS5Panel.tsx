import { useState } from "react";
import { updateRequestStage } from "../../firebase/requests";
import { useLanguage } from "../../context/LanguageContext";

interface RequesterFS5PanelProps {
  requestId: string;
  user: { uid: string; name: string; role: string };
  onUpdate: () => void;
  onOpenFS5Form?: () => void;
  onOpenProposalForm?: () => void;
  onCreateAndSubmit?: () => Promise<void>;
  hasFS5?: boolean;
  hasProposal?: boolean;
}

export default function RequesterFS5Panel({
  requestId,
  user,
  onUpdate,
  onOpenFS5Form,
  onOpenProposalForm,
  onCreateAndSubmit,
  hasFS5 = false,
  hasProposal = false,
}: RequesterFS5PanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { pick } = useLanguage();

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (onCreateAndSubmit) {
        await onCreateAndSubmit();
        onUpdate();
        return;
      }
      await updateRequestStage(
        requestId,
        "DeliveryFormsSubmitted",
        84,
        pick("ف.س-۵ او پیشنهاد واستول شول — بیاکتنې ته", "ف.س-۵ و پروپوزل ارسال شد — برای بررسی"),
        { uid: user.uid, name: user.name, role: user.role },
        pick("غوښتونکي ف.س-۵ او پیشنهاد برابر کړل او واستول یې", "درخواست‌کننده ف.س-۵ و پروپوزل آماده کرد و ارسال نمود")
      );
      onUpdate();
    } catch (err) {
      setError(pick("خوندي کول ناکام شول.", "ذخیره‌سازی ناموفق بود."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-800/50 bg-white dark:bg-white/[0.03] shadow-sm overflow-hidden">
      <div className="bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h3 className="text-base font-bold text-purple-800 dark:text-purple-200">
              {pick("د ف،س،۵ او پیشنهاد غوښتنه", "درخواست فرم ف.س-۵ و پروپوزل")}
            </h3>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
              {pick(
                "د ګدام مدیر غوښتنه کړې چي ف،س،۵ او پیشنهاد برابر کړئ",
                "مدیر انبار درخواست کرده که فرم ف.س-۵ و پروپوزل را آماده کنید"
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
            {pick(
              "په لاندې یوه بټن سره پیشنهاد او ف.س-۵ د غوښتنې له معلوماتو اتومات جوړېږي او تایید کوونکي ته استول کېږي.",
              "با دکمه زیر، پیشنهاد و ف.س-۵ از معلومات درخواست به‌صورت خودکار ایجاد و به تأییدکننده ارسال می‌شود."
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onOpenProposalForm}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition font-medium text-sm ${
              hasProposal
                ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                : "border-gray-300 dark:border-gray-600 hover:border-purple-400 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            }`}
          >
            <span className="text-2xl">{hasProposal ? "✅" : "📄"}</span>
            <span>{pick("پیشنهاد", "پروپوزل")}</span>
            {hasProposal && (
              <span className="text-xs font-bold text-green-600 dark:text-green-400">
                {pick("ډک شوی", "تکمیل شده")}
              </span>
            )}
          </button>

          <button
            onClick={onOpenFS5Form}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition font-medium text-sm ${
              hasFS5
                ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                : "border-gray-300 dark:border-gray-600 hover:border-purple-400 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            }`}
          >
            <span className="text-2xl">{hasFS5 ? "✅" : "📝"}</span>
            <span>ف،س،۵</span>
            {hasFS5 && (
              <span className="text-xs font-bold text-green-600 dark:text-green-400">
                {pick("ډک شوی", "تکمیل شده")}
              </span>
            )}
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl transition text-sm shadow-sm"
        >
          {loading
            ? pick("فورمونه جوړېږي او استول کېږي...", "فرم‌ها ایجاد و ارسال می‌شوند...")
            : pick("✓ پیشنهاد + ف.س-۵ جوړ او تایید کوونکي ته واستوئ", "✓ ایجاد پیشنهاد + ف.س-۵ و ارسال به تأییدکننده")}
        </button>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
          {pick(
            "• واستولو وروسته: کنفرمر → مقام → آډمین → ګدام مدیر → نهایي سپارنه",
            "• پس از ارسال: تأییدکننده ← مقام ← ادمین ← مدیر انبار ← تحویل نهایی"
          )}
        </p>
      </div>
    </div>
  );
}
