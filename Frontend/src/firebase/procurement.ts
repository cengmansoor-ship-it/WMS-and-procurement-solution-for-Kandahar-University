import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { getLocalItem, setLocalItem, makeLocalId } from "./localStore";
import { getCurrentHijriDates } from "../utils/dateUtils";
import { logAuditEvent } from "./audit";
import { updateRequestStage, InventoryRequest } from "./requests";
import { apiClient } from "../api/apiClient";

const normalizeProcurementStatus = (raw: string | undefined): string => {
  const status = String(raw || "").trim();
  const map: Record<string, string> = {
    OPEN: "ProcurementPending",
    TENDER_CREATED: "TenderCreated",
    OFFERS_RECEIVED: "OffersReceived",
    COMPARISON_CREATED: "ComparisonCreated",
    WINNER_SELECTED: "WinnerSelected",
    PO_CREATED: "PurchaseOrderCreated",
    RECEIPT_REPORT_CREATED: "ReceiptReportCreated",
  };
  return map[status.toUpperCase()] || status || "ProcurementPending";
};

const procurementProgressForStatus = (status: string): number => {
  const map: Record<string, number> = {
    ProcurementPending: 25,
    TenderCreated: 35,
    OffersReceived: 45,
    ComparisonCreated: 55,
    WinnerSelected: 65,
    PurchaseOrderCreated: 70,
    ReceiptReportCreated: 75,
  };
  return map[status] ?? 20;
};

const mapProcurementFromApi = (apiProc: any): ProcurementRecord => ({
  id: apiProc.id ? apiProc.id.toString() : "",
  requestId: apiProc.request_id?.toString() || "",
  requesterId: "",
  requesterName: "",
  requestLevel: "عادي",
  status: normalizeProcurementStatus(apiProc.status),
  progress: procurementProgressForStatus(normalizeProcurementStatus(apiProc.status)),
  createdAt: apiProc.created_at ? new Date(apiProc.created_at).getTime() : Date.now(),
  createdAtHijriShamsi: "",
  createdAtHijriQamari: "",
  updatedAt: apiProc.updated_at ? new Date(apiProc.updated_at).getTime() : Date.now(),
  updatedAtHijriShamsi: "",
  updatedAtHijriQamari: "",
  isDeleted: false,
  purchaseOrderId: apiProc.purchase_order?.id?.toString()
});

const mapOfferFromApi = (apiOffer: any): VendorOffer => {
  let details: any = {};
  try {
    details = typeof apiOffer.details_json === "string"
      ? JSON.parse(apiOffer.details_json)
      : (apiOffer.details_json || {});
  } catch {
    details = {};
  }

  const rawItems = Array.isArray(apiOffer.items)
    ? apiOffer.items
    : (Array.isArray(details.items) ? details.items : []);

  const items = rawItems.map((item: any) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price ?? item.unitPrice) || 0;
    const totalPrice = Number(item.total_price ?? item.totalPrice) || (quantity * unitPrice);
    return {
      itemId: String(item.item_id ?? item.itemId ?? ""),
      itemName: item.item_name ?? item.itemName ?? "",
      specifications: item.specifications ?? "",
      quantity,
      unit: item.unit ?? "",
      unitPrice,
      totalPrice,
    };
  });

  const calculatedTotal = items.reduce((sum: number, item: any) => sum + (Number(item.totalPrice) || 0), 0);

  return {
    id: apiOffer.id ? apiOffer.id.toString() : "",
    requestId: apiOffer.request_id?.toString() || "",
    procurementId: apiOffer.procurement_case_id?.toString() || "",
    vendorName: apiOffer.vendor_name || "",
    vendorPhone: apiOffer.vendor_phone || "",
    vendorAddress: apiOffer.vendor_address || "",
    items,
    totalOfferPrice: Number(apiOffer.total_price ?? apiOffer.total_amount) || calculatedTotal,
    deliveryTime: String(details.delivery_time ?? apiOffer.delivery_time_days ?? ""),
    warrantyOrNotes: details.warranty_or_notes ?? apiOffer.warranty_terms ?? "",
    isWinner: Boolean(apiOffer.is_winner),
    offerDate: apiOffer.created_at ? new Date(apiOffer.created_at).getTime() : Date.now(),
    offerDateHijriShamsi: "",
    offerDateHijriQamari: "",
    createdBy: "",
    createdAt: apiOffer.created_at ? new Date(apiOffer.created_at).getTime() : Date.now(),
    updatedAt: apiOffer.updated_at ? new Date(apiOffer.updated_at).getTime() : Date.now()
  };
};

