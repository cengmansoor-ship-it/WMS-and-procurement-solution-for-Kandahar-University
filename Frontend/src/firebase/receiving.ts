import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  runTransaction
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { getLocalItem, setLocalItem, makeLocalId, addInAppNotification } from "./localStore";
import { getDemoRequests, saveDemoRequests } from "./localStore";
import { performStockTransaction } from "./inventory";
import { getCurrentHijriDates } from "../utils/dateUtils";
import { logAuditEvent } from "./audit";
import { updateRequestStage } from "./requests";
import { apiClient } from "../api/apiClient";

// --- Types ---

export interface FS5Document {
  id: string;
  requestId: string;
  procurementId?: string;
  receiptReportId?: string;
  fs5Number: string;
  status: 'Draft' | 'Submitted' | 'Delivered' | 'Cancelled';
  items: any[];
  receiverId: string;
  receiverName: string;
  facultyName: string;
  createdBy: string;
  createdAt: number;
  createdAtHijriShamsi: string;
}

export interface StockTransaction {
  id: string;
  itemId: string;
  itemName: string;
  type: 'IN' | 'OUT';
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  requestId?: string;
  fs5Id?: string;
}

const FS5_COL = "fs5_documents";
const TRANSACTIONS_COL = "stock_transactions";
const ITEMS_COL = "items";
const ASSIGNMENTS_COL = "item_assignments";
const DELIVERIES_COL = "deliveries";

/** Map frontend request items to backend delivery/receiving payload with name + checklist resolution. */
const mapItemsForApi = (items: any[], quantityKey: 'quantity' | 'quantity_received' = 'quantity') =>
  items.map((i: any) => {
    const parsedId = parseInt(i.itemId, 10);
    const base: any = {
      item_id: !isNaN(parsedId) ? parsedId : null,
      checklist_id: !isNaN(parsedId) ? parsedId : null,
      item_name: i.name || '',
      [quantityKey]: parseInt(i.quantity, 10) || 1,
      unit_id: 1,
    };
    return base;
  });

const parseApiErrorMessage = (error: any): string | null => {
  const raw = error?.message || '';
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) return null;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart));
    return parsed.message || null;
  } catch {
    return null;
  }
};

// --- Service Functions ---

export const createFS5 = async (requestId: string, items: any[], user: { uid: string, name: string, role: string }, receiver: any) => {
  const dates = getCurrentHijriDates();

  try {
    await apiClient.post(`/delivery/from-request/${requestId}`, { notes: "FS-5 Created" });
    // Stock is deducted only on final delivery (finalizeDelivery), not when FS-5 form is saved.
  } catch (apiError) {
    console.warn("Backend createFS5 (delivery) failed; falling back to Firebase/Local");
  }

  if (!isFirebaseConfigured) {
    const existing = getLocalItem<FS5Document | null>(`fs5_${requestId}`, null);
    if (existing?.status === "Delivered") throw new Error("دغه ف، س، ۵ مخکې تسلیم شوی دی.");
    const docData: FS5Document = {
      id: requestId,
      requestId,
      fs5Number: `FS5-${dates.shamsi}`,
      status: "Submitted",
      items,
      receiverId: receiver.id,
      receiverName: receiver.name,
      facultyName: receiver.faculty,
      createdBy: user.uid,
      createdAt: dates.timestamp,
      createdAtHijriShamsi: dates.shamsi,
    };
    setLocalItem(`fs5_${requestId}`, docData);
    setLocalItem("fs5_documents", [docData, ...getLocalItem<FS5Document[]>("fs5_documents", []).filter((item) => item.id !== requestId)]);
    await updateRequestStage(requestId, "FS5Created", 90, "ف، س، ۵ جوړ شو", user, "رسمي ف، س، ۵ فورم جوړ شو.");
    return docData;
  }

  const fs5Ref = doc(db, FS5_COL, requestId);
  const snap = await getDoc(fs5Ref);
  
  if (snap.exists() && snap.data().status === 'Delivered') {
    throw new Error("دغه FS-5 مخکې سپارل شوی دی.");
  }

  const docData: FS5Document = {
    id: requestId,
    requestId,
    fs5Number: `FS5-${Date.now()}`,
    status: 'Submitted',
    items,
    receiverId: receiver.id,
    receiverName: receiver.name,
    facultyName: receiver.faculty,
    createdBy: user.uid,
    createdAt: dates.timestamp,
    createdAtHijriShamsi: dates.shamsi,
  };

  await setDoc(fs5Ref, docData);
  
  // Update request status
  await updateRequestStage(requestId, 'FS5Created', 55, 'ف، س، ۵ جوړ شو / فورم FS-5 ایجاد شد', user);
  
  await logAuditEvent(user.uid, user.name, 'fs5_created' as any, { requestId });
  return docData;
};

