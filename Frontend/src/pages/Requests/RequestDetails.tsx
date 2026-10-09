import { useEffect, useState } from "react";
import { useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Button from "../../components/ui/button/Button";
import { 
  getRequestById, 
  InventoryRequest, 
  RequestItem,
  saveFormInstance, 
  getFormInstance, 
  updateRequestStage, 
  updateRequestItems,
  getPipelineHistory, 
  PipelineRecord 
} from "../../firebase/requests";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useCalendar } from "../../context/CalendarContext";
import OfficialFormViewer from "../../components/OfficialFormViewer";
import type { OfficialFormSharedData } from "../../components/OfficialFormViewer";
import PipelineTimeline from "../../components/requests/PipelineTimeline";
import ConfirmerPanel from "../../components/requests/ConfirmerPanel";
import SuperAdminPanel from "../../components/requests/SuperAdminPanel";
import AdminDecisionPanel from "../../components/requests/AdminDecisionPanel";
import WarehouseEntryPanel from "../../components/requests/WarehouseEntryPanel";
import RequesterFS5Panel from "../../components/requests/RequesterFS5Panel";
import WmsDialog from "../../components/common/WmsDialog";
import { ROLES } from "../../constants/roles";
import { getWorkflowStage } from "../../constants/workflow";
import { mapRequestToProposal, mapRequestToSI9, loadOfficialFormData, saveOfficialFormData } from "../../utils/officialFormDataAdapter";
import { apiClient } from "../../api/apiClient";

interface ChecklistItem {
  id: number;
  category: string;
  item_name: string;
  description: string;
  unit: string;
  estimated_price: number;
  inv_unit_price?: number;
  item_code: string;
}

interface EditRow {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specifications: string;
  itemId?: string;
  searchText: string;
  showDropdown: boolean;
  checklistId: string;
}