// --- Types ---

export interface ProcurementRecord {
  id: string;
  requestId: string;
  requestNumber?: string;
  requesterId: string;
  requesterName: string;
  requestLevel: string;
  status: string;
  progress: number;
  assignedToProcurementDirector?: string;
  createdAt: number;
  createdAtHijriShamsi: string;
  createdAtHijriQamari: string;
  updatedAt: number;
  updatedAtHijriShamsi: string;
  updatedAtHijriQamari: string;
  isDeleted: boolean;
  purchaseOrderId?: string;
  receiptReportId?: string;
}

export interface VendorOffer {
  id: string;
  requestId: string;
  procurementId: string;
  vendorName: string;
  vendorPhone: string;
  vendorAddress: string;
  items: {
    itemId: string;
    itemName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    specifications?: string;
  }[];
  totalOfferPrice: number;
  isWinner?: boolean;
  deliveryTime: string;
  warrantyOrNotes: string;
  offerDate: number;
  offerDateHijriShamsi: string;
  offerDateHijriQamari: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface ComparisonRecord {
  id: string;
  requestId: string;
  procurementId: string;
  winnerVendorId?: string;
  winnerVendorName?: string;
  winnerTotalPrice?: number;
  selectionReason: string;
  createdBy: string;
  createdAt: number;
  createdAtHijriShamsi: string;
  createdAtHijriQamari: string;
}

export interface PurchaseOrderRecord {
  id: string;
  requestId: string;
  procurementId: string;
  vendorId: string;
  vendorName: string;
  totalPrice: number;
  status: 'Draft' | 'Submitted';
  createdBy: string;
  createdByName: string;
  createdAt: number;
  createdAtHijriShamsi: string;
}

export interface ReceiptReportRecord {
  id: string;
  requestId: string;
  procurementId: string;
  purchaseOrderId: string;
  vendorName: string;
  receivedItems: any[];
  status: 'Draft' | 'Submitted';
  receivedBy: string;
  receivedByName: string;
  createdAt: number;
  createdAtHijriShamsi: string;
}

const PROCUREMENTS_COL = "procurements";
const OFFERS_COL = "vendor_offers";
const COMPARISON_COL = "comparison_records";
const PO_COL = "purchase_orders";
const RR_COL = "receipt_reports";

const parseApiErrorMessage = (error: any): string | null => {
  const raw = error?.message || "";
  const jsonStart = raw.indexOf("{");
  if (jsonStart === -1) return null;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart));
    return parsed.message || null;
  } catch {
    return null;
  }
};

const isBlockingApiError = (error: any): boolean => /^HTTP (400|404|409):/.test(error?.message || "");

const PROCUREMENT_PROGRESS: Record<string, number> = {
  TenderCreated: 35,
  OffersReceived: 45,
  ComparisonCreated: 55,
  WinnerSelected: 65,
  PurchaseOrderCreated: 70,
  ReceiptReportCreated: 75,
};

const resolveRequestIdForProcurement = async (procurementId: string, fallbackRequestId: string): Promise<string> => {
  if (fallbackRequestId && fallbackRequestId !== procurementId) return fallbackRequestId;

  const localProc = getLocalItem<ProcurementRecord[]>("procurements", []).find((entry) => entry.id === procurementId);
  if (localProc?.requestId) return localProc.requestId;

  try {
    const apiProc = await apiClient.get(`/procurement/${procurementId}`);
    if (apiProc?.request_id) return String(apiProc.request_id);
  } catch {
    // Keep the original id when the backend is unavailable.
  }

  return fallbackRequestId || procurementId;
};

// --- Service Functions ---

export const createProcurementCase = async (requestId: string): Promise<number> => {
  const result = await apiClient.post(`/procurement/from-request/${requestId}`, {});
  const id = Number(result?.id ?? result);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("د تدارکاتو قضیې آیدی ترلاسه نه شو.");
  }
  return id;
};