/**
 * ATOMIC DELIVERY TRANSACTION
 * Deducts stock, creates transactions, creates assignments, and completes request.
 */
export const finalizeDelivery = async (
  requestId: string,
  user: { uid: string, name: string, role: string },
  opts: {
    items: Array<{ name: string; quantity: number; itemId?: string }>;
    requesterName?: string;
    receiverName?: string;
    receiverId?: string;
  }
) => {
  const dates = getCurrentHijriDates();
  const numericId = Number(requestId);

  const payload = {
    request_id: !isNaN(numericId) ? numericId : null,
    requester_name: opts.requesterName || opts.receiverName || '',
    receiver_name: opts.receiverName || opts.requesterName || '',
    receiver_person_id: opts.receiverId ? Number(opts.receiverId) || null : null,
    items: opts.items.map((i) => ({
      item_name: i.name,
      quantity: Number(i.quantity) || 0,
      checklist_id: i.itemId ? Number(i.itemId) || null : null,
    })),
    notes: 'نهایي سپارنه',
    action_by: user.uid,
    action_by_name: user.name,
    action_by_role: user.role,
  };

  try {
    if (!isNaN(numericId)) {
      try {
        await apiClient.post(`/delivery/finalize-from-request/${numericId}`, {
          action_by: user.uid,
          action_by_name: user.name,
          action_by_role: user.role,
        });
      } catch (fromReqErr: any) {
        const msg = parseApiErrorMessage(fromReqErr);
        if (msg && !msg.includes('ونه موندل')) throw new Error(msg);
        await apiClient.post('/delivery/finalize-items', payload);
      }
    } else {
      await apiClient.post('/delivery/finalize-items', payload);
    }

    return { success: true };
  } catch (apiError: any) {
    const apiMsg = parseApiErrorMessage(apiError) || apiError.message;
    throw new Error(apiMsg || "تخنیکي ستونزه رامنځته شوه.");
  }
};

/**
 * PROCUREMENT RECEIVING
 * Increases inventory based on Receipt Report.
 */
export const receiveProcurementToInventory = async (requestId: string, items: any[], user: { uid: string, name: string, role: string }) => {
  const dates = getCurrentHijriDates();

  try {
    const actor = {
      action_by: user.uid,
      action_by_name: user.name,
      action_by_role: user.role,
    };
    const receiving = await apiClient.post(`/receiving/from-request/${requestId}`, {
      notes: "Received",
      ...actor,
    });
    if (items.length > 0) {
      const apiItems = mapItemsForApi(items, 'quantity_received');
      await apiClient.post(`/receiving/${receiving.id || requestId}/items`, {
        items: apiItems,
        ...actor,
      });
    }
    return { success: true };
  } catch (apiError: any) {
    console.warn("Backend receiveProcurementToInventory failed; falling back to Firebase/Local", apiError);
  }

  if (!isFirebaseConfigured) {
    await updateRequestStage(requestId, "ReceivedToInventory", 82,
      "ګدام ته داخل شو",
      user, "د راپور رسید مطابق اجناس ګدام ته داخل شول.");

    for (const item of (items || [])) {
      if (item.name && (item.quantity || item.quantity_received)) {
        await performStockTransaction(
          requestId, "IN",
          Number(item.quantity || item.quantity_received || 0),
          "د راپور رسید مطابق اجناس ګدام ته داخل شول.",
          user, item.name
        );
      }
    }

    return { success: true };
  }

  const reqRef = doc(db, "requests", requestId);
  await updateRequestStage(requestId, "ReceivedToInventory", 82,
    "ګدام ته داخل شو / ورود به انبار",
    user, "د راپور رسید مطابق اجناس ګدام ته داخل شول.");

  for (const item of (items || [])) {
    if (item.name && (item.quantity || item.quantity_received)) {
      await performStockTransaction(
        requestId, "IN",
        Number(item.quantity || item.quantity_received || 0),
        "د راپور رسید مطابق اجناس ګدام ته داخل شول.",
        user, item.name
      );
    }
  }

  await logAuditEvent(user.uid, user.name, 'received_to_inventory' as any, { requestId });

  return { success: true };
};
