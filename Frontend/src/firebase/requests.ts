import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  orderBy
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { getDemoRequests, saveDemoRequests, getDemoPipeline, saveDemoPipeline, getDemoLevelHistory, setLocalItem, getLocalItem, makeLocalId } from "./localStore";
import { getCurrentHijriDates } from "../utils/dateUtils";
import { logAuditEvent } from "./audit";
import { ROLES } from "../constants/roles";
import { getItemById, getItems } from "./inventory";
import { apiClient } from "../api/apiClient";

const ENABLE_LOCAL_REQUEST_FALLBACK = import.meta.env.VITE_ENABLE_LOCAL_REQUEST_FALLBACK === "true";

// Normalize legacy/variant status strings to canonical camelCase values
const normalizeStatus = (raw: string): string => {
  const map: Record<string, string> = {
    PENDING: "Submitted", submitted: "Submitted", SUBMITTED: "Submitted",
    CONFIRMED: "ConfirmedByRequestConfirmer",
    REJECTED: "RejectedByRequestConfirmer",
    SENT_TO_PROCUREMENT: "ProcurementPending",
    READY_FOR_DELIVERY: "ReceivedToInventory",
    DELIVERED: "Delivered", COMPLETED: "Completed",
    "Request Confirmer": "Submitted",
    "request_confirmer": "Submitted",
    pendingReview: "PendingReview",
    pending_review: "PendingReview",
    PENDING_REVIEW: "PendingReview",
    reviewReturned: "ReviewReturned",
    review_returned: "ReviewReturned",
    REVIEW_RETURNED: "ReviewReturned",
  };
  return map[raw] ?? raw;
};

// Infer assignedRole from status when column is missing
const normalizeAssignedRole = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const value = String(raw).trim();
  const normalized: Record<string, string> = {
    REQUEST_CONFIRMER: "REQUEST_CONFIRMER",
    "Request Confirmer": "REQUEST_CONFIRMER",
    request_confirmer: "REQUEST_CONFIRMER",
    REQUESTER: "REQUESTER",
    Requester: "REQUESTER",
    requester: "REQUESTER",
    SUPER_ADMIN: "SUPER_ADMIN",
    "Super Admin": "SUPER_ADMIN",
    ADMIN: "ADMIN",
    Admin: "ADMIN",
    PROCUREMENT_DIRECTOR: "PROCUREMENT_DIRECTOR",
    "Procurement Director": "PROCUREMENT_DIRECTOR",
    WAREHOUSE_DIRECTOR: "WAREHOUSE_DIRECTOR",
    "Warehouse Director": "WAREHOUSE_DIRECTOR",
    NONE: "NONE",
    none: "NONE",
  };
  return normalized[value] ?? value;
};

const inferAssignedRole = (status: string, assignedRoleCol: string | null): string => {
  if (assignedRoleCol && assignedRoleCol !== '') return normalizeAssignedRole(assignedRoleCol);
  const roleMap: Record<string, string> = {
    Draft: "REQUESTER",
    PendingReview: "REQUEST_CONFIRMER",
    ReviewReturned: "REQUESTER",
    Submitted: "REQUEST_CONFIRMER",
    ConfirmedByRequestConfirmer: "SUPER_ADMIN",
    RejectedByRequestConfirmer: "REQUESTER",
    ApprovedBySuperAdmin: "ADMIN",
    RejectedBySuperAdmin: "REQUESTER",
    ReturnedToSuperAdmin: "SUPER_ADMIN",
    RejectedByAdmin: "REQUESTER",
    FS5Required: "REQUESTER",
    StockAvailable: "WAREHOUSE_DIRECTOR",
    StockNotAvailable: "PROCUREMENT_DIRECTOR",
    ProcurementPending: "PROCUREMENT_DIRECTOR",
    TenderCreated: "PROCUREMENT_DIRECTOR",
    OffersReceived: "PROCUREMENT_DIRECTOR",
    ComparisonCreated: "PROCUREMENT_DIRECTOR",
    WinnerSelected: "PROCUREMENT_DIRECTOR",
    PurchaseOrderCreated: "WAREHOUSE_DIRECTOR",
    ReceiptReportCreated: "WAREHOUSE_DIRECTOR",
    ReceivedToInventory: "WAREHOUSE_DIRECTOR",
    DeliveryFormsRequested: "REQUESTER",
    DeliveryReviewReturned: "REQUESTER",
    DeliveryFormsSubmitted: "REQUEST_CONFIRMER",
    DeliveryConfirmedByRequestConfirmer: "SUPER_ADMIN",
    DeliveryRejectedByRequestConfirmer: "REQUESTER",
    DeliveryReturnedToConfirmer: "REQUEST_CONFIRMER",
    DeliveryApprovedBySuperAdmin: "ADMIN",
    DeliveryRejectedBySuperAdmin: "REQUESTER",
    DeliveryReturnedToSuperAdmin: "SUPER_ADMIN",
    DeliveryRejectedByAdmin: "REQUESTER",
    DeliveryReferredToWarehouse: "WAREHOUSE_DIRECTOR",
    FS5Created: "WAREHOUSE_DIRECTOR",
    Delivered: "NONE",
    Completed: "NONE",
  };
  return roleMap[status] ?? "REQUEST_CONFIRMER";
};

