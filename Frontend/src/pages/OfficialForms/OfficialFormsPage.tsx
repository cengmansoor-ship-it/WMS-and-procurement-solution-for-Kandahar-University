import { useMemo, useState, useEffect, useCallback } from "react";
import PageMeta from "../../components/common/PageMeta";
import OfficialFormViewer from "../../components/OfficialFormViewer";
import type { OfficialTemplateId, OfficialFormSharedData } from "../../components/OfficialFormViewer";
import { getRequests, updateRequestStage } from "../../firebase/requests";
import type { InventoryRequest } from "../../firebase/requests";
import { getWorkflowStage } from "../../constants/workflow";
import { getVendorOffers } from "../../firebase/procurement";
import type { VendorOffer, ReceiptReportRecord } from "../../firebase/procurement";
import type { FS5Document } from "../../firebase/receiving";
import { getLocalItem, setLocalItem } from "../../firebase/localStore";
import { buildAllFormsData } from "../../utils/officialFormDataAdapter";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";

type FormMeta = {
  id: OfficialTemplateId;
  key: string;
  title: string;
  menu: "غوښتنې" | "تدارکات" | "ترلاسه کول" | "ټول فورمونه";
  phase: string;
  minProgress: number;
};

const forms: FormMeta[] = [
  { id: "formTemplate0", key: "proposal",      title: "پیشنهاد",       menu: "غوښتنې",      phase: "د غوښتنې پیل",            minProgress: 0  },
  { id: "formTemplate5", key: "si9",           title: "ف، س، ۹",       menu: "غوښتنې",      phase: "د غوښتنې رسمي ضمیمه",     minProgress: 0  },
  { id: "formTemplate1", key: "tender",        title: "جګړه پاڼه",     menu: "تدارکات",     phase: "درې قیمتونه",              minProgress: 20 },
  { id: "formTemplate2", key: "comparison",    title: "فورم مقایسوي",  menu: "تدارکات",     phase: "د ټیټې بیې ټاکنه",        minProgress: 35 },
  { id: "formTemplate3", key: "purchaseOrder", title: "آمر خریداري",   menu: "تدارکات",     phase: "د ګټونکي شرکت امر",       minProgress: 55 },
  { id: "formTemplate4", key: "receiptReport", title: "راپور رسید",    menu: "ترلاسه کول",  phase: "ګدام ته داخلول",           minProgress: 65 },
  { id: "formTemplate6", key: "fs5",           title: "ف، س، ۵",       menu: "ترلاسه کول",  phase: "تسلیمي او موجودي کمول",   minProgress: 80 },
];

const menus = ["ټول فورمونه", "غوښتنې", "تدارکات", "ترلاسه کول"];
const levels = ["ټولې درجې", "ډېر عاجل", "ډېر مهم", "متوسط", "عادي", "لږ مهم"];

// Canonical stage progression order for idempotency checks
const STAGE_ORDER = [
  "Draft", "Submitted", "ConfirmedByRequestConfirmer", "RejectedByRequestConfirmer",
  "ApprovedBySuperAdmin", "RejectedBySuperAdmin", "StockAvailable", "StockNotAvailable",
  "ProcurementPending", "TenderCreated", "OffersReceived", "ComparisonCreated",
  "WinnerSelected", "PurchaseOrderCreated", "ReceiptReportCreated", "ReceivedToInventory",
  "FS5Created", "Delivered", "Completed",
];

const stageIndex = (s: string) => {
  const idx = STAGE_ORDER.indexOf(s);
  return idx === -1 ? 0 : idx;
};

const isAtOrPast = (current: string, target: string) =>
  stageIndex(current) >= stageIndex(target);