export const getOrCreateProcurement = async (request: InventoryRequest, userId: string) => {
  const dates = getCurrentHijriDates();

  try {
    const existingCases = await apiClient.get('/procurement');
    let proc = existingCases.find((c: any) => c.request_id?.toString() === request.id);
    if (!proc) {
      proc = await apiClient.post(`/procurement/from-request/${request.id}`, {});
    }
    return mapProcurementFromApi(proc);
  } catch (apiError) {
    console.warn("Backend getOrCreateProcurement failed; falling back to Firebase/Local");
    if (!isFirebaseConfigured) {
      const existing = getLocalItem<ProcurementRecord[]>("procurements", []).find((entry) => entry.id === request.id);
      if (existing) return existing;
      const newProc: ProcurementRecord = {
        id: request.id,
        requestId: request.id,
        requesterId: request.requesterId,
        requesterName: request.requesterName,
        requestLevel: request.currentRequestLevel,
        status: request.status === "PurchaseOrderCreated" ? "PurchaseOrderCreated" : "ProcurementPending",
        progress: request.progress || 20,
        createdAt: dates.timestamp,
        createdAtHijriShamsi: dates.shamsi,
        createdAtHijriQamari: dates.qamari,
        updatedAt: dates.timestamp,
        updatedAtHijriShamsi: dates.shamsi,
        updatedAtHijriQamari: dates.qamari,
        isDeleted: false,
      };
      setLocalItem("procurements", [newProc, ...getLocalItem<ProcurementRecord[]>("procurements", [])]);
      return newProc;
    }

    const procRef = doc(db, PROCUREMENTS_COL, request.id);
    const snap = await getDoc(procRef);
    if (snap.exists()) return snap.data() as ProcurementRecord;

    const newProc: ProcurementRecord = {
      id: request.id,
      requestId: request.id,
      requesterId: request.requesterId,
      requesterName: request.requesterName,
      requestLevel: request.currentRequestLevel,
      status: 'ProcurementPending',
      progress: 20,
      createdAt: dates.timestamp,
      createdAtHijriShamsi: dates.shamsi,
      createdAtHijriQamari: dates.qamari,
      updatedAt: dates.timestamp,
      updatedAtHijriShamsi: dates.shamsi,
      updatedAtHijriQamari: dates.qamari,
      isDeleted: false,
    };
    await setDoc(procRef, newProc);
    await logAuditEvent(userId, 'System', 'procurement_created' as any, { requestId: request.id });
    return newProc;
  }
};

export const getProcurementById = async (id: string) => {
  try {
    const apiProc = await apiClient.get(`/procurement/${id}`);
    if (apiProc) return mapProcurementFromApi(apiProc);
  } catch (apiError) {
    console.warn(`Backend getProcurementById failed for ${id}; falling back to Firebase/Local`);
    if (!isFirebaseConfigured) return getLocalItem<ProcurementRecord[]>("procurements", []).find((entry) => entry.id === id) || null;
    const snap = await getDoc(doc(db, PROCUREMENTS_COL, id));
    if (snap.exists()) return snap.data() as ProcurementRecord;
    return null;
  }
};

export const updateProcurementStatus = async (
  procurementId: string, 
  status: string, 
  progress: number, 
  user: { uid: string, name: string, role: string },
  stage: string,
  comment: string = "",
  requestId: string = procurementId
) => {
  const dates = getCurrentHijriDates();
  const stageRequestId = await resolveRequestIdForProcurement(procurementId, requestId);
  const workflowProgress = Math.max(progress, PROCUREMENT_PROGRESS[status] ?? progress);

  if (!isFirebaseConfigured) {
    const procurements = getLocalItem<ProcurementRecord[]>("procurements", []).map((entry) => entry.id === procurementId ? { ...entry, status, progress: workflowProgress, updatedAt: dates.timestamp, updatedAtHijriShamsi: dates.shamsi, updatedAtHijriQamari: dates.qamari } : entry);
    setLocalItem("procurements", procurements);
    await updateRequestStage(stageRequestId, status, workflowProgress, stage, user, comment);
    return;
  }

  const procRef = doc(db, PROCUREMENTS_COL, procurementId);
  await updateDoc(procRef, {
    status,
    progress: workflowProgress,
    updatedAt: dates.timestamp,
    updatedAtHijriShamsi: dates.shamsi,
    updatedAtHijriQamari: dates.qamari,
  });
  await updateRequestStage(stageRequestId, status, workflowProgress, stage, user, comment);
  await logAuditEvent(user.uid, user.name, 'procurement_updated' as any, { procurementId, status, progress: workflowProgress });
};