const mapRequestFromApi = (apiReq: any): InventoryRequest => {
  const rawStatus  = apiReq.status || "Submitted";
  const status     = normalizeStatus(rawStatus);
  const assignedRole = inferAssignedRole(status, apiReq.assigned_role ?? null);
  const currentStage = apiReq.current_stage ? normalizeAssignedRole(apiReq.current_stage) || apiReq.current_stage : assignedRole;

  return {
    id: apiReq.id ? apiReq.id.toString() : "",
    requesterId: apiReq.requester_id?.toString() || "",
    personId: apiReq.person_id?.toString() || "",
    requesterName: apiReq.requester_name || "",
    faculty: apiReq.faculty_name || "",
    faculty_id: apiReq.faculty_id ? Number(apiReq.faculty_id) : undefined,
    departmentOrPerson: apiReq.department_name || apiReq.person_name || "",
    reason: apiReq.notes || "",
    items: (apiReq.items || []).map((i: any) => ({
      itemId: i.item_id?.toString() || "",
      name: i.item_name || i.item_code || "",
      unit: i.unit_name || "",
      quantity: Number(i.quantity) || 0,
      specifications: i.specifications || "",
      unitPrice: Number(i.unit_price) || 0,
      totalPrice: Number(i.total_price) || 0,
    })),
    status,
    progress: Number(apiReq.progress_percent) || 0,
    currentStage,
    assignedRole,
    originalRequestLevel: apiReq.request_level || "عادي",
    currentRequestLevel: apiReq.request_level || "عادي",
    createdAt: apiReq.created_at ? new Date(apiReq.created_at).getTime() : Date.now(),
    createdAtHijriShamsi: "",
    createdAtHijriQamari: "",
    updatedAt: apiReq.updated_at ? new Date(apiReq.updated_at).getTime() : Date.now(),
    updatedAtHijriShamsi: "",
    updatedAtHijriQamari: "",
    formInstances: {
      proposalId: apiReq.form_instances?.proposalId?.toString(),
      si9Id: apiReq.form_instances?.si9Id?.toString(),
      fs5Id: apiReq.form_instances?.fs5Id?.toString(),
      tenderId: apiReq.form_instances?.tenderId?.toString(),
      comparisonId: apiReq.form_instances?.comparisonId?.toString(),
      purchaseOrderId: apiReq.form_instances?.purchaseOrderId?.toString(),
      receiptReportId: apiReq.form_instances?.receiptReportId?.toString(),
    },
    rejectionComment: "",
  };
};

// --- Types ---

export interface PipelineRecord {
  id?: string;
  requestId: string;
  stage: string;
  status: string;
  progress: number;
  actionBy: string;
  actionByName: string;
  actionByRole: string;
  comment: string;
  createdAt: number;
  createdAtHijriShamsi: string;
  createdAtHijriQamari: string;
}

export interface RequestLevelRecord {
  id?: string;
  requestId: string;
  oldLevel: string;
  newLevel: string;
  changedBy: string;
  changedByName: string;
  changedByRole: string;
  comment: string;
  changedAt: number;
  changedAtHijriShamsi: string;
  changedAtHijriQamari: string;
}

export interface RequestItem {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  specifications?: string;
  unitPrice?: number;
  totalPrice?: number;
}

export interface InventoryRequest {
  id: string;
  requesterId: string;
  personId?: string;
  requesterName: string;
  faculty: string;
  faculty_id?: number;
  departmentOrPerson: string;
  reason: string;
  items: RequestItem[];
  status: string;
  progress: number;
  currentStage: string;
  assignedRole?: string;
  originalRequestLevel: string;
  currentRequestLevel: string;
  createdAt: number;
  createdAtHijriShamsi: string;
  createdAtHijriQamari: string;
  updatedAt: number;
  updatedAtHijriShamsi: string;
  updatedAtHijriQamari: string;
  formInstances: {
    proposalId?: string;
    si9Id?: string;
    fs5Id?: string;
    tenderId?: string;
    comparisonId?: string;
    purchaseOrderId?: string;
    receiptReportId?: string;
  };
  rejectionComment?: string;
}

export interface OfficialFormInstance {
  id: string;
  requestId: string;
  formType: 'Proposal' | 'Tender' | 'Comparison' | 'PurchaseOrder' | 'ReceiptReport' | 'SI-9' | 'FS-5';
  formData: any;
  createdAt: number;
  updatedAt: number;
}

