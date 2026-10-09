import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Button from "../../components/ui/button/Button";
import { getFormInstance, getRequestById, InventoryRequest, saveFormInstance } from "../../firebase/requests";
import { 
  getOrCreateProcurement, 
  ProcurementRecord, 
  updateProcurementStatus, 
  getVendorOffers, 
  VendorOffer, 
  getComparison,
  saveWinnerSelection,
  createPurchaseOrder,
  createReceiptReport
} from "../../firebase/procurement";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { ROLES } from "../../constants/roles";
import OfficialFormViewer from "../../components/OfficialFormViewer";
import { mapVendorOffersToComparison, selectWinningVendor, mapWinnerToPurchaseOrder, extractSharedRequestData, extractTenderItemRows } from "../../utils/officialFormDataAdapter";
import { getWorkflowStage } from "../../constants/workflow";

export default function ProcurementDetails() {
  const { id } = useParams();
  const [request, setRequest] = useState<InventoryRequest | null>(null);
  const [procurement, setProcurement] = useState<ProcurementRecord | null>(null);
  const [offers, setOffers] = useState<VendorOffer[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [savedFormData, setSavedFormData] = useState<{
    tender?: any;
    comparison?: any;
    purchaseOrder?: any;
    receiptReport?: any;
  }>({});
  const [activeView, setActiveView] = useState<'details' | 'tender' | 'offers' | 'comparison' | 'winner' | 'po' | 'rr'>('details');
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { pick } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (id && user) fetchData(id);
  }, [id, user]);

  const fetchData = async (requestId: string) => {
    setLoading(true);
    try {
      const reqData = await getRequestById(requestId);
      if (reqData) {
        const procData = await getOrCreateProcurement(reqData, user!.uid);
        const offersData = await getVendorOffers(procData.id);
        const compData = await getComparison(procData.id);
        const loadSavedForm = async (formId?: string) => {
          if (!formId) return undefined;
          const form = await getFormInstance(reqData.id, formId);
          return form?.formData;
        };
        const [tender, comparisonForm, purchaseOrder, receiptReport] = await Promise.all([
          loadSavedForm(reqData.formInstances.tenderId),
          loadSavedForm(reqData.formInstances.comparisonId),
          loadSavedForm(reqData.formInstances.purchaseOrderId),
          loadSavedForm(reqData.formInstances.receiptReportId),
        ]);
        setRequest(reqData);
        setProcurement(procData);
        setOffers(offersData);
        // A winner is real only after the backend marks one of the three offers
        // as winner. Never manufacture a winner from one or two draft offers.
        setComparison(compData);
        setSavedFormData({ tender, comparison: comparisonForm, purchaseOrder, receiptReport });
      }
    } catch (error) {
      console.error("Error fetching procurement data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTender = async (data: any) => {
    if (!id || !user || !profile || !procurement) return;
    await saveFormInstance(id, 'Tender', data, user.uid, profile.name);
    await updateProcurementStatus(
      procurement.id, 'TenderCreated', 38, 
      { uid: user.uid, name: profile.name, role: profile.role },
      'تدارکات: جګړه پاڼه جوړه شوه / تدارکات: فرم داوطلبی ایجاد شد'
    );
    alert("جګړه پاڼه خوندي شوه.");
    fetchData(id);
    setActiveView('details');
  };

  const handleSaveComparison = async (data: any) => {
    if (!id || !user || !profile || !request || !procurement || offers.length < 3) return;
    await saveFormInstance(id, 'Comparison', data, user.uid, profile.name);
    const winner = selectWinningVendor(offers);
    if (winner) {
      await saveWinnerSelection(
        id, procurement.id,
        { vendorId: winner.id, vendorName: winner.vendorName, totalPrice: winner.totalOfferPrice },
        "اتوماتیک ټاکنه: کم قیمت / انتخاب خودکار: کمترین قیمت",
        { uid: user.uid, name: profile.name, role: profile.role }
      );
      // Prepare the PO data from the winner, but do not save/complete the PO.
      // The procurement director must review and explicitly save that form.
    } else {
      await updateProcurementStatus(
        procurement.id, 'ComparisonCreated', 44,
        { uid: user.uid, name: profile.name, role: profile.role },
        'مقایسوي فورم ذخیره شو'
      );
    }
    alert("فورم مقایسوي خوندي شو. ګټونکی په اتوماتیک ډول وټاکل شو.");
    fetchData(id);
    setActiveView('details');
  };

  const handleSavePO = async (data: any) => {
    if (!id || !user || !profile || !comparison || !procurement) return;
    await saveFormInstance(id, 'PurchaseOrder', data, user.uid, profile.name);
    await createPurchaseOrder(
      procurement.id, 
      { id: comparison.winnerVendorId, name: comparison.winnerVendorName, total: comparison.winnerTotalPrice },
      { uid: user.uid, name: profile.name, role: profile.role },
      id
    );
    alert("آمر خریداري خوندي شو.");
    fetchData(id);
    setActiveView('details');
  };

  const handleSaveRR = async (data: any) => {
    if (!id || !user || !profile || !comparison || !procurement) return;
    await saveFormInstance(id, 'ReceiptReport', data, user.uid, profile.name);
    await createReceiptReport(
      procurement.id,
      comparison.winnerVendorName,
      request!.items,
      { uid: user.uid, name: profile.name, role: profile.role },
      id
    );
    alert("راپور رسید خوندي شو.");
    fetchData(id);
    setActiveView('details');
  };

  if (loading) return <div className="p-10 text-center text-gray-500">بارول...</div>;
  if (!request || !procurement) return <div className="p-10 text-center text-red-500">معلومات ونه موندل شول.</div>;

  const downstreamOfTender = ['TenderCreated', 'OffersReceived', 'ComparisonCreated', 'WinnerSelected', 'PurchaseOrderCreated', 'ReceiptReportCreated'];
  const downstreamOfComparison = ['ComparisonCreated', 'WinnerSelected', 'PurchaseOrderCreated', 'ReceiptReportCreated'];
  const downstreamOfPurchaseOrder = ['PurchaseOrderCreated', 'ReceiptReportCreated'];
  const tenderSaved = Boolean(request.formInstances.tenderId) || downstreamOfTender.includes(procurement.status);
  const comparisonSaved = Boolean(request.formInstances.comparisonId) || downstreamOfComparison.includes(procurement.status);
  const winnerSelected = Boolean(comparison?.winnerVendorId && comparison?.winnerVendorName);
  const purchaseOrderSaved = Boolean(procurement.purchaseOrderId) || downstreamOfPurchaseOrder.includes(procurement.status);
  const receiptReportSaved = Boolean(request.formInstances.receiptReportId) || procurement.status === 'ReceiptReportCreated';

  return (
    <>
      <PageMeta title="د تدارکاتو مدیریت | Kandahar University WMS" description="د تدارکاتي پروسې مدیریت" />
      <Breadcrumb pageTitle="د تدارکاتو مدیریت / مدیریت تدارکات" />

      {activeView === 'tender' ? (
        <div className="h-[85vh]">
          <div className="mb-4"><Button variant="outline" size="sm" onClick={() => setActiveView('details')}>← بیرته</Button></div>
          <OfficialFormViewer templateId="formTemplate1" initialData={savedFormData.tender || (request ? { sharedFields: extractSharedRequestData(request), itemRows: extractTenderItemRows(request.items), grandTotal: 0 } as any : {})} onSave={handleSaveTender} userId={user?.uid || ''} />
        </div>
      ) : activeView === 'comparison' ? (
        <div className="h-[85vh]">
          <div className="mb-4"><Button variant="outline" size="sm" onClick={() => setActiveView('details')}>← بیرته</Button></div>
          <OfficialFormViewer 
            templateId="formTemplate2" 
            initialData={savedFormData.comparison || mapVendorOffersToComparison(offers, request?.items || [], comparison?.winnerVendorName) as any} 
            onSave={handleSaveComparison}
            userId={user?.uid || ''}
          />
        </div>
      ) : activeView === 'po' ? (
        <div className="h-[85vh]">
          <div className="mb-4"><Button variant="outline" size="sm" onClick={() => setActiveView('details')}>← بیرته</Button></div>
          <OfficialFormViewer 
            templateId="formTemplate3" 
            initialData={(() => {
              if (savedFormData.purchaseOrder) return savedFormData.purchaseOrder;
              const winner = offers.find(o => o.id === comparison?.winnerVendorId);
              return winner && request ? mapWinnerToPurchaseOrder(winner, request) : { vendor_name: comparison?.winnerVendorName, total: comparison?.winnerTotalPrice } as any;
            })()} 
            onSave={handleSavePO} 
            userId={user?.uid || ''} 
          />
        </div>
      ) : activeView === 'rr' && profile?.role !== ROLES.PROCUREMENT_DIRECTOR ? (
        <div className="h-[85vh]">
          <div className="mb-4"><Button variant="outline" size="sm" onClick={() => setActiveView('details')}>← بیرته</Button></div>
          <OfficialFormViewer 
            templateId="formTemplate4" 
            initialData={(() => {
              if (savedFormData.receiptReport) return savedFormData.receiptReport;
              const winner = offers.find(o => o.id === comparison?.winnerVendorId);
              if (winner && request) {
                const base = mapWinnerToPurchaseOrder(winner, request);
                return {
                  ...base,
                  sourceTemplateId: "formTemplate4",
                  sourceFormName: "receiptReport"
                };
              }
              return { vendor_name: comparison?.winnerVendorName } as any;
            })()} 
            onSave={handleSaveRR} 
            autoSaveOnPrint={false} 
            userId={user?.uid || ''} 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">د تدارکاتو جزیات</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">ګټونکی شرکت:</p>
                  <p className="font-bold text-green-600">{comparison?.winnerVendorName || "نه دی ټاکل شوی"}</p>
                </div>
                <div>
                  <p className="text-gray-500">مجموعي قیمت:</p>
                  <p className="font-bold text-primary">{comparison?.winnerTotalPrice || 0} افغانۍ</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">د تدارکاتو مدیریت</h3>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => tenderSaved && navigate(`/procurement/offers/${id}`)}
                  disabled={!tenderSaved}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
                    tenderSaved
                      ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'border-gray-200 text-gray-400 opacity-50 cursor-not-allowed grayscale'
                  }`}
                >
                  <span className="font-bold text-sm">قیمتونه / آفرونه</span>
                  <span className="text-xs">{offers.length} {pick("ثبت شوي", "ثبت شده")}</span>
                </button>
                <button 
                  onClick={() => setActiveView('tender')}              
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
                    tenderSaved ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 hover:border-primary text-gray-700'
                  }`}
                >
                  <span className="font-bold text-sm">۱. جګړه پاڼه / داوطلبي</span>
                  {tenderSaved ? '✅' : '⏳'}
                </button>
                
                <button 
                  onClick={() => setActiveView('comparison')}          
                  disabled={!tenderSaved || offers.length < 3}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
                    !tenderSaved || offers.length < 3 ? 'opacity-50 cursor-not-allowed grayscale' : 
                    comparisonSaved ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 hover:border-primary text-gray-700'
                  }`}
                >
                  <span className="font-bold text-sm">۲. فورم مقایسوي</span>
                  {comparisonSaved ? '✅' : '⏳'}
                </button>

                <div 
                  className={`w-full flex items-center justify-between p-4 rounded-xl border ${
                    winnerSelected ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400'
                  }`}
                >
                  <span className="font-bold text-sm">۳. ګټونکی: {comparison?.winnerVendorName || "تر اوسه نه دی ټاکل شوی"}</span>
                  {winnerSelected ? '✅' : '⏳'}
                </div>

                <button 
                  onClick={() => setActiveView('po')}                  
                  disabled={!winnerSelected}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
                    !winnerSelected ? 'opacity-50 cursor-not-allowed grayscale' : 
                    purchaseOrderSaved ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 hover:border-primary text-gray-700'
                  }`}
                >
                  <span className="font-bold text-sm">۴. آمر خریداري</span>
                  {purchaseOrderSaved ? '✅' : '⏳'}
                </button>

                {profile?.role !== ROLES.PROCUREMENT_DIRECTOR && (
                  <button 
                    onClick={() => setActiveView('rr')}
                    disabled={!purchaseOrderSaved}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
                      !purchaseOrderSaved ? 'opacity-50 cursor-not-allowed grayscale' : 
                      receiptReportSaved ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 hover:border-primary text-gray-700'
                    }`}
                  >
                    <span className="font-bold text-sm">۵. راپور رسید / ترلاسه کول</span>
                    {receiptReportSaved ? '✅' : '⏳'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">پرمختګ</h3>
              {(() => {
                const wf = request ? getWorkflowStage(request.status) : { progressPercent: 0, workflowComplete: false };
                const pct = request ? wf.progressPercent : 0;
                return (
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-primary bg-primary/10">{pct}%</span>
                    </div>
                    <div className="overflow-hidden h-2 mb-4 rounded bg-gray-200 dark:bg-gray-800">
                      <div style={{ width: `${pct}%` }} className="h-full bg-primary transition-all duration-500 rounded" />
                    </div>
                    <p className="text-xs text-gray-500">{request?.status}</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