export const addVendorOffer = async (offerData: Partial<VendorOffer>, user: { uid: string, name: string }) => {
  const dates = getCurrentHijriDates();

  try {
    const normalizedItems = (offerData.items || []).map((item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return {
        item_id: item.itemId || "",
        item_name: item.itemName || "",
        specifications: (item as any).specifications || "",
        quantity,
        unit: item.unit || "",
        unit_price: unitPrice,
        total_price: quantity * unitPrice,
      };
    });
    const totalPrice = normalizedItems.reduce((sum, item) => sum + item.total_price, 0);
    const apiPayload = {
      vendor_name: offerData.vendorName || "",
      vendor_phone: offerData.vendorPhone || "",
      vendor_address: offerData.vendorAddress || "",
      total_price: totalPrice,
      currency: "AFN",
      details: {
        items: normalizedItems,
        delivery_time: offerData.deliveryTime || "",
        warranty_or_notes: offerData.warrantyOrNotes || "",
      }
    };
    const response = await apiClient.post(`/procurement/${offerData.procurementId}/vendor-offers`, apiPayload);
    return response.id?.toString() || "";
  } catch (apiError) {
    console.warn("Backend addVendorOffer failed; falling back to Firebase/Local");
    if (!isFirebaseConfigured) {
      const totalOfferPrice = (offerData.items || []).reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
      const newOffer: VendorOffer = {
        id: makeLocalId("offer"),
        requestId: offerData.requestId!,
        procurementId: offerData.procurementId!,
        vendorName: offerData.vendorName || "",
        vendorPhone: offerData.vendorPhone || "",
        vendorAddress: offerData.vendorAddress || "",
        items: (offerData.items || []).map(item => ({ ...item, totalPrice: (item.quantity || 0) * (item.unitPrice || 0) })) as any,
        totalOfferPrice,
        deliveryTime: offerData.deliveryTime || "",
        warrantyOrNotes: offerData.warrantyOrNotes || "",
        offerDate: dates.timestamp,
        offerDateHijriShamsi: dates.shamsi,
        offerDateHijriQamari: dates.qamari,
        createdBy: user.uid,
        createdAt: dates.timestamp,
        updatedAt: dates.timestamp,
      };
      setLocalItem("vendor_offers", [newOffer, ...getLocalItem<VendorOffer[]>("vendor_offers", [])]);
      return newOffer.id;
    }

    const offerRef = doc(collection(db, OFFERS_COL));
    const totalOfferPrice = (offerData.items || []).reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const newOffer: VendorOffer = {
      id: offerRef.id,
      requestId: offerData.requestId!,
      procurementId: offerData.procurementId!,
      vendorName: offerData.vendorName || "",
      vendorPhone: offerData.vendorPhone || "",
      vendorAddress: offerData.vendorAddress || "",
      items: (offerData.items || []).map(item => ({ ...item, totalPrice: (item.quantity || 0) * (item.unitPrice || 0) })) as any,
      totalOfferPrice,
      deliveryTime: offerData.deliveryTime || "",
      warrantyOrNotes: offerData.warrantyOrNotes || "",
      offerDate: dates.timestamp,
      offerDateHijriShamsi: dates.shamsi,
      offerDateHijriQamari: dates.qamari,
      createdBy: user.uid,
      createdAt: dates.timestamp,
      updatedAt: dates.timestamp,
    };
    await setDoc(offerRef, newOffer);
    await updateDoc(doc(db, PROCUREMENTS_COL, newOffer.procurementId), { status: 'OffersReceived', updatedAt: dates.timestamp });
    await logAuditEvent(user.uid, user.name, 'vendor_offer_added' as any, { procurementId: newOffer.procurementId, vendorName: newOffer.vendorName });
    return offerRef.id;
  }
};