const REQUESTS_COL = "requests";
const FORMS_COL = "official_form_instances";
const PIPELINE_COL = "request_pipeline";
const LEVEL_HISTORY_COL = "request_level_history";

// --- Service Functions ---

// Build a localStorage request object with correct workflow fields
const buildLocalRequest = (
  requestId: string,
  requestData: Partial<InventoryRequest>,
  userId: string,
  userName: string,
  dates: { timestamp: number; shamsi: string; qamari: string }
): InventoryRequest => ({
  id: requestId,
  requesterId: userId,
  requesterName: userName,
  faculty: requestData.faculty || "",
  faculty_id: requestData.faculty_id ? Number(requestData.faculty_id) : undefined,
  departmentOrPerson: requestData.departmentOrPerson || "",
  reason: requestData.reason || "",
  items: requestData.items || [],
  status: "PendingReview",
  progress: 0,
  currentStage: "REQUEST_CONFIRMER",
  assignedRole: "REQUEST_CONFIRMER",
  originalRequestLevel: requestData.originalRequestLevel || "عادي",
  currentRequestLevel: requestData.originalRequestLevel || "عادي",
  createdAt: dates.timestamp,
  createdAtHijriShamsi: dates.shamsi,
  createdAtHijriQamari: dates.qamari,
  updatedAt: dates.timestamp,
  updatedAtHijriShamsi: dates.shamsi,
  updatedAtHijriQamari: dates.qamari,
  formInstances: {},
});

export const createRequest = async (requestData: Partial<InventoryRequest>, userId: string, userName: string) => {
  const dates = getCurrentHijriDates();

  try {
    const apiPayload = {
      requester_id: Number(userId) || null,
      notes: requestData.reason || "",
      request_level: requestData.originalRequestLevel || "عادي",
      faculty_name: requestData.faculty || "",
      department_name: requestData.departmentOrPerson || "",
      requester_name: userName,
      faculty_id: (requestData as any).faculty_id || null,
      department_id: (requestData as any).department_id || null,
      person_id: (requestData as any).person_id || null,
      items: (requestData.items || []).map(i => ({
        item_id: i.itemId ? parseInt(i.itemId, 10) || null : null,
        checklist_id: i.itemId ? parseInt(i.itemId, 10) || null : null,
        item_name: i.name,
        quantity: i.quantity,
        unit_name: i.unit || "",
        specifications: i.specifications || "",
        unit_price: i.unitPrice || 0,
        total_price: i.totalPrice || 0,
      }))
    };
    const response = await apiClient.post('/requests', apiPayload);
    const newId = response.id?.toString() || response.data?.id?.toString() || "";
    if (!newId) throw new Error("No ID returned from backend");
    return newId;
  } catch (apiError: any) {
    // ── If the backend rejected due to daily limit, propagate immediately ───
    if (apiError?.message?.includes('HTTP 429')) {
      // Parse the JSON body from the error text
      try {
        const jsonStart = apiError.message.indexOf('{');
        if (jsonStart !== -1) {
          const parsed = JSON.parse(apiError.message.slice(jsonStart));
          const limitErr = new Error(parsed.message || apiError.message) as any;
          limitErr.limit_exceeded = true;
          limitErr.data = parsed.data;
          throw limitErr;
        }
      } catch (parseErr: any) {
        if (parseErr.limit_exceeded) throw parseErr;
      }
      const limitErr = new Error(apiError.message) as any;
      limitErr.limit_exceeded = true;
      throw limitErr;
    }
    if (!ENABLE_LOCAL_REQUEST_FALLBACK) {
      console.warn("Backend createRequest failed; local request fallback is disabled for shared LAN mode.");
      throw apiError;
    }
    console.warn("Backend createRequest failed; falling back to Firebase/Local");
    if (!isFirebaseConfigured) {
      const requestId = makeLocalId("request");
      const newRequest = buildLocalRequest(requestId, requestData, userId, userName, dates);
      saveDemoRequests([newRequest, ...getDemoRequests()]);
      saveDemoPipeline([
        {
          id: makeLocalId("pipe"),
          requestId,
          stage: "REQUEST_CONFIRMER",
          status: "PendingReview",
          progress: 0,
          actionBy: userId,
          actionByName: userName,
          actionByRole: "REQUESTER",
          comment: "",
          createdAt: dates.timestamp,
          createdAtHijriShamsi: dates.shamsi,
          createdAtHijriQamari: dates.qamari,
        },
        ...getDemoPipeline(),
      ]);
      return requestId;
    }
  }

  const reqRef = doc(collection(db, REQUESTS_COL));
  
  const newRequest: InventoryRequest = {
    id: reqRef.id,
    requesterId: userId,
    requesterName: userName,
    faculty: requestData.faculty || "",
    faculty_id: requestData.faculty_id ? Number(requestData.faculty_id) : undefined,
    departmentOrPerson: requestData.departmentOrPerson || "",
    reason: requestData.reason || "",
    items: requestData.items || [],
    status: 'PendingReview',
    progress: 0,
    currentStage: 'REQUEST_CONFIRMER',
    assignedRole: 'REQUEST_CONFIRMER',
    originalRequestLevel: requestData.originalRequestLevel || "عادي",
    currentRequestLevel: requestData.originalRequestLevel || "عادي",
    createdAt: dates.timestamp,
    createdAtHijriShamsi: dates.shamsi,
    createdAtHijriQamari: dates.qamari,
    updatedAt: dates.timestamp,
    updatedAtHijriShamsi: dates.shamsi,
    updatedAtHijriQamari: dates.qamari,
    formInstances: {},
  };

  await setDoc(reqRef, newRequest);
  await logAuditEvent(userId, userName, 'request_created' as any, { requestId: reqRef.id });
  return reqRef.id;
};