const STAGE_PASHTO: Record<string, string> = {
  Draft: "مسوده",
  Submitted: "سپارل شوی",
  ConfirmedByRequestConfirmer: "تأییدیه لرونکي تأیید کړی",
  RejectedByRequestConfirmer: "تأییدیه لرونکي رد کړی",
  ApprovedBySuperAdmin: "لوی مدیر تأیید کړی",
  RejectedBySuperAdmin: "لوی مدیر رد کړی",
  StockAvailable: "موجودي شته",
  StockNotAvailable: "موجودي نشته",
  ProcurementPending: "تدارکات پیل شول",
  TenderCreated: "جګړه پاڼه جوړه شوه",
  OffersReceived: "آفرونه ترلاسه شول",
  ComparisonCreated: "مقایسه جوړه شوه",
  WinnerSelected: "ګټونکی وټاکل شو",
  PurchaseOrderCreated: "آمر خریداري جوړ شو",
  ReceiptReportCreated: "راپور رسید جوړ شو",
  ReceivedToInventory: "ګدام ته داخل شو",
  FS5Created: "ف، س، ۵ جوړ شو",
  Delivered: "تسلیم شو",
  Completed: "بشپړ شو",
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface WfFlag {
  applied: boolean;
  appliedAt: string;
  fromStatus: string;
  toStatus: string;
}

export default function OfficialFormsPage() {
  const { user, profile } = useAuth();
  const isSuperAdmin = profile?.role === ROLES.SUPER_ADMIN;
  const isRequester = profile?.role === ROLES.REQUESTER;
  const [activeTemplateId, setActiveTemplateId] = useState<OfficialTemplateId>("formTemplate0");
  const [menuFilter, setMenuFilter] = useState("ټول فورمونه");
  const [levelFilter, setLevelFilter] = useState("ټولې درجې");
  const [requestId, setRequestId] = useState("");

  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [vendorOffers, setVendorOffers] = useState<VendorOffer[]>([]);
  const [receiptReport, setReceiptReport] = useState<ReceiptReportRecord | null>(null);
  const [fs5, setFs5] = useState<FS5Document | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string>("");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");

  useEffect(() => {
    getRequests().then(setRequests).catch(() => {});
  }, []);

  const fetchRequestData = useCallback(async (reqId: string) => {
    if (!reqId) {
      setVendorOffers([]);
      setReceiptReport(null);
      setFs5(null);
      return;
    }
    setDataLoading(true);
    try {
      const [offers, rr, fs5Doc] = await Promise.allSettled([
        getVendorOffers(reqId),
        Promise.resolve(
          getLocalItem<ReceiptReportRecord[]>("receipt_reports", []).find(
            (r) => r.requestId === reqId || r.id === reqId
          ) || null
        ),
        Promise.resolve(getLocalItem<FS5Document | null>(`fs5_${reqId}`, null)),
      ]);

      setVendorOffers(offers.status === "fulfilled" ? offers.value : []);
      setReceiptReport(rr.status === "fulfilled" ? rr.value : null);
      setFs5(fs5Doc.status === "fulfilled" ? fs5Doc.value : null);
    } catch {
      setVendorOffers([]);
      setReceiptReport(null);
      setFs5(null);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequestData(requestId);
  }, [requestId, fetchRequestData]);

  const [refreshing, setRefreshing] = useState(false);

  // Re-fetch requests after save to reflect updated progress
  const refreshRequests = useCallback(() => {
    getRequests().then(setRequests).catch(() => {});
  }, []);

  const handleRefreshRequests = useCallback(() => {
    setRefreshing(true);
    getRequests()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  const activeRequest = useMemo(
    () => requests.find((r) => r.id === requestId) || null,
    [requests, requestId]
  );

  const allFormsData = useMemo<Record<string, OfficialFormSharedData>>(() => {
    if (!activeRequest) return {};
    return buildAllFormsData(
      activeRequest,
      vendorOffers.length > 0 ? vendorOffers : undefined,
      receiptReport,
      fs5
    );
  }, [activeRequest, vendorOffers, receiptReport, fs5]);

  const currentForm = forms.find((f) => f.id === activeTemplateId) || forms[0];
  const visibleForms = forms.filter(
    (f) => menuFilter === "ټول فورمونه" || f.menu === menuFilter
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter((r) => {
        const levelOk = levelFilter === "ټولې درجې" || r.currentRequestLevel === levelFilter;
        const ownerOk = !isRequester || r.requesterName === profile?.name;
        return levelOk && ownerOk;
      }),
    [requests, levelFilter, isRequester, profile?.name]
  );

  useEffect(() => {
    if (!isRequester || requestId) return;
    if (filteredRequests.length > 0) {
      const last = filteredRequests[filteredRequests.length - 1];
      if (last) setRequestId(last.id);
    }
  }, [isRequester, filteredRequests.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Workflow progress connection ────────────────────────────────────────────

  const handleSave = useCallback(
    async (data: Record<string, unknown>) => {
      if (!requestId || !data) return;

      setSaveStatus("saving");
      setSaveError("");

      // 1. Always persist form data to localStorage (idempotent)
      try {
        const storageKey = `ku_req_${requestId}_form_${currentForm.key}`;
        const now = new Date().toISOString();
        localStorage.setItem(storageKey, JSON.stringify({ ...data, savedAt: now }));
        setLastSavedAt(now);
      } catch {
        setSaveStatus("error");
        setSaveError("د فورم ذخیره کول ناکام شول.");
        return;
      }

      // 2. If no request selected or no authenticated user, just save data
      if (!activeRequest || !user || !profile) {
        setSaveStatus("saved");
        return;
      }

      const currentStatus = activeRequest.status || "";
      const formKey = currentForm.key;
      const userObj = { uid: user.uid, name: profile.name, role: profile.role };

      // Idempotency flag key
      const wfFlagKey = `ku_req_${requestId}_wf_${formKey}`;

      try {
        // ── proposal ── just save, no workflow advance ──────────────────────
        if (formKey === "proposal" || formKey === "si9") {
          // No workflow advance for proposal/SI9 from forms page.
          // Submission goes through the normal request confirmation flow.
          setSaveStatus("saved");
          return;
        }

        // ── tender ── advance to TenderCreated (35%) ────────────────────────
        if (formKey === "tender") {
          const validFrom = ["StockNotAvailable", "ProcurementPending"];
          const target = "TenderCreated";
          if (validFrom.includes(currentStatus) && !isAtOrPast(currentStatus, target)) {
            const existing = getLocalItem<WfFlag | null>(wfFlagKey, null);
            if (!existing?.applied) {
              await updateRequestStage(
                requestId,
                target,
                35,
                "جګړه پاڼه ذخیره شوه",
                userObj,
                "رسمي جګړه پاڼه ذخیره شوه"
              );
              setLocalItem(wfFlagKey, {
                applied: true,
                appliedAt: new Date().toISOString(),
                fromStatus: currentStatus,
                toStatus: target,
              } as WfFlag);
              refreshRequests();
            }
          } else if (isAtOrPast(currentStatus, target)) {
            // Already at or past TenderCreated — just save data, no re-advance
          } else {
            // Not at a valid stage for this form yet — just save data
          }
          setSaveStatus("saved");
          return;
        }

        // ── comparison ── advance to ComparisonCreated (55%) ────────────────
        if (formKey === "comparison") {
          const validFrom = ["TenderCreated", "OffersReceived"];
          const target = "ComparisonCreated";
          if (validFrom.includes(currentStatus) && !isAtOrPast(currentStatus, target)) {
            if (vendorOffers.length < 3) {
              setSaveStatus("error");
              setSaveError("د مقایسوي فورم لپاره لږ تر لږه ۳ آفرونه اړین دي. اوس مهال " + vendorOffers.length + " آفر موجود دی.");
              return;
            }
            const existing = getLocalItem<WfFlag | null>(wfFlagKey, null);
            if (!existing?.applied) {
              await updateRequestStage(
                requestId,
                target,
                55,
                "مقایسوي فورم ذخیره شو",
                userObj,
                "رسمي مقایسوي فورم ذخیره شو"
              );
              setLocalItem(wfFlagKey, {
                applied: true,
                appliedAt: new Date().toISOString(),
                fromStatus: currentStatus,
                toStatus: target,
              } as WfFlag);
              refreshRequests();
            }
          }
          setSaveStatus("saved");
          return;
        }

        // ── purchaseOrder ── advance to PurchaseOrderCreated (70%) ──────────
        if (formKey === "purchaseOrder") {
          const validFrom = ["ComparisonCreated", "WinnerSelected"];
          const target = "PurchaseOrderCreated";
          if (validFrom.includes(currentStatus) && !isAtOrPast(currentStatus, target)) {
            const existing = getLocalItem<WfFlag | null>(wfFlagKey, null);
            if (!existing?.applied) {
              await updateRequestStage(
                requestId,
                target,
                70,
                "آمر خریداري ذخیره شو",
                userObj,
                "رسمي آمر خریداري ذخیره شو"
              );
              setLocalItem(wfFlagKey, {
                applied: true,
                appliedAt: new Date().toISOString(),
                fromStatus: currentStatus,
                toStatus: target,
              } as WfFlag);
              refreshRequests();
            }
          }
          setSaveStatus("saved");
          return;
        }

        // ── receiptReport ── advance to ReceivedToInventory (80%) ───────────
        if (formKey === "receiptReport") {
          const validFrom = ["PurchaseOrderCreated", "ReceiptReportCreated"];
          const target = "ReceivedToInventory";
          if (validFrom.includes(currentStatus) && !isAtOrPast(currentStatus, target)) {
            const existing = getLocalItem<WfFlag | null>(wfFlagKey, null);
            if (!existing?.applied) {
              await updateRequestStage(
                requestId,
                target,
                80,
                "راپور رسید ذخیره شو",
                userObj,
                "رسمي راپور رسید ذخیره شو — اجناس ګدام ته داخل شول"
              );
              setLocalItem(wfFlagKey, {
                applied: true,
                appliedAt: new Date().toISOString(),
                fromStatus: currentStatus,
                toStatus: target,
              } as WfFlag);
              refreshRequests();
            }
          }
          setSaveStatus("saved");
          return;
        }

        // ── fs5 ── advance to FS5Created (90%) ──────────────────────────────
        if (formKey === "fs5") {
          const validFrom = ["ReceivedToInventory", "ReceiptReportCreated", "StockAvailable"];
          const target = "FS5Created";
          if (validFrom.includes(currentStatus) && !isAtOrPast(currentStatus, target)) {
            const existing = getLocalItem<WfFlag | null>(wfFlagKey, null);
            if (!existing?.applied) {
              await updateRequestStage(
                requestId,
                target,
                90,
                "ف، س، ۵ ذخیره شو",
                userObj,
                "رسمي ف، س، ۵ فورم ذخیره شو — تسلیمي پیل شوه"
              );
              setLocalItem(wfFlagKey, {
                applied: true,
                appliedAt: new Date().toISOString(),
                fromStatus: currentStatus,
                toStatus: target,
              } as WfFlag);
              refreshRequests();
            }
          }
          setSaveStatus("saved");
          return;
        }

        setSaveStatus("saved");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "د پرمختګ ذخیره کول ناکام شول.";
        setSaveStatus("error");
        setSaveError(msg);
      }
    },
    [requestId, currentForm.key, activeRequest, user, profile, vendorOffers, refreshRequests]
  );

  // Reset save status when form or request changes
  useEffect(() => {
    setSaveStatus("idle");
    setSaveError("");
  }, [activeTemplateId, requestId]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const formatSaveTime = (iso: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("fa-AF", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const stagePashto = activeRequest ? (STAGE_PASHTO[activeRequest.status] || activeRequest.status) : "";

  return (
    <>
      <PageMeta title="رسمي فورمونه" description="رسمي تدارکاتي او ګدامي فورمونه" />
      <div className="flex flex-col gap-4" dir="rtl">

        {/* Header */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white/90">رسمي فورمونه</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            اووه رسمي فورمونه — د غوښتنې، تدارکاتو، ترلاسه کولو او تسلیمۍ لپاره.
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <select
            className="rounded-xl border border-gray-200 bg-white p-3 text-right dark:border-gray-800 dark:bg-gray-900"
            value={menuFilter}
            onChange={(e) => setMenuFilter(e.target.value)}
          >
            {menus.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select
            className="rounded-xl border border-gray-200 bg-white p-3 text-right dark:border-gray-800 dark:bg-gray-900"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            {levels.map((l) => <option key={l}>{l}</option>)}
          </select>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-xl border border-gray-200 bg-white p-3 text-right dark:border-gray-800 dark:bg-gray-900"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
            >
              <option value="">— غوښتنه وټاکئ —</option>
              {filteredRequests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.faculty} · {r.requesterName} · {getWorkflowStage(r.status).progressPercent}%
                </option>
              ))}
            </select>
            <button
              onClick={handleRefreshRequests}
              disabled={refreshing}
              title="د غوښتنو لیست تازه کړئ"
              className="rounded-xl border border-gray-200 bg-white px-3 text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              {refreshing ? "⏳" : "🔄"}
            </button>
          </div>
        </div>

        {/* Active request info bar */}
        {activeRequest && (
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm text-brand-700 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-400">
            <div className="flex flex-wrap gap-4 items-center">
              <span>فعاله غوښتنه: <strong>{activeRequest.faculty}</strong></span>
              <span>غوښتونکی: <strong>{activeRequest.requesterName}</strong></span>
              <span>درجه: <strong>{activeRequest.currentRequestLevel}</strong></span>
              <span>پرمختګ: <strong>{getWorkflowStage(activeRequest.status).progressPercent}%</strong></span>
              <span>وضعیت: <strong>{activeRequest.status}</strong></span>
              {dataLoading && <span className="text-xs opacity-70">معلومات بارول کیږي...</span>}
              {vendorOffers.length > 0 && (
                <span className="text-xs text-green-700 dark:text-green-400">
                  {vendorOffers.length} آفر موجود
                </span>
              )}
              {receiptReport && (
                <span className="text-xs text-blue-700 dark:text-blue-400">راپور رسید موجود</span>
              )}
              {fs5 && (
                <span className="text-xs text-purple-700 dark:text-purple-400">ف، س، ۵ موجود</span>
              )}
            </div>
          </div>
        )}

        {/* Form tiles — clickable for ALL users */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          {visibleForms.map((form) => {
            const isActiveTile = activeTemplateId === form.id;
            const hasData = !!allFormsData[form.id];
            return (
              <button
                key={form.id}
                type="button"
                onClick={() => setActiveTemplateId(form.id)}
                className={`rounded-xl border p-3 text-right transition ${
                  isActiveTile
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10"
                    : "border-gray-200 bg-white text-gray-700 hover:border-brand-400 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300"
                }`}
              >
                <span className="block text-xs font-bold">{form.title}</span>
                <span className="mt-0.5 block text-xs opacity-60">{form.phase}</span>
                {hasData && (
                  <span className="mt-1 inline-block rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Document Editor — all roles except Requester (full edit) ───── */}
        {!isRequester && (
          <>
            {/* Progress / status indicator */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900/50">
              <div className="flex items-center gap-3 text-sm">
                {activeRequest ? (
                  <>
                    <span className="font-bold text-gray-700 dark:text-gray-200">{stagePashto}</span>
                    <span className="text-gray-400">·</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-2 rounded-full bg-brand-500 transition-all"
                          style={{ width: `${getWorkflowStage(activeRequest.status).progressPercent}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                        {getWorkflowStage(activeRequest.status).progressPercent}٪
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-gray-400 text-xs">غوښتنه غوره کړئ</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {saveStatus === "saving" && (
                  <span className="text-amber-600 dark:text-amber-400 animate-pulse">ذخیره کیږي...</span>
                )}
                {saveStatus === "saved" && (
                  <span className="text-green-600 dark:text-green-400">
                    ✓ ذخیره شو
                    {lastSavedAt && <span className="mr-1 opacity-70">— {formatSaveTime(lastSavedAt)}</span>}
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="text-red-600 dark:text-red-400">✗ {saveError || "ذخیره ناکامه شوه"}</span>
                )}
                {saveStatus === "idle" && lastSavedAt && (
                  <span className="text-gray-400">وروستی ذخیره: {formatSaveTime(lastSavedAt)}</span>
                )}
              </div>
            </div>

            {/* Form viewer — editing enabled for all non-Requester roles */}
            <div>
              <OfficialFormViewer
                templateId={activeTemplateId}
                requestId={requestId || undefined}
                allFormsData={Object.keys(allFormsData).length > 0 ? allFormsData : undefined}
                initialData={allFormsData[activeTemplateId]}
                onSave={handleSave}
                readOnly={false}
              />
            </div>
          </>
        )}

        {/* ── Requester: readonly view — see form, no editing, can print ── */}
        {isRequester && (
          <>
            {/* Info bar */}
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-right dark:border-green-900/40 dark:bg-green-900/10">
              <div className="flex items-center gap-3">
                <span className="text-xl">📄</span>
                <div>
                  <p className="font-bold text-green-800 dark:text-green-300 text-sm">
                    د پیشنهاد فورم — یوازې لیدل او چاپ
                  </p>
                  <p className="mt-0.5 text-xs text-green-700 dark:text-green-400">
                    د ستاسو غوښتنه معلومات د پیشنهاد فورم کې اتومات ډک شوي دي. کولای شئ وچاپوئ.
                  </p>
                </div>
              </div>
            </div>

            {/* Request status */}
            {activeRequest && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900/50 text-sm">
                <span className="font-bold text-gray-700 dark:text-gray-200">{stagePashto}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600 dark:text-gray-300">{activeRequest.currentRequestLevel}</span>
                <span className="text-gray-400">·</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-2 rounded-full bg-brand-500 transition-all"
                      style={{ width: `${getWorkflowStage(activeRequest.status).progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                    {getWorkflowStage(activeRequest.status).progressPercent}٪
                  </span>
                </div>
              </div>
            )}

            {/* Readonly form viewer */}
            {requestId ? (
              <OfficialFormViewer
                templateId={activeTemplateId}
                requestId={requestId}
                allFormsData={Object.keys(allFormsData).length > 0 ? allFormsData : undefined}
                initialData={allFormsData[activeTemplateId]}
                readOnly={true}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center dark:border-gray-700 dark:bg-gray-900/30">
                <p className="text-gray-400 text-sm">
                  مهرباني وکړئ خپله غوښتنه وټاکئ ترڅو د پیشنهاد فورم وګورئ.
                </p>
              </div>
            )}
          </>
        )}

      </div>
    </>
  );
}