export default function RequestDetails() {
  const { id } = useParams();
  const [request, setRequest] = useState<InventoryRequest | null>(null);
  const [pipeline, setPipeline] = useState<PipelineRecord[]>([]);
  const [activeForm, setActiveForm] = useState<'Proposal' | 'SI-9' | 'FS-5' | null>(null);
  const [formData, setFormData] = useState<OfficialFormSharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingItems, setEditingItems] = useState(false);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [wmsAlert, setWmsAlert] = useState<{ msg: string; type?: "success" | "error" | "warning" } | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const { user, profile } = useAuth();
  const { pick } = useLanguage();
  const { pickDate } = useCalendar();

  const showAlert = (msg: string, type: "success" | "error" | "warning" = "success") => setWmsAlert({ msg, type });

  useEffect(() => {
    if (id) fetchData(id);
  }, [id]);

  const fetchData = async (requestId: string) => {
    setLoading(true);
    try {
      const data = await getRequestById(requestId);
      const history = await getPipelineHistory(requestId);
      setRequest(data ?? null);
      setPipeline(history);
      if (data && profile?.role === ROLES.WAREHOUSE_ENTRY_PERSON && data.status === "ReceiptReportCreated") {
        await startEditItems(data);
      }
    } catch (error) {
      console.error("Error fetching request data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openForm = async (type: 'Proposal' | 'SI-9' | 'FS-5') => {
    if (!request || !id) return;

    const formKey = type === 'Proposal' ? 'proposal' : type === 'SI-9' ? 'si9' : 'fs5';
    const instanceId = type === 'Proposal'
      ? request.formInstances?.proposalId
      : type === 'SI-9'
        ? request.formInstances?.si9Id
        : request.formInstances?.fs5Id;

    // Shared MySQL copy is authoritative on LAN. localStorage remains only a
    // same-browser draft cache.
    let saved: OfficialFormSharedData | null = null;
    if (instanceId) {
      try {
        const serverForm = await getFormInstance(id, instanceId);
        saved = (serverForm?.formData as OfficialFormSharedData) || null;
      } catch (error) {
        console.warn("Shared form could not be loaded; using browser draft.", error);
      }
    }
    if (!saved) saved = loadOfficialFormData(id, formKey);

    if (!saved || !saved.itemRows || saved.itemRows.length === 0) {
      // Build from the request items using the proper adapter
      saved = type === 'Proposal'
        ? mapRequestToProposal(request)
        : type === 'SI-9'
        ? mapRequestToSI9(request)
        : mapRequestToProposal(request); // FS-5 uses same item structure as Proposal
      // Persist so it's available next time
      saveOfficialFormData(id, formKey, saved);
    }

    setFormData(saved);
    setActiveForm(type);
  };

  const createAndSubmitDeliveryForms = async () => {
    if (!request || !id || !user || !profile) return;
    try {
      // Reuse existing reviewed forms; only auto-create a missing form.
      if (!request.formInstances?.proposalId) {
        const proposal = mapRequestToProposal(request);
        saveOfficialFormData(id, "proposal", proposal);
        await saveFormInstance(id, "Proposal", proposal, user.uid, profile.name);
      }
      if (!request.formInstances?.fs5Id) {
        const fs5 = mapRequestToProposal(request);
        saveOfficialFormData(id, "fs5", fs5);
        await saveFormInstance(id, "FS-5", fs5, user.uid, profile.name);
      }

      await updateRequestStage(
        id,
        "DeliveryFormsSubmitted",
        84,
        pick(
          "پیشنهاد او ف.س-۵ په اتومات ډول جوړ او تایید کوونکي ته واستول شول",
          "پیشنهاد و ف.س-۵ به‌صورت خودکار ایجاد و به تأییدکننده ارسال شد",
        ),
        { uid: user.uid, name: profile.name, role: profile.role },
        pick(
          "غوښتونکي دواړه د تسلیمۍ فورمونه په یوه کلیک جوړ او واستول.",
          "درخواست‌کننده هر دو فرم تحویلی را با یک کلیک ایجاد و ارسال کرد.",
        ),
      );
      showAlert(
        pick(
          "پیشنهاد او ف.س-۵ جوړ او تایید کوونکي ته واستول شول.",
          "پیشنهاد و ف.س-۵ ایجاد و به تأییدکننده ارسال شد.",
        ),
        "success",
      );
      await fetchData(id);
    } catch (error) {
      console.error("Delivery form auto-create failed:", error);
      showAlert(
        pick("د فورمونو جوړول او لېږل ناکام شول.", "ایجاد و ارسال فرم‌ها ناموفق بود."),
        "error",
      );
      throw error;
    }
  };

  const handleSaveForm = async (data: any) => {
    if (!id || !activeForm || !user || !profile) return;
    try {
      const formKey = activeForm === 'Proposal' ? 'proposal' : activeForm === 'SI-9' ? 'si9' : 'fs5';
      // Merge saved data back into localStorage
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        const existing = loadOfficialFormData(id, formKey) || {};
        saveOfficialFormData(id, formKey, { ...existing, ...data, savedAt: new Date().toISOString() });
      }
      await saveFormInstance(id, activeForm, data, user.uid, profile.name);
      fetchData(id);
      setActiveForm(null);
    } catch (error) {
      console.error("Error saving form:", error);
    }
  };

  const submitRequest = async () => {
    if (!id || !user || !profile) return;
    const isRequester = profile?.role === ROLES.REQUESTER;
    if (!isRequester && (!request?.formInstances?.proposalId || !request?.formInstances?.si9Id)) {
      showAlert(pick("مهرباني وکړئ لومړی پیشنهاد او ف، س، ۹ فورمونه ډک کړئ.", "لطفا ابتدا فورم‌های پیشنهاد و ف، س، ۹ را پر کنید."), "warning");
      return;
    }
    try {
      await updateRequestStage(
        id, 
        'PendingReview', 
        0, 
        pick('د بیاکتنې لپاره واستول شوه', 'برای پیش‌بررسی ارسال شد'),
        { uid: user.uid, name: profile.name, role: profile.role },
        pick("غوښتنه نهایي او د بیاکتنې لپاره واستول شوه.", "درخواست نهایی شد و برای پیش‌بررسی ارسال شد.")
      );
      showAlert(pick("غوښتنه د بیاکتنې لپاره واستول شوه.", "درخواست برای پیش‌بررسی ارسال شد."), "success");
      fetchData(id);
    } catch (error) {
      console.error("Error submitting request:", error);
    }
  };

  // Get last SuperAdmin comment (for ReturnedToConfirmer case)
  const lastSuperAdminComment = pipeline
    .filter(p => p.status === 'ReturnedToConfirmer' && p.comment)
    .slice(-1)[0]?.comment ?? "";

  // Get last ReviewReturned comment  
  const lastReturnedComment = pipeline
    .filter(p => p.status === 'ReviewReturned' && p.comment)
    .slice(-1)[0]?.comment ?? "";

  const CAN_EDIT_ITEMS_ROLES = [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.REQUESTER,
    ROLES.REQUEST_CONFIRMER,
    ROLES.PROCUREMENT_DIRECTOR,
    ROLES.WAREHOUSE_DIRECTOR,
  ];
  const canEditItems = profile?.role && CAN_EDIT_ITEMS_ROLES.includes(profile.role as any);

  const startEditItems = async (sourceRequest?: InventoryRequest) => {
    const editingRequest = sourceRequest || request;
    if (!editingRequest) return;
    setEditRows(editingRequest.items.map(i => ({
      name: i.name,
      unit: i.unit || '',
      quantity: i.quantity,
      unitPrice: i.unitPrice || 0,
      totalPrice: i.totalPrice || 0,
      specifications: (i as any).specifications || '',
      itemId: i.itemId || '',
      searchText: i.name,
      showDropdown: false,
      checklistId: i.itemId || '',
    })));
    setEditingItems(true);
    if (checklistItems.length === 0) {
      setChecklistLoading(true);
      try {
        const items = await apiClient.get("/checklist?active_only=true");
        setChecklistItems(Array.isArray(items) ? items : []);
      } catch {
        setChecklistItems([]);
      } finally {
        setChecklistLoading(false);
      }
    }
  };

  const getFilteredChecklist = (search: string) => {
    const q = search.trim().toLowerCase();
    return checklistItems.filter(ci =>
      !q ||
      ci.item_name.toLowerCase().includes(q) ||
      (ci.description || "").toLowerCase().includes(q) ||
      ci.category.toLowerCase().includes(q) ||
      (ci.item_code || "").toLowerCase().includes(q)
    ).slice(0, 30);
  };

  const selectChecklistEditItem = (idx: number, ci: ChecklistItem) => {
    const unitPrice = (ci.inv_unit_price != null && ci.inv_unit_price > 0)
      ? ci.inv_unit_price : (ci.estimated_price || 0);
    setEditRows(prev => {
      const next = [...prev];
      const qty = next[idx].quantity || 1;
      next[idx] = {
        ...next[idx],
        checklistId: String(ci.id),
        name: ci.item_name,
        unit: ci.unit || '',
        specifications: ci.description || '',
        unitPrice,
        totalPrice: unitPrice * qty,
        searchText: ci.item_name,
        showDropdown: false,
      };
      return next;
    });
  };

  const setEditRowSearch = (idx: number, text: string) => {
    setEditRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], searchText: text, showDropdown: true, checklistId: '', name: text };
      return next;
    });
  };

  const setEditRowDropdown = (idx: number, show: boolean) => {
    setEditRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], showDropdown: show };
      return next;
    });
  };

  const updateEditRow = (idx: number, field: keyof EditRow, val: string | number) => {
    setEditRows(prev => {
      const next = [...prev];
      const row = { ...next[idx], [field]: val } as EditRow;
      if (field === 'quantity' || field === 'unitPrice') {
        row.totalPrice = (field === 'quantity' ? Number(val) : row.quantity) * (field === 'unitPrice' ? Number(val) : row.unitPrice);
      }
      next[idx] = row;
      return next;
    });
  };

  const addEditRow = () => setEditRows(prev => [...prev, { name: '', unit: '', quantity: 1, unitPrice: 0, totalPrice: 0, specifications: '', searchText: '', showDropdown: false, checklistId: '' }]);
  const removeEditRow = (idx: number) => setEditRows(prev => prev.filter((_, i) => i !== idx));

  const saveEditedItems = async () => {
    if (!id) return;
    if (editRows.length === 0) { showAlert(pick('لږترلږه یو جنس اړین دی.', 'حداقل یک جنس اجباری است.'), "warning"); return; }
    if (editRows.find(r => !r.name.trim())) { showAlert(pick('د هر جنس نوم اړین دی.', 'نام هر جنس اجباری است.'), "warning"); return; }
    setEditSaving(true);
    try {
      const mapped: RequestItem[] = editRows.map(r => ({
        itemId: r.itemId || '',
        name: r.name,
        unit: r.unit,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        totalPrice: r.totalPrice,
        specifications: r.specifications,
      } as any));
      await updateRequestItems(id, mapped);
      setEditingItems(false);
      // If a Warehouse Entry user saved the procurement items, advance to ReceivedToInventory
      if (profile?.role === ROLES.WAREHOUSE_ENTRY_PERSON) {
        try {
          await updateRequestStage(id, "ReceivedToInventory", 52, pick("ګدام ته داخل شو", "وارد انبار شد"), { uid: user!.uid, name: profile!.name, role: profile!.role }, pick("ګدام داخلونکی اجناس ثبت کړل", "ورود به انبار توسط ورودکننده انجام شد"));
        } catch (e) {
          console.warn("Failed to auto-advance request to ReceivedToInventory:", e);
        }
      }
      await fetchData(id);
    } catch (e) {
      showAlert(pick('د اجناسو سمول ناکام شول.', 'ذخیره‌سازی ناموفق بود.'), "error");
    } finally {
      setEditSaving(false);
    }
  };

  const canShowConfirmerPanel = profile?.role === ROLES.REQUEST_CONFIRMER &&
    (request?.status === 'Submitted' ||
     request?.status === 'PendingReview' ||
     request?.status === 'ReturnedToConfirmer' ||
     request?.status === 'DeliveryFormsSubmitted' ||
     request?.status === 'DeliveryReturnedToConfirmer');
  // 'Submitted' included for backward-compat: old requests where approveReview→Submitted
  // (before the single-step fix) go directly to SuperAdmin without a second Confirmer step.
  const canShowSuperAdminPanel = profile?.role === ROLES.SUPER_ADMIN &&
    (request?.status === 'ConfirmedByRequestConfirmer' ||
     request?.status === 'Submitted' ||
     request?.status === 'ReturnedToSuperAdmin' ||
     request?.status === 'DeliveryConfirmedByRequestConfirmer' ||
     request?.status === 'DeliveryReturnedToSuperAdmin');
  const canShowAdminPanel = profile?.role === ROLES.ADMIN &&
    (request?.status === 'ApprovedBySuperAdmin' ||
     request?.status === 'DeliveryApprovedBySuperAdmin');
  const canShowWarehouseEntryPanel = profile?.role === ROLES.WAREHOUSE_DIRECTOR &&
    (request?.status === 'StockAvailable' ||
     request?.status === 'ReceiptRecorded' ||
     request?.status === 'DeliveryReferredToWarehouse');
  const canShowRequesterFS5Panel = profile?.role === ROLES.REQUESTER &&
    ['FS5Required', 'DeliveryFormsRequested', 'DeliveryReviewReturned',
      'DeliveryRejectedByRequestConfirmer', 'DeliveryRejectedBySuperAdmin',
      'DeliveryRejectedByAdmin'].includes(request?.status || '');
  const isDeliveryFormEditing = profile?.role === ROLES.REQUESTER &&
    ['FS5Required', 'DeliveryFormsRequested', 'DeliveryReviewReturned',
      'DeliveryRejectedByRequestConfirmer', 'DeliveryRejectedBySuperAdmin',
      'DeliveryRejectedByAdmin'].includes(request?.status || '');

  if (loading) return <div className="p-10 text-center text-gray-500">بارول...</div>;
  if (!request) return <div className="p-10 text-center text-red-500">غوښتنه ونه موندل شوه.</div>;

  return (
    <>
      {wmsAlert && (
        <WmsDialog
          type={wmsAlert.type || "success"}
          title={wmsAlert.type === "error" ? pick("تېروتنه", "خطا") : wmsAlert.type === "warning" ? pick("پاملرنه", "توجه") : pick("بریالي", "موفق")}
          message={wmsAlert.msg}
          confirmText={pick("ښه", "باشه")}
          onConfirm={() => setWmsAlert(null)}
        />
      )}
      <PageMeta title="د غوښتنې جزیات | Kandahar University WMS" description="د غوښتنې جزیات او فورمونه" />
      <Breadcrumb pageTitle={pick("د غوښتنې جزیات", "جزیات درخواست")} />

      {activeForm ? (
        <div className="h-[85vh]">
          <div className="mb-4">
            <Button variant="outline" size="sm" onClick={() => setActiveForm(null)}>← {pick("بیرته", "بازګشت")}</Button>
          </div>
          <OfficialFormViewer 
            templateId={activeForm === 'Proposal' ? 'formTemplate0' : activeForm === 'FS-5' ? 'formTemplate6' : 'formTemplate5'}
            requestId={id}
            allFormsData={formData ? { [activeForm === 'Proposal' ? 'formTemplate0' : activeForm === 'FS-5' ? 'formTemplate6' : 'formTemplate5']: formData } : undefined}
            onSave={handleSaveForm}
            readOnly={
              activeForm === 'SI-9'
                ? request.status !== 'Draft'
                : !isDeliveryFormEditing && request.status !== 'Draft'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex justify-between items-start mb-6 border-b pb-4 dark:border-gray-700">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white/90">{request.faculty}</h2>
                  <p className="text-gray-500 dark:text-gray-400">{request.departmentOrPerson}</p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    request.status === 'Draft' ? 'bg-gray-100 text-gray-600' :
                    request.status.includes('Rejected') ? 'bg-red-100 text-red-600' :
                    request.status === 'ReviewReturned' ? 'bg-orange-100 text-orange-600' :
                    request.status === 'ReturnedToConfirmer' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-600'
                  }`}>
                    {request.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-2">{pickDate(request.createdAtHijriShamsi, request.createdAtHijriQamari)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-gray-500 mb-1">{pick("د غوښتنې علت:", "دلیل درخواست:")}</h4>
                  <p className="text-gray-800 dark:text-white/80">{request.reason}</p>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-500 mb-1">{pick("درجه:", "درجه:")}</h4>
                  <p className="text-gray-800 dark:text-white/80">{request.currentRequestLevel}</p>
                </div>
                {request.rejectionComment && (
                  <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                    <h4 className="text-sm font-bold text-red-700 mb-1">{pick("د ردیدو علت:", "دلیل رد:")}</h4>
                    <p className="text-red-600">{request.rejectionComment}</p>
                  </div>
                )}
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between border-b pb-2 dark:border-gray-700 mb-3">
                  <h4 className="text-sm font-bold text-gray-800 dark:text-white/90">{pick("غوښتل شوي اجناس:", "اجناس درخواستی:")}</h4>
                  {canEditItems && !editingItems && (
                    <button
                      onClick={() => startEditItems()}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 transition"
                    >
                      ✏️ {pick("اجناس سم کړئ", "ویرایش اجناس")}
                    </button>
                  )}
                  {editingItems && (
                    <div className="flex gap-2">
                      <button onClick={addEditRow} className="text-xs px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 font-bold border border-green-200 transition">
                        + {pick("جنس اضافه کړئ", "افزودن جنس")}
                      </button>
                      <button onClick={() => setEditingItems(false)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold border border-gray-200 transition">
                        {pick("لغو", "لغو")}
                      </button>
                      <button
                        onClick={saveEditedItems}
                        disabled={editSaving}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold transition disabled:opacity-50"
                      >
                        {editSaving ? pick("ذخیره...", "در حال ذخیره...") : pick("✓ ذخیره", "✓ ذخیره")}
                      </button>
                    </div>
                  )}
                </div>

                {editingItems ? (
                  <div className="space-y-3">
                    {checklistLoading && (
                      <p className="text-xs text-gray-400 text-center">{pick("د چکلیسټ بارول...", "در حال بارگذاری چک‌لیست...")}</p>
                    )}
                    {!checklistLoading && checklistItems.length > 0 && (
                      <p className="text-xs text-primary font-medium">{pick(`${checklistItems.length} جنسونه د چکلیسټ کې`, `${checklistItems.length} جنس در چک‌لیست`)}</p>
                    )}
                    {editRows.map((row, idx) => (
                      <div key={idx} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-500 min-w-[1.2rem]">{idx + 1}</span>
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={row.searchText}
                              onChange={e => setEditRowSearch(idx, e.target.value)}
                              onFocus={() => setEditRowDropdown(idx, true)}
                              onBlur={() => setTimeout(() => setEditRowDropdown(idx, false), 200)}
                              className="w-full border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                              placeholder={pick("د جنس نوم / لټون...", "نام جنس / جستجو...")}
                            />
                            {row.showDropdown && (
                              <div className="absolute top-full right-0 left-0 z-[200] mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
                                {checklistLoading ? (
                                  <div className="px-3 py-2 text-xs text-gray-400">{pick("بارول...", "در حال بارگذاری...")}</div>
                                ) : getFilteredChecklist(row.searchText).length === 0 ? (
                                  <div className="px-3 py-3 text-xs text-gray-400 text-center">{pick("هیڅ جنس ونه موندل شو", "جنسی یافت نشد")}</div>
                                ) : (
                                  getFilteredChecklist(row.searchText).map(ci => (
                                    <button key={ci.id} type="button"
                                      onMouseDown={() => selectChecklistEditItem(idx, ci)}
                                      className="w-full text-right px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium text-gray-800 dark:text-white/90">{ci.item_name}</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 shrink-0">{ci.category}</span>
                                      </div>
                                      {ci.unit && <span className="text-xs text-gray-400">{pick("واحد:", "واحد:")} {ci.unit}</span>}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeEditRow(idx)}
                            disabled={editRows.length === 1}
                            className="text-red-400 hover:text-red-600 disabled:opacity-30 text-xl leading-none px-1"
                            title={pick("لرې کړئ", "حذف")}
                          >×</button>
                        </div>
                        <div className="grid grid-cols-4 gap-2 pr-6">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">{pick("واحد", "واحد")}</label>
                            <input type="text" value={row.unit}
                              onChange={e => updateEditRow(idx, 'unit', e.target.value)}
                              className="w-full border rounded-lg px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                              placeholder={pick("عدد، کیلو...", "عدد...")} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">{pick("مقدار", "مقدار")}</label>
                            <input type="number" min={1} value={row.quantity}
                              onChange={e => updateEditRow(idx, 'quantity', Number(e.target.value))}
                              className="w-full border rounded-lg px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">{pick("في قیمت", "قیمت واحد")}</label>
                            <input type="number" min={0} value={row.unitPrice}
                              onChange={e => updateEditRow(idx, 'unitPrice', Number(e.target.value))}
                              className="w-full border rounded-lg px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">{pick("مجموعه", "مجموع")}</label>
                            <div className="text-sm font-semibold text-primary py-1.5 px-2 bg-primary/5 rounded-lg">
                              {row.totalPrice > 0 ? `؋ ${row.totalPrice.toLocaleString()}` : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs uppercase">
                        <th className="py-2">{pick("جنس", "جنس")}</th>
                        <th className="py-2">{pick("مقدار", "مقدار")}</th>
                        <th className="py-2">{pick("واحد", "واحد")}</th>
                        <th className="py-2">{pick("في قیمت", "قیمت واحد")}</th>
                        <th className="py-2">{pick("مجموعه", "مجموع")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {request.items.map((item, idx) => (
                        <tr key={idx} className="border-t dark:border-gray-800">
                          <td className="py-3 font-medium text-gray-800 dark:text-white/90">{item.name}</td>
                          <td className="py-3 text-gray-600 dark:text-gray-400">{item.quantity}</td>
                          <td className="py-3 text-gray-600 dark:text-gray-400">{item.unit}</td>
                          <td className="py-3 text-gray-600 dark:text-gray-400">{item.unitPrice ? `؋ ${item.unitPrice.toLocaleString()}` : "—"}</td>
                          <td className="py-3 font-semibold text-primary">{item.totalPrice ? `؋ ${item.totalPrice.toLocaleString()}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    {request.items.some(i => (i.totalPrice || 0) > 0) && (
                      <tfoot>
                        <tr className="border-t-2 border-primary/20 dark:border-primary/30">
                          <td colSpan={4} className="py-2 text-xs font-bold text-gray-700 dark:text-gray-300 text-left">{pick("ټولټال:", "مجموع کل:")}</td>
                          <td className="py-2 font-black text-primary">
                            {"\u060B"} {request.items.reduce((s, i) => s + (i.totalPrice || 0), 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                )}
              </div>
            </div>

            {/* ReviewReturned banner for Requester */}
            {request.status === 'ReviewReturned' && profile?.role === ROLES.REQUESTER && (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800/40 p-6">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl">↩</span>
                  <div>
                    <h3 className="font-bold text-orange-800 dark:text-orange-200">
                      {pick("غوښتنه د ملاحظو سره بیرته راستانه شوه", "درخواست با نظرات بازگردانده شد")}
                    </h3>
                    <p className="text-sm text-orange-600 dark:text-orange-300 mt-1">
                      {pick(
                        "د تاییدوونکي لخوا لاندې ملاحظه ورکړل شوه. مهرباني وکړئ غوښتنه سم کړئ او بیا یې واستوئ.",
                        "تأییدکننده نظر زیر را داده است. لطفاً درخواست را اصلاح کنید و دوباره ارسال کنید."
                      )}
                    </p>
                  </div>
                </div>
                {lastReturnedComment && (
                  <div className="bg-white dark:bg-black/20 rounded-xl p-4 border border-orange-200 dark:border-orange-700 mb-4">
                    <p className="text-xs font-bold text-orange-700 dark:text-orange-300 mb-1">
                      {pick("ملاحظه:", "نظر:")}
                    </p>
                    <p className="text-sm text-gray-800 dark:text-white/80">{lastReturnedComment}</p>
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (!id || !user || !profile) return;
                    try {
                      await updateRequestStage(
                        id, 'PendingReview', 0,
                        pick('بیا بیاکتنې ته واستول شوه', 'دوباره برای پیش‌بررسی ارسال شد'),
                        { uid: user.uid, name: profile.name, role: profile.role },
                        pick('لیکوال ملاحظه سمه کړه او بیا یې واستوله', 'نویسنده نظر را اصلاح کرد و دوباره ارسال کرد')
                      );
                      fetchData(id);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition text-sm"
                >
                  {pick("↑ بیا د بیاکتنې لپاره واستول", "↑ دوباره ارسال برای پیش‌بررسی")}
                </button>
              </div>
            )}

            {/* ReturnedToConfirmer banner — only visible to Confirmer */}
            {request.status === 'ReturnedToConfirmer' && profile?.role === ROLES.REQUEST_CONFIRMER && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/40 p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">↩️</span>
                  <div>
                    <h3 className="font-bold text-amber-800 dark:text-amber-200">
                      {pick("د مقام لخوا ستاسو ته راستانه شوه", "توسط مقام به شما بازگردانده شد")}
                    </h3>
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                      {pick(
                        "مقام دا غوښتنه ملاحظه سره بیرته درلیږله. لاندې پینل کې یې وینئ او بیا یې واستوئ.",
                        "مقام این درخواست را با نظر بازگردانده. در پنل زیر ببینید و دوباره ارسال کنید."
                      )}
                    </p>
                  </div>
                </div>
                {lastSuperAdminComment && (
                  <div className="bg-white dark:bg-black/20 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">
                      {pick("د مقام ملاحظه:", "نظر مقام:")}
                    </p>
                    <p className="text-sm text-gray-800 dark:text-white/80">{lastSuperAdminComment}</p>
                  </div>
                )}
              </div>
            )}

            {/* Role-Based Action Panels */}
            {canShowConfirmerPanel && (
              <ConfirmerPanel 
                requestId={id!}
                currentStatus={request.status}
                currentLevel={request.currentRequestLevel} 
                user={{ uid: user!.uid, name: profile!.name, role: profile!.role }}
                onUpdate={() => fetchData(id!)}
                superAdminComment={lastSuperAdminComment}
                pipeline={pipeline}
              />
            )}

            {canShowSuperAdminPanel && (
              <SuperAdminPanel 
                requestId={id!}
                currentStatus={request.status}
                user={{ uid: user!.uid, name: profile!.name, role: profile!.role }}
                onUpdate={() => fetchData(id!)}
                pipeline={pipeline}
              />
            )}

            {canShowAdminPanel && (
              <AdminDecisionPanel 
                requestId={id!} 
                items={request.items}
                user={{ uid: user!.uid, name: profile!.name, role: profile!.role }}
                onUpdate={() => fetchData(id!)}
                pipeline={pipeline}
              />
            )}

            {canShowWarehouseEntryPanel && (
              <WarehouseEntryPanel
                requestId={id!}
                currentStatus={request.status}
                user={{ uid: user!.uid, name: profile!.name, role: profile!.role }}
                requesterName={request.requesterName}
                hasProposal={!!request.formInstances?.proposalId}
                hasFS5={!!request.formInstances?.fs5Id}
                requesterPersonId={request.personId}
                items={request.items}
                pipeline={pipeline}
                onUpdate={() => fetchData(id!)}
              />
            )}

            {canShowRequesterFS5Panel && (
              <RequesterFS5Panel
                requestId={id!}
                user={{ uid: user!.uid, name: profile!.name, role: profile!.role }}
                onUpdate={() => fetchData(id!)}
                onOpenProposalForm={() => openForm('Proposal')}
                onOpenFS5Form={() => openForm('FS-5')}
                onCreateAndSubmit={createAndSubmitDeliveryForms}
                hasProposal={!!request.formInstances?.proposalId}
                hasFS5={!!request.formInstances?.fs5Id}
              />
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-6 border-b pb-2 dark:border-gray-700">{pick("د اجرااتو تاریخچه", "تاریخچه اجراات")}</h3>
              <PipelineTimeline history={pipeline} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">{pick("رسمي فورمونه", "فورم‌های رسمی")}</h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => openForm('Proposal')}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
                      request.formInstances?.proposalId ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 hover:border-primary text-gray-700'
                    }`}
                  >
                    <span className="font-bold text-sm">{pick("پیشنهاد", "پروپوزل")}</span>
                    {request.formInstances?.proposalId ? '✅' : '⏳'}
                  </button>
                  <button 
                    onClick={() => openForm('SI-9')}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
                      request.formInstances?.si9Id ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 hover:border-primary text-gray-700'
                    }`}
                  >
                    <span className="font-bold text-sm">ف، س، ۹</span>
                    {request.formInstances?.si9Id ? '✅' : '⏳'}
                  </button>
                </div>
              </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-4 border-b pb-2 dark:border-gray-700">{pick("پرمختګ", "پیشرفت")}</h3>
              {(() => {
                const wf = getWorkflowStage(request.status);
                // First round: canonical workflow.ts values.
                // Second round (FS5 cycle): hardcoded per-status values so display is
                // correct even for old requests where stored pipeline progress=0.
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
                const configuredPct = isSecondRound
                  ? (SECOND_ROUND_PROGRESS[request.status] ?? wf.progressPercent)
                  : wf.progressPercent;
                // The database is the authoritative source after hosting. This
                // also keeps migrated legacy requests (such as FS5Required)
                // aligned with their canonical 82% delivery stage.
                const pct = Math.max(request.progress ?? 0, configuredPct);
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold py-1 px-2 rounded-full text-primary bg-primary/10">{pct}%</span>
                      {wf.workflowComplete && (
                        <span className="text-xs font-bold text-green-600 bg-green-50 py-1 px-2 rounded-full">✓ بشپړه</span>
                      )}
                    </div>
                    <div className="overflow-hidden h-2 rounded bg-gray-200 dark:bg-gray-800">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full transition-all duration-500 rounded ${wf.workflowComplete ? 'bg-green-500' : 'bg-primary'}`}
                      />
                    </div>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{wf.stage_ps}</p>
                    {wf.assignedRole_ps && !wf.workflowComplete && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1">{pick("مسئول:", "مسؤول:")}</p>
                        <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">{wf.assignedRole_ps}</p>
                      </div>
                    )}
                    {wf.nextAction_ps && !wf.workflowComplete && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg p-3">
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mb-1">{pick("بل ګام:", "اقدام بعدی:")}</p>
                        <p className="text-sm text-amber-800 dark:text-amber-300">{wf.nextAction_ps}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Draft - Requester can submit */}
            {request.status === 'Draft' && profile?.role === ROLES.REQUESTER && (
              <div className="rounded-2xl border border-dashed border-primary bg-primary/5 p-6 text-center">
                <p className="text-sm text-primary mb-4 font-bold">
                  {pick("غوښتنه د بیاکتنې لپاره واستوئ!", "درخواست را برای پیش‌بررسی ارسال کنید!")}
                </p>
                <Button onClick={submitRequest} variant="primary" fullWidth>
                  {pick("د بیاکتنې لپاره واستول", "ارسال برای پیش‌بررسی")}
                </Button>
              </div>
            )}

            {/* PendingReview status info for Requester */}
            {request.status === 'PendingReview' && profile?.role === ROLES.REQUESTER && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800/40 p-5 text-center">
                <span className="text-2xl">🔍</span>
                <p className="text-sm font-bold text-blue-700 dark:text-blue-200 mt-2">
                  {pick("غوښتنه د بیاکتنې لپاره لیږل شوه", "درخواست برای پیش‌بررسی ارسال شده")}
                </p>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                  {pick("د تاییدوونکي د بیاکتنې انتظار کوئ...", "در انتظار بررسی تأییدکننده...")}
                </p>
              </div>
            )}

            {/* Submitted - waiting for official confirmation */}
            {request.status === 'Submitted' && profile?.role === ROLES.REQUESTER && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800/40 p-5 text-center">
                <span className="text-2xl">📋</span>
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-200 mt-2">
                  {pick("غوښتنه د رسمي تایید لپاره ده", "درخواست در انتظار تأیید رسمی")}
                </p>
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                  {pick("د تاییدوونکي د رسمي تایید انتظار کوئ...", "در انتظار تأیید رسمی تأییدکننده...")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