export const addPipelineRecord = async (requestId: string, data: Partial<PipelineRecord>) => {
  const dates = getCurrentHijriDates();

  if (!isFirebaseConfigured) {
    saveDemoPipeline([
      {
        id: makeLocalId("pipe"),
        requestId,
        stage: data.stage || "",
        status: data.status || "",
        progress: data.progress || 0,
        actionBy: data.actionBy || "demo-super-admin",
        actionByName: data.actionByName || "Super Admin",
        actionByRole: data.actionByRole || "Super Admin",
        comment: data.comment || "",
        createdAt: dates.timestamp,
        createdAtHijriShamsi: dates.shamsi,
        createdAtHijriQamari: dates.qamari,
      },
      ...getDemoPipeline(),
    ]);
    return;
  }

  const ref = collection(db, PIPELINE_COL);
  await addDoc(ref, {
    ...data,
    requestId,
    createdAt: dates.timestamp,
    createdAtHijriShamsi: dates.shamsi,
    createdAtHijriQamari: dates.qamari,
  });
};

export const updateRequestStage = async (
  requestId: string, 
  status: string, 
  progress: number, 
  stage: string, 
  user: { uid: string, name: string, role: string },
  comment: string = ""
) => {
  const dates = getCurrentHijriDates();

  try {
    await apiClient.put(`/requests/${requestId}/status`, {
      status,
      progress,
      stage_label: stage,
      action_by: user.uid,
      action_by_name: user.name,
      action_by_role: user.role,
      comment,
    });
    if (!ENABLE_LOCAL_REQUEST_FALLBACK || !isFirebaseConfigured) return;
  } catch (apiError) {
    if (!ENABLE_LOCAL_REQUEST_FALLBACK) {
      console.warn("Backend updateRequestStage failed; local request fallback is disabled for shared LAN mode.");
      throw apiError;
    }
    console.warn("Backend updateRequestStage failed; falling back to Firebase/Local");
  }

  const nextAssignedRole = inferAssignedRole(status, null);

  if (!isFirebaseConfigured) {
    const isRejected = status.includes('Rejected');
    const isReturn = ['ReviewReturned','ReturnedToConfirmer','ReturnedToSuperAdmin',
      'DeliveryReviewReturned','DeliveryReturnedToConfirmer'].includes(status);
    const currentRequest = getDemoRequests().find(r => r.id === requestId);
    const currentProgress = currentRequest?.progress ?? 0;
    const safeProgress = isRejected ? 0 : (isReturn ? currentProgress : Math.max(progress, currentProgress));

    const updatedRequests = getDemoRequests().map((request) =>
      request.id === requestId
        ? {
            ...request,
            status,
            progress: safeProgress,
            currentStage: stage,
            assignedRole: nextAssignedRole,
            rejectionComment: status.includes("Rejected") ? comment : "",
            updatedAt: dates.timestamp,
            updatedAtHijriShamsi: dates.shamsi,
            updatedAtHijriQamari: dates.qamari,
          }
        : request
    );
    saveDemoRequests(updatedRequests);
    await addPipelineRecord(requestId, {
      stage,
      status,
      progress: safeProgress,
      actionBy: user.uid,
      actionByName: user.name,
      actionByRole: user.role,
      comment,
    });
    return;
  }

  const reqRef = doc(db, REQUESTS_COL, requestId);
  
  await updateDoc(reqRef, {
    status,
    progress,
    currentStage: stage,
    assignedRole: nextAssignedRole,
    rejectionComment: status.includes('Rejected') ? comment : "",
    updatedAt: dates.timestamp,
    updatedAtHijriShamsi: dates.shamsi,
    updatedAtHijriQamari: dates.qamari,
  });

  await addPipelineRecord(requestId, {
    stage,
    status,
    progress,
    actionBy: user.uid,
    actionByName: user.name,
    actionByRole: user.role,
    comment
  });

  await logAuditEvent(user.uid, user.name, 'request_stage_changed' as any, { requestId, status, stage });
};

