import { useEffect, useState } from "react";
import { useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Button from "../../components/ui/button/Button";
import { getRequestById, InventoryRequest, saveFormInstance, updateRequestStage, getPipelineHistory, PipelineRecord } from "../../firebase/requests";
import { getWorkflowStage } from "../../constants/workflow";
import { finalizeDelivery, receiveProcurementToInventory } from "../../firebase/receiving";
import { createReceiptReport, getComparison, getVendorOffers } from "../../firebase/procurement";
import { addInAppNotification, getDemoUsers } from "../../firebase/localStore";
import { selectWinningVendor, mapWinnerToPurchaseOrder } from "../../utils/officialFormDataAdapter";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { managementService } from "../../services/management";
import OfficialFormViewer from "../../components/OfficialFormViewer";
import type { ComparisonRecord } from "../../firebase/procurement";
import WmsDialog from "../../components/common/WmsDialog";
import PipelineTimeline from "../../components/requests/PipelineTimeline";
import ConfirmerPanel from "../../components/requests/ConfirmerPanel";
import { ROLES } from "../../constants/roles";

export default function WarehouseRequestDetails() {
  const { id } = useParams();
  const [request, setRequest] = useState<InventoryRequest | null>(null);
  const [pipeline, setPipeline] = useState<PipelineRecord[]>([]);
  const [activeView, setActiveView] = useState<'details' | 'rr'>('details');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [comparison, setComparison] = useState<ComparisonRecord | null>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [confirmDeliverOpen, setConfirmDeliverOpen] = useState(false);
  const [confirmFS5Open, setConfirmFS5Open] = useState(false);
  const [alertDialog, setAlertDialog] = useState<{ msg: string; type?: "success" | "error" | "warning" } | null>(null);
  const { user, profile } = useAuth();
  const { pick } = useLanguage();

  const showAlert = (msg: string, type: "success" | "error" | "warning" = "success") => {
    setAlertDialog({ msg, type });
  };

  useEffect(() => {
    if (id) fetchData(id);
  }, [id]);

  const fetchData = async (requestId: string) => {
    setLoading(true);
    const [data, pipelineData] = await Promise.all([
      getRequestById(requestId),
      getPipelineHistory(requestId),
    ]);
    setRequest(data ?? null);
    setPipeline(pipelineData);
    setLoading(false);
  };

  const getRequesterEmail = () => {
    if (!request) return "";
    const users = getDemoUsers();
    const user = users.find((u) => u.uid === request.requesterId);
    return user?.email || "";
  };

  const sendRequestFS5Email = async (): Promise<boolean> => {
    const email = getRequesterEmail();
    if (!email || !request) return false;

    const subject = pick(
      `د ${request.id} غوښتنې لپاره ف.س-۵ او پیشنهاد فورمونه برابر کړئ`, 
      `فرم ف.س-۵ و پروپوزل را برای درخواست ${request.id} آماده کنید`
    );
    const body = pick(
      `سلام ${request.requesterName || "غوښتونکي"},

ستاسو د تدارکاتي غوښتنې ${request.id} اجناس ګدام ته داخل شول.
مهرباني وکړئ د دې غوښتنې لپاره پیشنهاد او ف.س-۵ فورمونه جوړ کړئ او وروسته یې د تایید لپاره واستوئ.

په درنښت، د اجناسو مدیر`,
      `سلام ${request.requesterName || "درخواست‌دهنده"},

اجناس درخواست تدارکاتی ${request.id} وارد انبار شدند.
لطفاً فرم‌های پیشنهاد و ف.س-۵ را برای این درخواست آماده کرده و برای تایید ارسال کنید.

با احترام، مدیر انبار`
    );

    try {
      await managementService.sendEmail({ to: email, subject, body });
      return true;
    } catch (error: any) {
      console.warn("sendRequestFS5Email failed", error);
      return false;
    }
  };

  const saveRR = async (data: any): Promise<boolean> => {
    if (!id || !user || !profile || !request) return false;
    try {
      const compData = comparison || await getComparison(id);
      const winnerName = compData?.winnerVendorName || '';
      await saveFormInstance(id, 'ReceiptReport', data, user.uid, profile.name);
      await createReceiptReport(id, winnerName, request.items, { uid: user.uid, name: profile.name, role: profile.role });
      return true;
    } catch (error: any) {
      showAlert(error.message, "error");
      return false;
    }
  };

  const handleSaveRR = async (data: any) => {
    setActionLoading(true);
    const ok = await saveRR(data);
    if (ok) {
      fetchData(id!);
      setActiveView('details');
    }
    setActionLoading(false);
  };

  const handleRRPrint = async (data: any) => {
    setActionLoading(true);
    const ok = await saveRR(data);
    if (!ok) { setActionLoading(false); return; }

    if (!id || !request) return;
    const users = getDemoUsers();
    const requesterUser = users.find(u => u.uid === request.requesterId);
    const requesterEmail = requesterUser?.email || '';

    const params = new URLSearchParams({ requestId: id, to: requesterEmail });
    window.location.href = `/notifications?${params.toString()}`;
  };

  const handleRequestFS5 = async () => {
    if (!id || !user || !profile || !request) return;
    setActionLoading(true);
    try {
      await updateRequestStage(
        id,
        "DeliveryFormsRequested",
        82,
        pick("د ف.س-۵ او پیشنهاد غوښتنه — غوښتونکي ته", "درخواست فرم ف.س-۵ و پروپوزل — به درخواست‌کننده"),
        { uid: user.uid, name: profile.name, role: profile.role },
        pick(
          `د اجناسو مدیر غواړي چي د ${request.requesterName || "غوښتونکي"} غوښتنه لپاره ف.س-۵ او پیشنهاد برابر شي.`,
          `مدیر انبار درخواست می‌کند که برای ${request.requesterName || "درخواست‌دهنده"} فرم ف.س-۵ و پروپوزل آماده شود.`
        )
      );
      addInAppNotification({
        type: "info",
        titlePs: "ف.س-۵ او پیشنهاد جوړ کړئ",
        titleDr: "فرم ف.س-۵ و پروپوزل آماده کنید",
        bodyPs: `د اجناسو مدیر غواړي چي تاسو د غوښتنه ${id} لپاره ف.س-۵ او پیشنهاد فورمونه جوړ کړئ او بیا يي واستوئ.`,
        bodyDr: `مدیر انبار از شما می‌خواهد که برای درخواست ${id} فرم‌های ف.س-۵ و پروپوزل را آماده کرده و ارسال کنید.`,
        requestId: id,
      });
      const emailSent = await sendRequestFS5Email();
      showAlert(
        pick(
          emailSent
            ? "خبرتیا وسپارل شوه — غوښتونکی ته ایمیل او په-app خبرتیا واستول شوه."
            : "خبرتیا وسپارل شوه — په-app خبرتیا واستول شوه، ایمیل نشو لیږلای.",
          emailSent
            ? "اطلاع‌رسانی انجام شد — ایمیل و اعلان ارسال شد."
            : "اطلاع‌رسانی انجام شد — اعلان ارسال شد، ایمیل ارسال نشد."
        ),
        emailSent ? "success" : "warning"
      );
      fetchData(id!);
    } catch (error: any) {
      showAlert(error.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceiveToInventory = async () => {
    if (!id || !user || !profile || !request) return;
    setActionLoading(true);
    try {
      await receiveProcurementToInventory(id, request.items, { uid: user.uid, name: profile.name, role: profile.role });
      showAlert(pick("اجناس موجودۍ ته داخل شول.", "اجناس به موجودی وارد شدند."), "success");
      fetchData(id!);
    } catch (error: any) {
      showAlert(error.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeliver = async () => {
    if (!id || !user || !profile || !request) return;
    setActionLoading(true);
    try {
      await finalizeDelivery(id, { uid: user.uid, name: profile.name, role: profile.role }, {
        items: request.items,
        requesterName: request.requesterName,
        receiverName: request.requesterName,
        receiverId: request.personId,
      });
      showAlert(
        pick("اجناس په بریالیتوب سره وسپارل شول او موجودي کمه شوه.", "اجناس با موفقیت تحویل داده شدند و موجودی کاهش یافت."),
        "success"
      );
      fetchData(id!);
    } catch (error: any) {
      showAlert(`${pick("تېروتنه", "خطا")}: ${error.message}`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500 italic">بارول...</div>;
  if (!request) return <div className="p-10 text-center text-red-500">غوښتنه ونه موندل شول.</div>;

  const hasProposal = !!request.formInstances?.proposalId;
  const hasFS5 = !!request.formInstances?.fs5Id;
  const isSecondRound = pipeline.some(e =>
    ['FS5Required', 'DeliveryFormsRequested', 'DeliveryFormsSubmitted'].includes(e.status)
  );

  const showRRBtn      = request.status === 'PurchaseOrderCreated';
  const showReceiveBtn = request.status === 'ReceiptReportCreated';
  const showDeliverBtn = profile?.role === ROLES.WAREHOUSE_DIRECTOR && (
                         request.status === 'FS5Created' ||
                         request.status === 'DeliveryReferredToWarehouse' ||
                         (request.status === 'StockAvailable' && (hasFS5 || isSecondRound)) ||
                         request.status === 'ReceiptRecorded');
  const showRequestFS5Btn = (request.status === 'StockAvailable' || request.status === 'ReceivedToInventory') && (!hasProposal || !hasFS5) && !isSecondRound;

  const canShowConfirmerPanel = profile?.role === ROLES.REQUEST_CONFIRMER &&
    (request.status === 'Submitted' ||
     request.status === 'PendingReview' ||
     request.status === 'ReturnedToConfirmer');

  const openRRForm = async () => {
    if (!id) return;
    const compData = await getComparison(id);
    const offersData = await getVendorOffers(id, true);
    setComparison(compData);
    setOffers(offersData);
    setActiveView('rr');
  };

  return (
    <>
      {alertDialog && (
        <WmsDialog
          type={alertDialog.type || "success"}
          title={alertDialog.type === "error" ? pick("تېروتنه", "خطا") : alertDialog.type === "warning" ? pick("پاملرنه", "توجه") : pick("بریالي", "موفق")}
          message={alertDialog.msg}
          confirmText={pick("ښه", "باشه")}
          onConfirm={() => setAlertDialog(null)}
        />
      )}

      {confirmDeliverOpen && (
        <WmsDialog
          type="warning"
          title={pick("د نهایي سپارنې تایید", "تأیید تحویل نهایی")}
          message={pick(
            "ایا تاسو باوري یاست چي اجناس سپارل غواړئ؟ له دې سره به موجودي کمه شي.",
            "آیا مطمئن هستید که اجناس تحویل داده می‌شوند؟ با این کار موجودی کاهش می‌یابد."
          )}
          confirmText={pick("هو، وسپاره", "بله، تحویل بده")}
          cancelText={pick("لغوه", "انصراف")}
          onConfirm={() => { setConfirmDeliverOpen(false); handleDeliver(); }}
          onCancel={() => setConfirmDeliverOpen(false)}
        />
      )}

      {confirmFS5Open && (
        <WmsDialog
          type="warning"
          title={pick("د ف.س-۵ غوښتنه", "درخواست فرم ف.س-۵")}
          message={pick(
            `ایا غواړئ چي ${request.requesterName || "غوښتونکي"} ته خبرتیا ولیږئ چي ف.س-۵ او پیشنهاد برابر کړي؟`,
            `آیا می‌خواهید به ${request.requesterName || "درخواست‌دهنده"} اطلاع دهید که فرم ف.س-۵ و پروپوزل را آماده کند؟`
          )}
          confirmText={pick("هو، خبرتیا ورکړه", "بله، اطلاع بده")}
          cancelText={pick("لغوه", "انصراف")}
          onConfirm={() => { setConfirmFS5Open(false); handleRequestFS5(); }}
          onCancel={() => setConfirmFS5Open(false)}
        />
      )}

      <PageMeta title="د سپارلو مدیریت | Kandahar University WMS" description="د اجناسو سپارلو مدیریت" />
      <Breadcrumb pageTitle={pick("د سپارلو مدیریت", "مدیریت تحویلی")} />

      {activeView === 'rr' ? (
        <div className="h-[85vh]">
          <div className="mb-4">
            <Button variant="outline" size="sm" onClick={() => setActiveView('details')}>← بیرته ورشئ</Button>
          </div>
          <OfficialFormViewer
            templateId="formTemplate4"
            initialData={(() => {
              const winner = offers.find(o => o.vendorName === comparison?.winnerVendorName) || selectWinningVendor(offers);
              if (winner && request) {
                const base = mapWinnerToPurchaseOrder(winner, request);
                return {
                  ...base,
                  sourceTemplateId: "formTemplate4",
                  sourceFormName: "receiptReport"
                };
              }
              return { vendor_name: comparison?.winnerVendorName || '' } as any;
            })()}
            onSave={handleSaveRR}
            onPrint={handleRRPrint}
            autoSaveOnPrint={false}
            userId={user?.uid || ''}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">
                {pick("د ویش پړاوونه", "مراحل توزیع")}
              </h3>
              <div className="space-y-4">

                {showRRBtn && (
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <p className="text-indigo-700 text-sm font-bold mb-3">
                      {pick("لومړی د تدارکاتو راپور رسید فورم ډک کړئ:", "ابتدا فرم راپور رسید تدارکات را پر کنید:")}
                    </p>
                    <Button onClick={openRRForm} disabled={actionLoading} fullWidth>
                      {actionLoading ? pick("یو لحظه...", "لطفا صبر کنید...") : pick("راپور رسید جوړول", "ایجاد راپور رسید")}
                    </Button>
                  </div>
                )}

                {showReceiveBtn && (
                  <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                    <p className="text-orange-700 text-sm font-bold mb-3">
                      {pick("تدارکاتي اجناس موجودۍ ته داخل کړئ:", "اجناس تدارکاتی را به موجودی وارد کنید:")}
                    </p>
                    <Button onClick={handleReceiveToInventory} disabled={actionLoading} fullWidth variant="primary">
                      {actionLoading ? pick("یو لحظه...", "لطفا صبر کنید...") : pick("موجودۍ ته داخلول", "ورود به گدام")}
                    </Button>
                  </div>
                )}

                {showRequestFS5Btn && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl dark:bg-purple-900/10 dark:border-purple-800/40">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-xl">📋</span>
                      <div>
                        <p className="text-purple-800 dark:text-purple-200 text-sm font-bold">
                          {pick("غوښتونکي ته د ف.س-۵ او پیشنهاد غوښتنه", "درخواست فرم ف.س-۵ و پروپوزل از درخواست‌دهنده")}
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                          {pick(
                            "اجناس د ویش لپاره چمتو دي. لومړی غوښتونکي ته خبرتیا ورکړئ چي ف.س-۵ او پیشنهاد برابر کړي. هغه به دواړه فورمونه ډک کړي، له کنفرمر، مقام، اډمین سره به طي مراحل سي، بیا به نهايي سپارنه وکړئ.",
                            "اجناس آماده توزیع است. ابتدا به درخواست‌دهنده اطلاع دهید تا فرم ف.س-۵ و پروپوزل را آماده کند. آن‌ها هر دو فرم را تکمیل می‌کنند، از طریق تأییدکننده، مقام، ادمین مراحل را طی می‌کنند، سپس تحویل نهایی انجام می‌شود."
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmFS5Open(true)}
                      disabled={actionLoading}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-sm"
                    >
                      {actionLoading
                        ? pick("اجرا کیږي...", "در حال اجرا...")
                        : pick("📧 غوښتونکي ته ف.س-۵ او پیشنهاد غوښتنه ولیږئ", "📧 درخواست ف.س-۵ و پروپوزل به درخواست‌دهنده")}
                    </button>
                  </div>
                )}

                {showDeliverBtn && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl dark:bg-green-900/20 dark:border-green-800/40">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-xl mt-0.5">🚚</span>
                      <div>
                        <p className="text-green-700 dark:text-green-200 text-sm font-bold">
                          {pick("نهایي سپارنه", "تحویل نهایی")}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          {request.status === 'DeliveryReferredToWarehouse' || (request.status === 'StockAvailable' && isSecondRound)
                            ? pick(
                                "اډمین غوښتنه ستاسو ته راجع کړې. د ثبت په کلیک کولو سره به اجناس د غوښتونکي په تعقیب کې ثبت شي او سپارل کیږي.",
                                "ادمین درخواست را به شما ارجاع داده. با کلیک ثبت، اجناس در ردیابی درخواست‌دهنده ثبت و تحویل می‌شود."
                              )
                            : pick(
                                "غوښتونکي ف.س-۵ او پیشنهاد برابر کړل او د بشپړ پروسې وروسته دلته راورسیدل. اوس اجناس وسپارئ.",
                                "درخواست‌دهنده فرم‌ها را آماده کرد و پس از طی مراحل به اینجا رسید. اکنون اجناس را تحویل دهید."
                              )
                          }
                        </p>
                        {hasProposal && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                            ✅ {pick("ف.س-۵ او پیشنهاد بشپړ", "ف.س-۵ و پروپوزل تکمیل")}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmDeliverOpen(true)}
                      disabled={actionLoading}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition shadow-lg text-sm"
                    >
                      {actionLoading
                        ? pick("اجرا کیږي...", "در حال اجرا...")
                        : pick("✔ جنس ثبت او غوښتنه بشپړه کړئ", "✔ ثبت جنس و تکمیل درخواست")}
                    </button>
                  </div>
                )}

                {request.status === 'Delivered' && (
                  <div className="p-10 text-center bg-green-50 border border-green-100 rounded-2xl">
                    <div className="text-4xl mb-2">✅</div>
                    <h4 className="text-green-700 font-bold text-xl">
                      {pick("غوښتنه بشپړه شوه!", "درخواست تکمیل شد!")}
                    </h4>
                    <p className="text-green-600 text-sm mt-1">
                      {pick("اجناس وسپارل شول — د غوښتونکي تعقیب کي ثبت شوي.", "اجناس تحویل داده شدند — در ردیابی درخواست‌دهنده ثبت شده است.")}
                    </p>
                  </div>
                )}

                {!showRRBtn && !showReceiveBtn && !showRequestFS5Btn && !showDeliverBtn && request.status !== 'Delivered' && (
                  <div className="p-6 text-center bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-amber-700 font-bold text-sm">
                      {pick(`د غوښتنې اوسنی حالت: ${request.status}`, `وضعیت فعلی: ${request.status}`)}
                    </p>
                    <p className="text-amber-600 text-xs mt-1">
                      {pick("دا غوښتنه اوس بل مرحله کي ده. کله چي ستاسو وار راشي، عمل وکړئ.", "این درخواست در مرحله دیگری است. وقتی نوبت شما رسید اقدام کنید.")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">
                {pick("د غوښتنې اجناس", "اجناس درخواست")}
              </h3>
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs">
                    <th className="py-2">{pick("جنس", "جنس")}</th>
                    <th className="py-2">{pick("غوښتل شوی مقدار", "مقدار درخواستی")}</th>
                    <th className="py-2">{pick("واحد", "واحد")}</th>
                  </tr>
                </thead>
                <tbody>
                  {request.items.map((i, idx) => (
                    <tr key={idx} className="border-t dark:border-gray-800">
                      <td className="py-3 font-medium text-gray-800 dark:text-white/90">{i.name}</td>
                      <td className="py-3 text-gray-600">{i.quantity}</td>
                      <td className="py-3 text-gray-600">{i.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canShowConfirmerPanel && (
              <ConfirmerPanel
                requestId={id!}
                currentStatus={request.status}
                currentLevel={request.currentRequestLevel}
                user={{ uid: user!.uid, name: profile!.name, role: profile!.role }}
                onUpdate={() => fetchData(id!)}
                pipeline={pipeline}
              />
            )}

            {pipeline.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">
                  {pick("د اجرااتو تاریخچه", "تاریخچه اجراات")}
                </h3>
                <PipelineTimeline history={pipeline} />
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">
                {pick("پرمختګ", "پیشرفت")}
              </h3>
              {(() => {
                const wf = getWorkflowStage(request.status);
                const isSecondRound = pipeline.some(e =>
                  ['FS5Required', 'DeliveryFormsRequested', 'DeliveryFormsSubmitted'].includes(e.status)
                );
                const SECOND_ROUND_PROGRESS: Record<string, number> = {
                  PendingReview: 70, ReviewReturned: 70,
                  ConfirmedByRequestConfirmer: 75, ReturnedToConfirmer: 75,
                  ApprovedBySuperAdmin: 80, ReturnedToSuperAdmin: 80,
                  StockAvailable: 90, ReceiptRecorded: 95,
                  Delivered: 100, WDDelivered: 100, WDDeliveredFinal: 100,
                };
                const pct = isSecondRound
                  ? (SECOND_ROUND_PROGRESS[request.status] ?? wf.progressPercent)
                  : wf.progressPercent;
                return (
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-primary bg-primary/10">
                    {pct}%
                  </span>
                </div>
                <div className="overflow-hidden h-2 mb-4 rounded bg-gray-200 dark:bg-gray-800">
                  <div style={{ width: `${pct}%` }} className="h-full bg-primary transition-all duration-500 rounded" /></div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{request.status}</p>
              </div>
                );
              })()}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-3 border-b pb-2 dark:border-gray-700">
                {pick("غوښتونکی", "درخواست‌دهنده")}
              </h3>
              <div className="space-y-2 text-sm">
                <p className="text-gray-800 dark:text-white/90 font-medium">{request.requesterName || "—"}</p>
                <p className="text-gray-500 dark:text-gray-400">{request.faculty || "—"}</p>
                <p className="text-gray-500 dark:text-gray-400">{request.departmentOrPerson || "—"}</p>
              </div>
              {hasProposal && (
                <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/40">
                  <p className="text-xs font-bold text-green-700 dark:text-green-300">
                    ✅ {pick("ف.س-۵ او پیشنهاد برابر شوي", "فرم ف.س-۵ و پروپوزل آماده شده")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
