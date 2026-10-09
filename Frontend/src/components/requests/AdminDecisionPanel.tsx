import React, { useEffect, useState } from "react";
import Label from "../form/Label";
import { updateRequestStage, checkStockAvailability, RequestItem, PipelineRecord } from "../../firebase/requests";
import WmsDialog from "../common/WmsDialog";

interface AdminDecisionPanelProps {
  requestId: string;
  items: RequestItem[];
  user: { uid: string, name: string, role: string };
  onUpdate: () => void;
  pipeline?: PipelineRecord[];
}

interface StockStatus {
  itemId: string;
  name: string;
  requested: number;
  available: number;
  isAvailable: boolean;
  shortage: number;
}

const AdminDecisionPanel: React.FC<AdminDecisionPanelProps> = ({ requestId, items, user, onUpdate, pipeline = [] }) => {
  const [stockInfo, setStockInfo] = useState<{ allAvailable: boolean; results: StockStatus[] } | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [warnMsg, setWarnMsg] = useState("");

  const isDeliveryRound = pipeline.some(e =>
    ['FS5Required', 'DeliveryFormsRequested', 'DeliveryFormsSubmitted',
      'DeliveryApprovedBySuperAdmin'].includes(e.status)
  );
  const ADMIN_OUTPUT_STATUSES = [
    'StockAvailable', 'StockNotAvailable', 'RejectedByAdmin', 'ReturnedToSuperAdmin',
    'DeliveryReferredToWarehouse', 'DeliveryRejectedByAdmin', 'DeliveryReturnedToSuperAdmin',
  ];

  // Only check entries SINCE the last time status became 'ApprovedBySuperAdmin'
  // so Admin is not blocked in round 2 by their own round-1 routing action.
  const lastApprovedIdx = pipeline.reduce(
    (idx, entry, i) =>
      (entry.status === 'ApprovedBySuperAdmin' || entry.status === 'DeliveryApprovedBySuperAdmin' ? i : idx),
    -1
  );
  const currentRoundPipeline = lastApprovedIdx >= 0
    ? pipeline.slice(lastApprovedIdx + 1)
    : pipeline;

  const alreadyActed = currentRoundPipeline.some(
    e => ADMIN_OUTPUT_STATUSES.includes(e.status) &&
         (e.actionBy === user.uid || e.actionByName === user.name)
  );

  useEffect(() => {
    (async () => {
      try {
        const results = await checkStockAvailability(items);
        setStockInfo({ allAvailable: results.every(r => r.isAvailable), results });
      } catch {
        setStockInfo({ allAvailable: true, results: [] });
      }
    })();
  }, [items]);

  const handleDecision = async (decision: 'warehouse' | 'procurement' | 'returnToSuperAdmin' | 'reject') => {
    if ((decision === 'returnToSuperAdmin' || decision === 'reject') && !comment.trim()) {
      setWarnMsg('مهرباني وکړئ خپله ملاحظه ولیکئ. / لطفاً نظر خود را بنویسید.');
      return;
    }
    setLoading(true);
    try {
      let status, progress, stage;
      if (decision === 'warehouse') {
        status = isDeliveryRound ? 'DeliveryReferredToWarehouse' : 'StockAvailable';
        progress = isDeliveryRound ? 90 : 60;
        stage = 'ګودام ته راجع شو / ارجاع به ګدام';
      } else if (decision === 'procurement') {
        status = 'StockNotAvailable'; progress = 35;
        stage = 'تدارکاتو ته راجع شو / ارجاع به تدارکات';
      } else if (decision === 'returnToSuperAdmin') {
        status = isDeliveryRound ? 'DeliveryReturnedToSuperAdmin' : 'ReturnedToSuperAdmin';
        progress = isDeliveryRound ? 88 : 0;
        stage = 'بیا کتنې ته سوپر اډمین ته راستانه شوه / به سوپر ادمین برگشت داده شد';
      } else {
        status = isDeliveryRound ? 'DeliveryRejectedByAdmin' : 'RejectedByAdmin';
        progress = isDeliveryRound ? 82 : 0;
        stage = 'د اډمین لخوا رد شوه / توسط ادمین رد شد';
      }
      await updateRequestStage(requestId, status, progress, stage, user, comment);
      onUpdate();
    } catch (error) {
      console.error("Decision failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const shouldWarn = stockInfo && !stockInfo.allAvailable && stockInfo.results.length > 0;

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
    <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">
        د اډمین پریکړه / پنل ادمین
      </h3>
      
      <div className="space-y-6">
        {!isDeliveryRound && stockInfo && stockInfo.results.length > 0 && (
          <div className={`p-4 rounded-xl text-center font-bold border-2 ${
            shouldWarn
              ? 'bg-red-50 text-red-700 border-red-300'
              : 'bg-green-50 text-green-700 border-green-300'
          }`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              {shouldWarn ? '⚠️' : '✅'}
              <span>
                {shouldWarn
                  ? "ځینې اجناس په ګدام کې نشته! / بعضی اجناس در ګدام موجود نیست!"
                  : "ټول اجناس په ګدام کې موجود دي. / تمام اجناس در ګدام موجود است."}
              </span>
            </div>
            {shouldWarn && (
              <div className="text-xs font-normal mt-1 space-y-1">
                {stockInfo.results.filter(r => !r.isAvailable).map((r, i) => (
                  <p key={i}>⚠ {r.name}: {r.shortage} {r.requested - r.available} کمښت / کمبود</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <Label>ملاحظه / یادښت (د بیرته راګرځولو او ردولو لپاره اړین):</Label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:text-white/90 text-right"
            rows={2}
            placeholder="خپل نظر دلته ولیکئ..."
          ></textarea>
        </div>

        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              onClick={() => handleDecision('warehouse')}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm"
            >
              {loading ? 'بارول...' : '✔ ګودام ته راجع کول / ارجاع به ګدام'}
            </button>
            {!isDeliveryRound && (
              <button
                onClick={() => handleDecision('procurement')}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm"
              >
                {loading ? 'بارول...' : '🛒 تدارکاتو ته راجع کول / ارجاع به تدارکات'}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleDecision('returnToSuperAdmin')}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition disabled:opacity-50 text-sm"
            >
              {loading ? 'بارول...' : '↩ بیرته سوپر اډمین ته راګرځول / برگشت به سوپر ادمین'}
            </button>
            <button
              onClick={() => handleDecision('reject')}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-sm"
            >
              {loading ? 'بارول...' : '✗ ردول / رد'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default AdminDecisionPanel;