export const changeRequestLevel = async (
  requestId: string, 
  newLevel: string, 
  oldLevel: string, 
  user: { uid: string, name: string, role: string },
  comment: string = ""
) => {
  const dates = getCurrentHijriDates();

  try {
    await apiClient.put(`/requests/${requestId}/level`, { new_level: newLevel, reason: comment });
    if (!ENABLE_LOCAL_REQUEST_FALLBACK || !isFirebaseConfigured) return;
  } catch (apiError) {
    if (!ENABLE_LOCAL_REQUEST_FALLBACK) {
      console.warn("Backend changeRequestLevel failed; local request fallback is disabled for shared LAN mode.");
      throw apiError;
    }
    console.warn("Backend changeRequestLevel failed; falling back to Firebase/Local");
  }

  if (!isFirebaseConfigured) {
    const requests = getDemoRequests().map((request) =>
      request.id === requestId
        ? {
            ...request,
            currentRequestLevel: newLevel,
            updatedAt: dates.timestamp,
            updatedAtHijriShamsi: dates.shamsi,
            updatedAtHijriQamari: dates.qamari,
          }
        : request
    );
    saveDemoRequests(requests);
    const history = getDemoLevelHistory();
    setLocalItem("request_level_history", [
      {
        id: makeLocalId("level"),
        requestId,
        oldLevel,
        newLevel,
        changedBy: user.uid,
        changedByName: user.name,
        changedByRole: user.role,
        comment,
        changedAt: dates.timestamp,
        changedAtHijriShamsi: dates.shamsi,
        changedAtHijriQamari: dates.qamari,
      },
      ...history,
    ]);
    return;
  }

  const reqRef = doc(db, REQUESTS_COL, requestId);
  
  await updateDoc(reqRef, {
    currentRequestLevel: newLevel,
    updatedAt: dates.timestamp,
    updatedAtHijriShamsi: dates.shamsi,
    updatedAtHijriQamari: dates.qamari,
  });

  await addDoc(collection(db, LEVEL_HISTORY_COL), {
    requestId,
    oldLevel,
    newLevel,
    changedBy: user.uid,
    changedByName: user.name,
    changedByRole: user.role,
    comment,
    changedAt: dates.timestamp,
    changedAtHijriShamsi: dates.shamsi,
    changedAtHijriQamari: dates.qamari,
  });

  await logAuditEvent(user.uid, user.name, 'request_level_changed' as any, { requestId, oldLevel, newLevel });
};

export const checkStockAvailability = async (items: RequestItem[]) => {
  // Pre-load all inventory items once for name-based fallback matching
  let allInvItems: Awaited<ReturnType<typeof getItems>> = [];
  try { allInvItems = await getItems(); } catch { /* ignore */ }

  const results = [];
  for (const item of items) {
    // 1. Try by itemId first
    let invItem = item.itemId ? await getItemById(item.itemId) : null;

    // 2. Fallback: match by name (trimmed, case-insensitive)
    if (!invItem && item.name?.trim()) {
      const needle = item.name.trim().toLowerCase();
      invItem = allInvItems.find(
        (inv: any) => (inv.name || "").trim().toLowerCase() === needle
      ) ?? null;
    }

    results.push({
      itemId: item.itemId,
      name: item.name,
      requested: item.quantity,
      available: invItem?.currentQuantity || 0,
      isAvailable: (invItem?.currentQuantity || 0) >= item.quantity,
      shortage: Math.max(0, item.quantity - (invItem?.currentQuantity || 0))
    });
  }
  return results;
};

// Normalize old localStorage requests that are missing assignedRole/currentStage
const normalizeLocalRequest = (r: InventoryRequest): InventoryRequest => {
  const status = normalizeStatus(r.status || "Submitted");
  const assignedRole = r.assignedRole && r.assignedRole !== ""
    ? normalizeAssignedRole(r.assignedRole)
    : inferAssignedRole(status, null);
  const currentStage = r.currentStage && r.currentStage !== "" && r.currentStage !== r.status
    ? normalizeAssignedRole(r.currentStage) || r.currentStage
    : assignedRole;
  return { ...r, status, assignedRole, currentStage };
};

