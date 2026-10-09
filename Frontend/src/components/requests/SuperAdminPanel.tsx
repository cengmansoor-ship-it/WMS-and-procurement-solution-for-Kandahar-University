import React, { useState } from "react";
import Label from "../form/Label";
import { updateRequestStage, PipelineRecord } from "../../firebase/requests";
import WmsDialog from "../common/WmsDialog";

interface SuperAdminPanelProps {
  requestId: string;
  currentStatus: string;
  user: { uid: string, name: string, role: string };
  onUpdate: () => void;
  pipeline?: PipelineRecord[];
}

const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({ requestId, currentStatus, user, onUpdate, pipeline = [] }) => {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [warnMsg, setWarnMsg] = useState("");

  const isDeliveryRound =
    currentStatus.startsWith('Delivery') ||
    pipeline.some(e => ['FS5Required', 'DeliveryFormsRequested', 'DeliveryFormsSubmitted'].includes(e.status));
  const SA_OUTPUT_STATUSES = [
    'ApprovedBySuperAdmin', 'RejectedBySuperAdmin', 'ReturnedToConfirmer',
    'DeliveryApprovedBySuperAdmin', 'DeliveryRejectedBySuperAdmin', 'DeliveryReturnedToConfirmer',
  ];

  // Reset round whenever status becomes ConfirmedByRequestConfirmer OR ReturnedToSuperAdmin.
  // This prevents a prior ApprovedBySuperAdmin entry from blocking the SA after Admin returns.
  const lastResetIdx = pipeline.reduce(
    (idx, entry, i) =>
      (entry.status === 'ConfirmedByRequestConfirmer' ||
       entry.status === 'ReturnedToSuperAdmin' ||
       entry.status === 'DeliveryConfirmedByRequestConfirmer' ||
       entry.status === 'DeliveryReturnedToSuperAdmin')
        ? i : idx,
    -1
  );
  const currentRoundPipeline = lastResetIdx >= 0
    ? pipeline.slice(lastResetIdx + 1)
    : pipeline;

  // When Admin returned to SuperAdmin, the SA must act again — never block.
  const alreadyActed =
    !['ReturnedToSuperAdmin', 'DeliveryReturnedToSuperAdmin'].includes(currentStatus) &&
    currentRoundPipeline.some(
      e => SA_OUTPUT_STATUSES.includes(e.status) &&
           (e.actionBy === user.uid || e.actionByName === user.name)
    );

  const handleAction = async (action: 'approve' | 'reject' | 'returnToConfirmer') => {
    if ((action === 'reject' || action === 'returnToConfirmer') && !comment.trim()) {
      setWarnMsg("مهرباني وکړئ ملاحظه ولیکئ. / لطفاً نظر بنویسید.");
      return;
    }
    setLoading(true);
    try {
      let status = "";
      let progress = 0;
      let stage = "";
      let finalComment = comment.trim();

      if (action === 'approve') {
        status   = isDeliveryRound ? 'DeliveryApprovedBySuperAdmin' : 'ApprovedBySuperAdmin';
        progress = isDeliveryRound ? 88 : 30;
        stage    = 'د مقام تایید / تایید مقام';
      } else if (action === 'returnToConfirmer') {
        status   = isDeliveryRound ? 'DeliveryReturnedToConfirmer' : 'ReturnedToConfirmer';
        progress = isDeliveryRound ? 84 : 0;
        stage    = 'د مقام لخوا تایید کوونکي ته راستانه شوه / توسط مقام به تأییدکننده بازگردانده شد';
      } else {
        status   = isDeliveryRound ? 'DeliveryRejectedBySuperAdmin' : 'RejectedBySuperAdmin';
        progress = isDeliveryRound ? 82 : 0;
        stage    = 'د مقام لخوا رد / رد مقام';
      }

      await updateRequestStage(requestId, status, progress, stage, user, finalComment);
      onUpdate();
    } catch (error) {
      console.error("Action failed:", error);
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
              تاسو دمخه دا غوښتنه تاید کړې ده! / شما قبلاً این درخواست را تأیید کرده‌اید!
            </h3>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              یو یوزر یوازې یو ځل کولی شي غوښتنه تاید کړي. / هر کاربر فقط یک بار می‌تواند درخواست را تأیید کند.
            </p>
            {currentRoundPipeline.length > 0 && (
              <p className="text-xs text-amber-500 dark:text-amber-500 mt-2">
                🕐 وروستي عمل: {currentRoundPipeline[currentRoundPipeline.length - 1].stage || currentRoundPipeline[currentRoundPipeline.length - 1].status}
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
        title="پاملرنه / توجه"
        message={warnMsg}
        confirmText="ښه / باشه"
        onConfirm={() => setWarnMsg("")}
      />
    )}
    <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm border-t-4 border-t-primary">
      <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">
        د مقام تایید / پنل مقام
      </h3>

      <div className="space-y-4">
        <div>
          <Label>ملاحظه / احکام (د بیرته راستلو یا رد لپاره لازمي دي):</Label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:text-white/90 text-right"
            rows={3}
            placeholder="د مقام حکم یا ملاحظه دلته ولیکئ..."
          />
        </div>

        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              onClick={() => handleAction('approve')}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm"
            >
              {loading ? "بارول..." : "✔ تاییدول — اډمین ته"}
            </button>
            <button
              onClick={() => handleAction('returnToConfirmer')}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition disabled:opacity-50 text-sm"
            >
              {loading ? "بارول..." : "↩ بیرته راګرځول"}
            </button>
            <button
              onClick={() => handleAction('reject')}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-sm"
            >
              {loading ? "بارول..." : "✗ ردول"}
            </button>
          </div>
          <p className="text-xs text-gray-500 text-right dark:text-gray-400">
            • تاییدول: اډمین ته واستول | • بیرته راګرځول: تایید کوونکي ته (ملاحظه لازمه ده) | • ردول: دایمي رد (ملاحظه لازمه ده)
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export default SuperAdminPanel;
