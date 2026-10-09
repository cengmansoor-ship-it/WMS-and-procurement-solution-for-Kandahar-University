import React, { useState } from "react";
import Label from "../form/Label";
import { updateRequestStage, changeRequestLevel, PipelineRecord } from "../../firebase/requests";
import { useLanguage } from "../../context/LanguageContext";
import WmsDialog from "../common/WmsDialog";

interface ConfirmerPanelProps {
  requestId: string;
  currentStatus: string;
  currentLevel: string;
  user: { uid: string; name: string; role: string };
  onUpdate: () => void;
  superAdminComment?: string;
  pipeline?: PipelineRecord[];
}

const REQUEST_LEVELS = [
  { ps: "ډېر عاجل", dr: "بسیار عاجل" },
  { ps: "ډېر مهم", dr: "بسیار مهم" },
  { ps: "متوسط", dr: "متوسط" },
  { ps: "عادي", dr: "عادی" },
  { ps: "لږ مهم", dr: "کماهمیت" },
];

const ConfirmerPanel: React.FC<ConfirmerPanelProps> = ({
  requestId, currentStatus, currentLevel, user, onUpdate, superAdminComment, pipeline = []
}) => {
  const [comment, setComment] = useState("");
  const [newLevel, setNewLevel] = useState(currentLevel);
  const [loading, setLoading] = useState(false);
  const [warnMsg, setWarnMsg] = useState("");
  const { pick } = useLanguage();

  // 'Submitted' must NOT be here: existing requests at Submitted still need the Confirmer
  // to perform the final confirm step. approveReview now goes to ConfirmedByRequestConfirmer
  // directly for new requests, so 'Submitted' only appears in backward-compat pipelines.
  const CONFIRMER_FINAL_STATUSES = [
    'ConfirmedByRequestConfirmer', 'RejectedByRequestConfirmer', 'ReviewReturned',
    'DeliveryConfirmedByRequestConfirmer', 'DeliveryRejectedByRequestConfirmer',
    'DeliveryReviewReturned',
  ];

  const isDeliveryRound =
    currentStatus.startsWith('Delivery') ||
    pipeline.some(e => ['FS5Required', 'DeliveryFormsRequested', 'DeliveryFormsSubmitted'].includes(e.status));

  // Only look at pipeline entries SINCE the last time status became PendingReview,
  // so a Confirmer who acted in round 1 is not blocked in round 2.
  const lastPendingReviewIdx = pipeline.reduce(
    (idx, entry, i) =>
      (entry.status === 'PendingReview' || entry.status === 'DeliveryFormsSubmitted' ? i : idx),
    -1
  );
  const currentRoundPipeline = lastPendingReviewIdx >= 0
    ? pipeline.slice(lastPendingReviewIdx + 1)
    : pipeline;

  const alreadyActed =
    !["ReturnedToConfirmer", "DeliveryReturnedToConfirmer"].includes(currentStatus) &&
    currentRoundPipeline.some(
      e => CONFIRMER_FINAL_STATUSES.includes(e.status) &&
           (e.actionBy === user.uid || e.actionByName === user.name)
    );

  const isPendingReview      = currentStatus === "PendingReview" || currentStatus === "DeliveryFormsSubmitted";
  const isSubmitted          = currentStatus === "Submitted";
  const isReturnedToConfirmer =
    currentStatus === "ReturnedToConfirmer" || currentStatus === "DeliveryReturnedToConfirmer";

  const handleAction = async (
    action: "approveReview" | "returnReview" | "confirm" | "reject" | "returnToRequester"
  ) => {
    if ((action === "returnReview" || action === "reject" || action === "returnToRequester") && !comment.trim()) {
      setWarnMsg(pick("مهرباني وکړئ خپله ملاحظه ولیکئ.", "لطفاً نظر خود را بنویسید."));
      return;
    }
    setLoading(true);
    try {
      if (newLevel !== currentLevel) {
        await changeRequestLevel(requestId, newLevel, currentLevel, user, pick("درجه بدلون", "تغییر درجه"));
      }

      let status = "";
      let progress = 0;
      let stage = "";
      const finalComment = comment.trim();

      if (action === "approveReview") {
        status   = isDeliveryRound ? "DeliveryConfirmedByRequestConfirmer" : "ConfirmedByRequestConfirmer";
        progress = isDeliveryRound ? 86 : 5;
        stage    = pick("تاییدوونکي لخوا تایید شوه — مقام ته واستول شوه", "توسط تأییدکننده تأیید شد — ارسال به مقام");
      } else if (action === "returnReview") {
        status   = isDeliveryRound ? "DeliveryReviewReturned" : "ReviewReturned";
        progress = isDeliveryRound ? 82 : 0;
        stage    = pick("بیرته د سمولو لپاره راستانه شوه", "برای اصلاح بازگردانده شد");
      } else if (action === "returnToRequester") {
        status   = isDeliveryRound ? "DeliveryReviewReturned" : "ReviewReturned";
        progress = isDeliveryRound ? 82 : 0;
        stage    = pick("تایید کوونکي لخوا غوښتونکي ته بیرته راستانه شوه", "توسط تأییدکننده به درخواست‌دهنده بازگردانده شد");
      } else if (action === "confirm") {
        status   = isDeliveryRound ? "DeliveryConfirmedByRequestConfirmer" : "ConfirmedByRequestConfirmer";
        progress = isDeliveryRound ? 86 : 5;
        stage    = pick("تاییدوونکي لخوا تایید شوه", "توسط تأییدکننده تأیید شد");
      } else {
        status   = isDeliveryRound ? "DeliveryRejectedByRequestConfirmer" : "RejectedByRequestConfirmer";
        progress = isDeliveryRound ? 82 : 0;
        stage    = pick("تاییدوونکي لخوا رد شوه", "توسط تأییدکننده رد شد");
      }

      await updateRequestStage(requestId, status, progress, stage, user, finalComment);
      onUpdate();
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (alreadyActed) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-300 dark:border-amber-700/50 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <h3 className="text-base font-bold text-amber-800 dark:text-amber-200">
              {pick("تاسو دمخه دا غوښتنه تاید کړې ده!", "شما قبلاً این درخواست را تأیید کرده‌اید!")}
            </h3>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              {pick(
                "یو یوزر یوازې یو ځل کولی شي غوښتنه تاید کړي.",
                "هر کاربر فقط یک بار می‌تواند درخواست را تأیید کند."
              )}
            </p>
            {currentRoundPipeline.length > 0 && (
              <p className="text-xs text-amber-500 dark:text-amber-500 mt-2">
                🕐 {pick("وروستي عمل:", "آخرین اقدام:")} {currentRoundPipeline[currentRoundPipeline.length - 1].stage || currentRoundPipeline[currentRoundPipeline.length - 1].status}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    {warnMsg && (
      <WmsDialog
        type="warning"
        title={pick("پاملرنه", "توجه")}
        message={warnMsg}
        confirmText={pick("ښه", "باشه")}
        onConfirm={() => setWarnMsg("")}
      />
    )}
    <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">

      {/* Pre-review mode banner */}
      {isPendingReview && (
        <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/40 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">🔍</span>
            <div>
              <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                {pick("د لومړني بیاکتنې حالت", "حالت پیش‌بررسی")}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                {pick(
                  "دا غوښتنه د بیاکتنې لپاره راستانه شوه. که سمه وي نو تاید کړئ چي مستقیم مقام ته واستول سي. که کومه ملاحظه وي نو ورته ولیکئ او بیرته یې راستانه کړئ.",
                  "این درخواست برای بررسی ارسال شده است. اگر درست است تأیید کنید تا مستقیماً به مقام ارسال شود. اگر نظری دارید بنویسید و بازگردانید."
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Returned from SuperAdmin banner */}
      {isReturnedToConfirmer && superAdminComment && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/40 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">↩️</span>
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                {pick("د مقام لخوا ستاسو ته راستانه شوه", "توسط مقام به شما بازگردانده شد")}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 font-medium">
                {pick("د مقام ملاحظه:", "نظر مقام:")} {superAdminComment}
              </p>
            </div>
          </div>
        </div>
      )}

      <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">
        {isPendingReview
          ? pick("پینل بیاکتنه / لومړنۍ بررسي", "پنل پیش‌بررسی")
          : isReturnedToConfirmer
            ? pick("د مقام ملاحظه — بیا واستوئ", "نظر مقام — دوباره ارسال کنید")
            : pick("د تایید کوونکي عمل", "پنل تأییدکننده")}
      </h3>

      <div className="space-y-4">
        <div>
          <Label>{pick("د غوښتنې درجه بدلون (اختیاري):", "تغییر درجه درخواست (اختیاری):")}</Label>
          <select
            className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:text-white/90 text-right"
            value={newLevel}
            onChange={e => setNewLevel(e.target.value)}
          >
            {REQUEST_LEVELS.map(l => (
              <option key={l.ps} value={l.ps}>{l.ps} / {l.dr}</option>
            ))}
          </select>
        </div>

        {/* Comment field */}
        <div>
          <Label>
            {pick("ملاحظه (د بیرته راستانه یا رد لپاره لازمي ده):", "نظر (برای بازگشت یا رد الزامی است):")}
          </Label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:text-white/90 text-right"
            rows={3}
            placeholder={
              isPendingReview
                ? pick("ستاسو ملاحظات دلته ولیکئ...", "نظرات خود را اینجا بنویسید...")
                : pick("خپل نظر دلته ولیکئ...", "نظر خود را اینجا بنویسید...")
            }
          />
        </div>

        {/* Buttons — same 3 actions at every Confirmer stage */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              onClick={() => handleAction(isPendingReview ? "approveReview" : "confirm")}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm"
            >
              {loading ? pick("بارول...", "بارگذاری...")
                : pick("✔ تاییدول — مقام ته", "✔ تأیید — ارسال به مقام")}
            </button>
            <button
              onClick={() => handleAction(isPendingReview ? "returnReview" : "returnToRequester")}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition disabled:opacity-50 text-sm"
            >
              {loading ? pick("بارول...", "بارگذاری...")
                : pick("↩ بیرته غوښتونکي ته", "↩ بازگشت به درخواست‌دهنده")}
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-sm"
            >
              {loading ? pick("بارول...", "بارگذاری...") : pick("✗ ردول", "✗ رد")}
            </button>
          </div>
          <p className="text-xs text-gray-500 text-right dark:text-gray-400">
            {pick(
              "• تاییدول: مقام ته واستول | • بیرته: غوښتونکي ته راستانه | • ردول: دایمي رد (ملاحظه لازمه ده)",
              "• تأیید: ارسال به مقام | • بازگشت: به درخواست‌دهنده | • رد: رد دائمی (نظر الزامی)"
            )}
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export default ConfirmerPanel;