const applyRequestFilters = (
  requests: InventoryRequest[],
  filters: {
    requesterId?: string;
    requesterName?: string;
    assignedRole?: string;
    faculty_id?: number;
  } = {}
): InventoryRequest[] => {
  let mapped = requests;
  if (filters.requesterName) {
    mapped = mapped.filter(r =>
      r.requesterName === filters.requesterName ||
      r.requesterId === filters.requesterId ||
      (r as any).createdBy === filters.requesterId
    );
  } else if (filters.requesterId) {
    mapped = mapped.filter(r =>
      r.requesterId === filters.requesterId ||
      (r as any).createdBy === filters.requesterId
    );
  }
  if (filters.assignedRole) {
    mapped = mapped.filter(r => {
      const requestRole = normalizeAssignedRole(r.assignedRole);
      const requestStage = normalizeAssignedRole(r.currentStage);
      return requestRole === filters.assignedRole ||
        requestStage === filters.assignedRole ||
        (filters.assignedRole === 'REQUEST_CONFIRMER' && ['Submitted', 'PendingReview', 'ReturnedToConfirmer'].includes(r.status));
    });
  }
  if (filters.faculty_id) {
    mapped = mapped.filter(r => r.faculty_id !== undefined && r.faculty_id !== null && String(r.faculty_id) === String(filters.faculty_id));
  }
  return mapped;
};

export const getRequests = async (filters: {
  requesterId?: string;
  requesterName?: string;
  assignedRole?: string;
  faculty_id?: number;
} = {}) => {
  try {
    const apiReqs = await apiClient.get('/requests');
    let mapped: InventoryRequest[] = (Array.isArray(apiReqs) ? apiReqs : []).map(mapRequestFromApi);
    if (ENABLE_LOCAL_REQUEST_FALLBACK) {

    // Merge local/Firebase data with backend — use the more advanced status
    const STATUS_ORDER: Record<string, number> = {
      'Submitted': 0, 'PendingReview': 5, 'ConfirmedByRequestConfirmer': 10,
      'ApprovedBySuperAdmin': 15, 'FS5Required': 18, 'StockAvailable': 20,
      'StockNotAvailable': 22, 'ProcurementPending': 25,
      'TenderCreated': 30, 'ComparisonCreated': 35, 'WinnerSelected': 40,
      'PurchaseOrderCreated': 45, 'ReceiptReportCreated': 50,
      'ReceivedToInventory': 55, 'FS5Created': 60, 'Delivered': 70, 'Completed': 80,
    };
    const moreAdvanced = (a: string, b: string) =>
      (STATUS_ORDER[a] || 0) >= (STATUS_ORDER[b] || 0) ? a : b;

    let localReqs: InventoryRequest[] = [];
    if (!isFirebaseConfigured) {
      localReqs = getDemoRequests().map(normalizeLocalRequest);
    } else {
      try {
        const q = query(collection(db, REQUESTS_COL));
        const snap = await getDocs(q);
        localReqs = snap.docs.map(d => normalizeLocalRequest({ id: d.id, ...d.data() } as InventoryRequest));
      } catch {}
    }

    const localMap = new Map(localReqs.map(r => [r.id, r]));
    mapped = mapped.map(r => {
      const local = localMap.get(r.id);
      if (local) {
        return {
          ...r,
          status: moreAdvanced(r.status, local.status),
          progress: Math.max(r.progress || 0, local.progress || 0),
          assignedRole: local.assignedRole || r.assignedRole,
        };
      }
      return r;
    });

    const backendIds = new Set(mapped.map(r => r.id));
    const localOnly = localReqs.filter(r => !backendIds.has(r.id));
    if (localOnly.length > 0) mapped = [...localOnly, ...mapped];
    }

    // Apply role-based filters
    if (filters.requesterName) {
      // Match by requester name (works in both demo and real mode)
      mapped = mapped.filter(r =>
        r.requesterName === filters.requesterName ||
        r.requesterId === filters.requesterId ||
        (r as any).createdBy === filters.requesterId
      );
    } else if (filters.requesterId) {
      mapped = mapped.filter(r =>
        r.requesterId === filters.requesterId ||
        (r as any).createdBy === filters.requesterId
      );
    }
    if (filters.assignedRole) {
      mapped = mapped.filter(r => {
        const requestRole = normalizeAssignedRole(r.assignedRole);
        const requestStage = normalizeAssignedRole(r.currentStage);
        return requestRole === filters.assignedRole ||
          requestStage === filters.assignedRole ||
          (filters.assignedRole === 'REQUEST_CONFIRMER' && ['Submitted', 'PendingReview', 'ReturnedToConfirmer'].includes(r.status));
      });
    }
    // Filter by faculty for REQUEST_CONFIRMER — confirmer sees only their faculty's requests
    if (filters.faculty_id) {
      mapped = mapped.filter(r => r.faculty_id !== undefined && r.faculty_id !== null && String(r.faculty_id) === String(filters.faculty_id));
    }
    return mapped;
  } catch (apiError) {
    if (!ENABLE_LOCAL_REQUEST_FALLBACK) {
      console.warn("Backend getRequests failed; local request fallback is disabled for shared LAN mode.");
      throw apiError;
    }
    console.warn("Backend getRequests failed; falling back to Firebase/Local");
    if (!isFirebaseConfigured) {
      let requests = getDemoRequests().map(normalizeLocalRequest);
      if (filters.requesterName) {
        requests = requests.filter(r =>
          r.requesterName === filters.requesterName ||
          r.requesterId === filters.requesterId ||
          (r as any).createdBy === filters.requesterId
        );
      } else if (filters.requesterId) {
        requests = requests.filter(r =>
          r.requesterId === filters.requesterId ||
          (r as any).createdBy === filters.requesterId
        );
      }
      if (filters.assignedRole) {
        requests = requests.filter(r => {
          const requestRole = normalizeAssignedRole(r.assignedRole);
          const requestStage = normalizeAssignedRole(r.currentStage);
          return requestRole === filters.assignedRole ||
            requestStage === filters.assignedRole ||
            (filters.assignedRole === 'REQUEST_CONFIRMER' && ['Submitted', 'PendingReview', 'ReturnedToConfirmer'].includes(r.status));
        });
      }
      if (filters.faculty_id) {
        requests = requests.filter(r => r.faculty_id !== undefined && r.faculty_id !== null && String(r.faculty_id) === String(filters.faculty_id));
      }
      return requests;
    }

    try {
      let q = query(collection(db, REQUESTS_COL));
      if (filters.requesterId) {
        q = query(q, where("requesterId", "==", filters.requesterId));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryRequest));
    } catch (error) {
      console.warn("Firebase getRequests failed; using demo requests:", error);
      let requests = getDemoRequests().map(normalizeLocalRequest);
      if (filters.requesterId) {
        requests = requests.filter(r => r.requesterId === filters.requesterId);
      }
      return requests;
    }
  }
};