export const getVendorOffers = async (procurementId: string, lookupByRequest: boolean = false) => {
  try {
    const apiProc = await apiClient.get(lookupByRequest ? `/procurement/by-request/${procurementId}` : `/procurement/${procurementId}`);
    if (apiProc && apiProc.offers) {
      return apiProc.offers.map(mapOfferFromApi);
    }
  } catch (apiError) {
    console.warn("Backend getVendorOffers failed; falling back to Firebase/Local");
    if (!isFirebaseConfigured) {
      return getLocalItem<VendorOffer[]>("vendor_offers", [])
        .filter((entry) => lookupByRequest ? entry.requestId === procurementId : entry.procurementId === procurementId);
    }
    const q = query(collection(db, OFFERS_COL), where(lookupByRequest ? "requestId" : "procurementId", "==", procurementId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as VendorOffer);
  }
};

export const saveWinnerSelection = async (
  requestId: string,
  procurementId: string,
  winner: { vendorId: string, vendorName: string, totalPrice: number },
  reason: string,
  user: { uid: string, name: string, role: string }
) => {
  const dates = getCurrentHijriDates();

  try {
    await apiClient.put(`/procurement/${procurementId}/select-winner/${winner.vendorId || 1}`, { selection_reason: reason });
  } catch (apiError: any) {
    if (isBlockingApiError(apiError)) {
      throw new Error(parseApiErrorMessage(apiError) || apiError.message);
    }
    console.warn("Backend saveWinnerSelection failed; falling back to Firebase/Local");
  }

  if (!isFirebaseConfigured) {
    const comparison: ComparisonRecord = { id: procurementId, requestId, procurementId, winnerVendorId: winner.vendorId, winnerVendorName: winner.vendorName, winnerTotalPrice: winner.totalPrice, selectionReason: reason, createdBy: user.uid, createdAt: dates.timestamp, createdAtHijriShamsi: dates.shamsi, createdAtHijriQamari: dates.qamari };
    setLocalItem("comparison_records", [
      comparison,
      ...getLocalItem<ComparisonRecord[]>("comparison_records", []).filter((entry) => entry.id !== procurementId && entry.requestId !== requestId)
    ]);
    await updateProcurementStatus(procurementId, "WinnerSelected", 40, user, "مقایسوي فورم او ګټونکی", `ګټونکی: ${winner.vendorName}`);
    return;
  }

  const compRef = doc(db, COMPARISON_COL, procurementId);
  const comparison: ComparisonRecord = {
    id: procurementId,
    requestId,
    procurementId,
    winnerVendorId: winner.vendorId,
    winnerVendorName: winner.vendorName,
    winnerTotalPrice: winner.totalPrice,
    selectionReason: reason,
    createdBy: user.uid,
    createdAt: dates.timestamp,
    createdAtHijriShamsi: dates.shamsi,
    createdAtHijriQamari: dates.qamari,
  };
  await setDoc(compRef, comparison);
  await updateProcurementStatus(procurementId, 'WinnerSelected', 45, user, 'تدارکات: ګټونکی وټاکل شو / تدارکات: برنده انتخاب شد', `ګټونکی: ${winner.vendorName} - علت: ${reason}`);
  await logAuditEvent(user.uid, user.name, 'winner_selected' as any, { procurementId, winnerVendorName: winner.vendorName });
};

export const createPurchaseOrder = async (
  procurementId: string,
  vendor: { id: string, name: string, total: number },
  user: { uid: string, name: string, role: string },
  requestId: string = procurementId
) => {
  const dates = getCurrentHijriDates();

  try {
    await apiClient.post(`/procurement/${procurementId}/purchase-order`, {
      vendor_id: vendor.id ? parseInt(vendor.id) || 1 : 1,
      total_amount: vendor.total
    });
  } catch (apiError: any) {
    if (isBlockingApiError(apiError)) {
      throw new Error(parseApiErrorMessage(apiError) || apiError.message);
    }
    console.warn("Backend createPurchaseOrder failed; falling back to Firebase/Local");
  }

  if (!isFirebaseConfigured) {
    const poData: PurchaseOrderRecord = { id: procurementId, requestId, procurementId, vendorId: vendor.id, vendorName: vendor.name, totalPrice: vendor.total, status: "Submitted", createdBy: user.uid, createdByName: user.name, createdAt: dates.timestamp, createdAtHijriShamsi: dates.shamsi };
    setLocalItem("purchase_orders", [poData, ...getLocalItem<PurchaseOrderRecord[]>("purchase_orders", []).filter((entry) => entry.id !== procurementId)]);
    const procurements = getLocalItem<ProcurementRecord[]>("procurements", []).map((entry) => entry.id === procurementId ? { ...entry, purchaseOrderId: procurementId } : entry);
    setLocalItem("procurements", procurements);
    await updateProcurementStatus(procurementId, "PurchaseOrderCreated", 50, user, "آمر خریداري جوړ شو");
    return;
  }

  const poRef = doc(db, PO_COL, procurementId);
  const poData: PurchaseOrderRecord = {
    id: procurementId,
    requestId,
    procurementId,
    vendorId: vendor.id,
    vendorName: vendor.name,
    totalPrice: vendor.total,
    status: 'Submitted',
    createdBy: user.uid,
    createdByName: user.name,
    createdAt: dates.timestamp,
    createdAtHijriShamsi: dates.shamsi,
  };
  await setDoc(poRef, poData);
  await updateDoc(doc(db, PROCUREMENTS_COL, procurementId), { purchaseOrderId: procurementId });
  await updateProcurementStatus(procurementId, 'PurchaseOrderCreated', 50, user, 'تدارکات: آمر خریداري جوړ شو / تدارکات: آمر خریداری ایجاد شد');
  await logAuditEvent(user.uid, user.name, 'purchase_order_created' as any, { procurementId });
};

export const createReceiptReport = async (
  procurementId: string,
  vendorName: string,
  items: any[],
  user: { uid: string, name: string, role: string },
  requestId: string = procurementId
) => {
  const dates = getCurrentHijriDates();

  if (!isFirebaseConfigured) {
    const rrData: ReceiptReportRecord = { id: procurementId, requestId, procurementId, purchaseOrderId: procurementId, vendorName, receivedItems: items, status: "Submitted", receivedBy: user.uid, receivedByName: user.name, createdAt: dates.timestamp, createdAtHijriShamsi: dates.shamsi };
    setLocalItem("receipt_reports", [rrData, ...getLocalItem<ReceiptReportRecord[]>("receipt_reports", []).filter((entry) => entry.id !== procurementId)]);
    await updateProcurementStatus(procurementId, "ReceiptReportCreated", 60, user, "راپور رسید جوړ شو");
    return;
  }

  const rrRef = doc(db, RR_COL, procurementId);
  const rrData: ReceiptReportRecord = {
    id: procurementId,
    requestId,
    procurementId,
    purchaseOrderId: procurementId,
    vendorName,
    receivedItems: items,
    status: 'Submitted',
    receivedBy: user.uid,
    receivedByName: user.name,
    createdAt: dates.timestamp,
    createdAtHijriShamsi: dates.shamsi,
  };
  await setDoc(rrRef, rrData);
  await updateDoc(doc(db, PROCUREMENTS_COL, procurementId), { receiptReportId: procurementId });
  await updateProcurementStatus(procurementId, 'ReceiptReportCreated', 60, user, 'تدارکات: راپور رسید جوړ شو / تدارکات: راپور رسید ایجاد شد');
  await logAuditEvent(user.uid, user.name, 'receipt_report_created' as any, { procurementId });
};

export const getComparison = async (procurementId: string) => {
  try {
    const apiProc = await apiClient.get(`/procurement/${procurementId}`);
    const winner = Array.isArray(apiProc?.offers)
      ? apiProc.offers.find((offer: any) => Boolean(offer.is_winner))
      : null;
    if (winner) {
      return {
        id: procurementId,
        requestId: apiProc.request_id?.toString() || "",
        procurementId,
        winnerVendorId: winner.id?.toString() || "",
        winnerVendorName: winner.vendor_name || "",
        winnerTotalPrice: Number(winner.total_price) || 0,
        selectionReason: "Automatic lowest offer",
        createdBy: "",
        createdAt: winner.updated_at ? new Date(winner.updated_at).getTime() : Date.now(),
        createdAtHijriShamsi: "",
        createdAtHijriQamari: "",
      } as ComparisonRecord;
    }
    return null;
  } catch (apiError) {
    console.warn("Backend comparison load failed; falling back to Firebase/Local");
  }

  if (!isFirebaseConfigured) {
    return getLocalItem<ComparisonRecord[]>("comparison_records", [])
      .find((entry) => entry.id === procurementId || entry.procurementId === procurementId || entry.requestId === procurementId) || null;
  }
  const snap = await getDoc(doc(db, COMPARISON_COL, procurementId));
  if (snap.exists()) return snap.data() as ComparisonRecord;
  const q = query(collection(db, COMPARISON_COL), where("requestId", "==", procurementId));
  const byRequest = await getDocs(q);
  return byRequest.docs[0]?.data() as ComparisonRecord || null;
};
