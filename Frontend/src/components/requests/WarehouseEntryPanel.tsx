import React, { useState } from "react";
import Label from "../form/Label";
import { PipelineRecord, RequestItem, updateRequestStage } from "../../firebase/requests";
import { finalizeDelivery } from "../../firebase/receiving";
import { useLanguage } from "../../context/LanguageContext";
import { addInAppNotification } from "../../firebase/localStore";
import WmsDialog from "../common/WmsDialog";

interface WarehouseEntryPanelProps {
  requestId: string;
  currentStatus: string;
  user: { uid: string; name: string; role: string };
  requesterName?: string;
  requesterPersonId?: string;
  items?: RequestItem[];
  hasProposal?: boolean;
  hasFS5?: boolean;
  pipeline?: PipelineRecord[];
  onUpdate: () => void;
}

const WarehouseEntryPanel: React.FC<WarehouseEntryPanelProps> = ({
  requestId,
  currentStatus,
  user,
  requesterName,
  requesterPersonId,
  items = [],
  hasProposal = false,
  hasFS5 = false,
  pipeline = [],
  onUpdate,
}) => {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDeliver, setConfirmDeliver] = useState(false);
  const { pick } = useLanguage();

  const isStockAvailable  = currentStatus === "StockAvailable";
  const isReceiptRecorded = currentStatus === "ReceiptRecorded";
  const hasDeliveryForms = hasProposal && hasFS5;
  const isDeliveryRound = pipeline.some(e =>
    ['FS5Required', 'DeliveryFormsRequested', 'DeliveryFormsSubmitted'].includes(e.status)
  );
  const isDeliveryReady =
    currentStatus === "DeliveryReferredToWarehouse" ||
    (isStockAvailable && isDeliveryRound && hasDeliveryForms);

  const handleRequestFS5 = async () => {
    setLoading(true);
    try {
      await updateRequestStage(
        requestId,
        "DeliveryFormsRequested",
        82,
        pick("د ف،س،۵ او پیشنهاد غوښتنه — غوښتونکي ته", "درخواست فرم ف.س-۵ و پروپوزل — به درخواست‌کننده"),
        { uid: user.uid, name: user.name, role: user.role },
        comment.trim() || pick("ګدام مدیر غوښتنه کړه چي ف،س،۵ او پیشنهاد برابر شي", "مدیر انبار درخواست کرد که ف.س-۵ و پروپوزل آماده شود")
      );
      addInAppNotification({
        type: "info",
        titlePs: "د ف،س،۵ غوښتنه",
        titleDr: "درخواست فرم ف.س-۵",
        bodyPs: `ګدام مدیر غوښتنه کوي چي د غوښتنه ${requestId} لپاره ف،س،۵ او پیشنهاد برابر کړئ.`,
        bodyDr: `مدیر انبار درخواست می‌کند که برای درخواست ${requestId} فرم ف.س-۵ و پروپوزل آماده کنید.`,
        requestId,
      });
      onUpdate();
    } catch (err) {
      console.error("FS5 request failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: "recordReceipt" | "deliver") => {
    setLoading(true);
    try {
      let status = "", progress = 0, stage = "";
      if (action === "recordReceipt") {
        status   = "ReceiptRecorded";
        progress = 95;
        stage    = pick("رسید ثبت شو — ګدام ته داخل شو", "رسید ثبت شد — وارد انبار شد");
      } else {
        await finalizeDelivery(requestId, user, {
          items,
          requesterName,
          receiverName: requesterName,
          receiverId: requesterPersonId,
        });
        onUpdate();
        return;
      }
      await updateRequestStage(requestId, status, progress, stage, user, comment.trim());
      onUpdate();
    } catch (err) {
      console.error("Warehouse action failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isStockAvailable && !isReceiptRecorded && !isDeliveryReady) return null;

  return (
    <>
      {confirmDeliver && (
        <WmsDialog
          type="warning"
          title={pick("د نهايي سپارنې تایید", "تأیید تحویل نهایی")}
          message={pick(
            `ایا تاسو ډاډه یاست چي اجناس${requesterName ? ` د "${requesterName}" ` : " "}ته سپارل غواړئ؟ له دې سره به موجودي کمه شي.`,
            `آیا مطمئن هستید که اجناس${requesterName ? ` به "${requesterName}" ` : " "}تحویل داده می‌شوند؟ با این کار موجودی کاهش می‌یابد.`
          )}
          confirmText={pick("هو، وسپاره", "بله، تحویل بده")}
          cancelText={pick("لغوه", "انصراف")}
          onConfirm={() => { setConfirmDeliver(false); handleAction("deliver"); }}
          onCancel={() => setConfirmDeliver(false)}
        />
      )}

      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm border-t-4 border-t-teal-500">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">
          {pick("د ګدام دننه کولو پینل", "پنل ورود به انبار")}
        </h3>

        {isStockAvailable && !isDeliveryRound && !hasDeliveryForms && (
          <div className="mb-4">
            <div className="rounded-xl bg-purple-50 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/40 p-4">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-xl mt-0.5">📋</span>
                <div>
                  <p className="text-sm font-bold text-purple-800 dark:text-purple-200">
                    {pick("غوښتونکي ته ف.س-۵ او پیشنهاد غوښتل", "درخواست ف.س-۵ و پروپوزل از درخواست‌دهنده")}
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    {pick(
                      "اجناس ګدام کي شته. غوښتونکي ته خبرتیا ورکړئ چي ف.س-۵ او پیشنهاد برابر کړي. هغه به د کنفرمر، مقام، اډمین له لارې طي مراحل کړي، بیا به نهایي سپارنه وکړئ.",
                      "اجناس در انبار موجود است. به درخواست‌دهنده اطلاع دهید تا فرم ف.س-۵ و پروپوزل را آماده کند، از طریق تأییدکننده، مقام و ادمین طی مراحل شود، سپس تحویل نهایی انجام می‌شود."
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRequestFS5}
                disabled={loading}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-lg transition text-sm"
              >
                {loading
                  ? pick("بارول...", "در حال ارسال...")
                  : pick("📧 غوښتونکي ته د ف.س-۵ غوښتنه ولیږئ", "📧 درخواست فرم ف.س-۵ به درخواست‌دهنده")}
              </button>
            </div>
          </div>
        )}

        {isDeliveryReady && (
          <div className="mb-4">
            <div className="rounded-xl bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800/40 p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">✅</span>
                <div>
                  <p className="text-sm font-bold text-green-800 dark:text-green-200">
                    {pick("ف.س-۵ او پیشنهاد تایید شوي — نهایي سپارنه وکړئ", "ف.س-۵ و پیشنهاد تأیید شده — تحویل نهایی را انجام دهید")}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                    {pick(
                      "پیشنهاد او ف.س-۵ د تایید بشپړ پړاو تېر کړی. اوس اجناس په غوښتونکي پسې ثبت او وسپارئ.",
                      "پیشنهاد و ف.س-۵ تمام مراحل تأیید را طی کرده است. اکنون اجناس را به نام درخواست‌کننده ثبت و تحویل دهید."
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {isReceiptRecorded && (
          <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/40 p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">✅</span>
              <div>
                <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                  {pick("رسید ثبت شوی — اوس تسلیموئ", "رسید ثبت شده — اکنون تحویل دهید")}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                  {pick(
                    "کله چي ف، س، ۵ فورم لاسلیک شو نو د تسلیم بټن فشار ورکړئ.",
                    "پس از امضاء فرم ف-۵-س، دکمه تحویل را فشار دهید."
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label>{pick("یادښت (اختیاري):", "یادداشت (اختیاری):")}</Label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:text-white/90 text-right"
              rows={2}
              placeholder={pick("یادښت دلته ولیکئ...", "یادداشت اینجا بنویسید...")}
            />
          </div>

          <div className="flex gap-3">
            {isStockAvailable && !isDeliveryRound && hasDeliveryForms && (
              <button
                onClick={() => handleAction("recordReceipt")}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition disabled:opacity-50 text-sm"
              >
                {loading ? pick("بارول...", "در حال ثبت...") : pick("📋 رسید ثبت کول", "📋 ثبت رسید")}
              </button>
            )}

            {(isReceiptRecorded || isDeliveryReady) && (
              <button
                onClick={() => setConfirmDeliver(true)}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm"
              >
                {loading ? pick("بارول...", "در حال ثبت...") : pick("✔ جنس ثبت او غوښتنه بشپړه کړئ", "✔ ثبت جنس و تکمیل درخواست")}
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 text-right dark:text-gray-400">
            {isStockAvailable && !isDeliveryRound && !hasDeliveryForms
              ? pick(
                  "• لومړی غوښتونکي ته ف.س-۵ غوښتنه ولیږئ، بیا به رسید ثبت کولو بټن ښکاره شي.",
                  "• ابتدا درخواست ف.س-۵ به درخواست‌دهنده ارسال کنید، سپس دکمه ثبت رسید نمایان می‌شود."
                )
              : isDeliveryReady
              ? pick(
                  "• نهایي سپارنه موجودي کموي او اجناس د غوښتونکي په نوم ثبتوي.",
                  "• تحویل نهایی موجودی را کم کرده و اجناس را به نام درخواست‌کننده ثبت می‌کند."
                )
              : pick(
                  "• تسلیم: د رسید وروسته نهایي سپارنه وکړئ",
                  "• تحویل: پس از ثبت رسید، تحویل نهایی انجام دهید"
                )
            }
          </p>
        </div>
      </div>
    </>
  );
};

export default WarehouseEntryPanel;