export const getRequestById = async (id: string) => {
  try {
    const apiReq = await apiClient.get(`/requests/${id}`);
    if (apiReq) return mapRequestFromApi(apiReq);
  } catch (apiError) {
    if (!ENABLE_LOCAL_REQUEST_FALLBACK) {
      console.warn(`Backend getRequestById failed for ${id}; local request fallback is disabled for shared LAN mode.`);
      throw apiError;
    }
    console.warn(`Backend getRequestById failed for ${id}; falling back to Firebase/Local`);
    if (!isFirebaseConfigured) {
      const found = getDemoRequests().find((request) => request.id === id);
      return found ? normalizeLocalRequest(found) : null;
    }

    try {
      const snap = await getDoc(doc(db, REQUESTS_COL, id));
      if (snap.exists()) return { id: snap.id, ...snap.data() } as InventoryRequest;
      return null;
    } catch (error) {
      console.warn("Firebase getRequestById failed; using demo request:", error);
      return getDemoRequests().find((request) => request.id === id) || null;
    }
  }
};

export const getPipelineHistory = async (requestId: string): Promise<PipelineRecord[]> => {
  try {
    const data = await apiClient.get(`/requests/${requestId}/pipeline`);
    if (data && Array.isArray(data.pipeline) && data.pipeline.length > 0) {
      return data.pipeline.map((row: any): PipelineRecord => ({
        id: row.id?.toString(),
        requestId: requestId,
        stage: row.stage_label || row.status || "",
        status: row.status || "",
        progress: Number(row.progress) || 0,
        actionBy: row.action_by || "",
        actionByName: row.action_by_name || row.actor_name || "",
        actionByRole: row.action_by_role || "",
        comment: row.comment || "",
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        createdAtHijriShamsi: "",
        createdAtHijriQamari: "",
      }));
    }
  } catch (apiError) {
    console.warn("Backend getPipelineHistory failed; falling back to Firebase/Local");
  }

  if (!isFirebaseConfigured) {
    return getDemoPipeline().filter((record) => record.requestId === requestId).sort((a, b) => a.createdAt - b.createdAt);
  }

  try {
    const q = query(collection(db, PIPELINE_COL), where("requestId", "==", requestId), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as PipelineRecord);
  } catch (error) {
    console.warn("Firebase getPipelineHistory failed; using demo pipeline:", error);
    return getDemoPipeline().filter((record) => record.requestId === requestId).sort((a, b) => a.createdAt - b.createdAt);
  }
};

export const getLevelHistory = async (requestId: string) => {
  if (!isFirebaseConfigured) {
    return getDemoLevelHistory()
      .filter((record) => record.requestId === requestId)
      .sort((a, b) => a.changedAt - b.changedAt);
  }

  try {
    const q = query(collection(db, LEVEL_HISTORY_COL), where("requestId", "==", requestId), orderBy("changedAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as RequestLevelRecord);
  } catch (error) {
    console.warn("Firebase getLevelHistory failed:", error);
    return [];
  }
};

export const buildRequestsQuery = (role: string | undefined, userId: string | undefined) => {
  if (!role || !userId) return null;
  let q = query(collection(db, REQUESTS_COL));
  if (role === ROLES.REQUESTER) {
    q = query(q, where("requesterId", "==", userId));
  } else if (role === ROLES.REQUEST_CONFIRMER) {
    q = query(q, where("status", "in", ["Submitted", "ConfirmedByRequestConfirmer", "RejectedByRequestConfirmer", "ApprovedBySuperAdmin", "StockAvailable", "StockNotAvailable"]));
  } else if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN) {
    // See all
  } else {
    return null;
  }
  return q;
};

export const saveFormInstance = async (requestId: string, formType: OfficialFormInstance['formType'], formData: any, userId: string, userName: string) => {
  const dates = getCurrentHijriDates();

  try {
    const saved = await apiClient.post(`/requests/${requestId}/forms`, {
      form_type: formType,
      form_data: formData ?? {},
      created_by: userId,
      created_by_name: userName,
    });
    return saved.id?.toString() || "";
  } catch (apiError) {
    if (!ENABLE_LOCAL_REQUEST_FALLBACK) {
      console.warn("Backend form save failed; browser-only fallback is disabled in shared LAN mode.");
      throw apiError;
    }
    console.warn("Backend form save failed; falling back to Firebase/Local.");
  }

  if (!isFirebaseConfigured) {
    const formId = makeLocalId("form");
    const instance: OfficialFormInstance = {
      id: formId,
      requestId,
      formType,
      formData,
      createdAt: dates.timestamp,
      updatedAt: dates.timestamp,
    };
    const forms = getLocalItem<OfficialFormInstance[]>("official_form_instances", []);
    setLocalItem("official_form_instances", [instance, ...forms]);
    const requests = getDemoRequests().map((request) => {
      if (request.id !== requestId) return request;
      const formInstances = { ...request.formInstances };
      if (formType === "Proposal") formInstances.proposalId = formId;
      if (formType === "SI-9") formInstances.si9Id = formId;
      if (formType === "FS-5") formInstances.fs5Id = formId;
      return { ...request, formInstances, updatedAt: dates.timestamp, updatedAtHijriShamsi: dates.shamsi, updatedAtHijriQamari: dates.qamari };
    });
    saveDemoRequests(requests);
    return formId;
  }

  const formRef = doc(collection(db, FORMS_COL));
  const instance: OfficialFormInstance = {
    id: formRef.id,
    requestId,
    formType,
    formData,
    createdAt: dates.timestamp,
    updatedAt: dates.timestamp,
  };
  await setDoc(formRef, instance);
  const fieldName = formType === 'Proposal' ? 'formInstances.proposalId' : formType === 'SI-9' ? 'formInstances.si9Id' : formType === 'FS-5' ? 'formInstances.fs5Id' : null;
  if (fieldName) {
    await updateDoc(doc(db, REQUESTS_COL, requestId), { [fieldName]: formRef.id, updatedAt: dates.timestamp });
  }
  await logAuditEvent(userId, userName, (formType.toLowerCase().replace('-', '') + '_saved') as any, { requestId, formId: formRef.id });
  return formRef.id;
};

export const updateRequestItems = async (requestId: string, items: RequestItem[]): Promise<void> => {
  const payload = items.map(i => ({
    item_id: i.itemId || null,
    item_name: i.name,
    quantity: i.quantity,
    unit_name: i.unit || '',
    specifications: i.specifications || '',
    unit_price: i.unitPrice || 0,
    total_price: i.totalPrice || 0,
  }));
  try {
    const resp = await fetch(`/api/requests/${requestId}/items`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: payload }),
  });
  if (!resp.ok) throw new Error('د اجناسو سمول ناکام شول.');
  } catch (error) {
    if (!ENABLE_LOCAL_REQUEST_FALLBACK || isFirebaseConfigured) {
      throw error;
    }
    const all = getLocalItem<InventoryRequest[]>("requests", []);
    const idx = all.findIndex(r => r.id === requestId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], items, updatedAt: Date.now() };
      setLocalItem("requests", all);
    }
  }
};

export const getFormInstance = async (requestId: string, id: string) => {
  try {
    const form = await apiClient.get(`/requests/${requestId}/forms/${id}`);
    if (form) {
      return {
        id: form.id?.toString() || id,
        requestId: form.request_id?.toString() || requestId,
        formType: form.form_type,
        formData: form.form_data || {},
        createdAt: form.created_at ? new Date(form.created_at).getTime() : Date.now(),
        updatedAt: form.updated_at ? new Date(form.updated_at).getTime() : Date.now(),
      } as OfficialFormInstance;
    }
  } catch (apiError) {
    if (!ENABLE_LOCAL_REQUEST_FALLBACK) throw apiError;
    console.warn("Backend form load failed; falling back to Firebase/Local.");
  }

  if (!isFirebaseConfigured) {
    return getLocalItem<OfficialFormInstance[]>("official_form_instances", []).find((instance) => instance.id === id) || null;
  }
  const snap = await getDoc(doc(db, FORMS_COL, id));
  if (snap.exists()) return snap.data() as OfficialFormInstance;
  return null;
};
