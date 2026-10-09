import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { getLocalItem, getDemoUsers, getDemoRequests, getDemoPipeline, getDemoLevelHistory, getDemoTransactions, seedDemoItems, getDemoEmailLogs } from "./localStore";
import { getCurrentHijriDates } from "../utils/dateUtils";
import { logAuditEvent } from "./audit";

// --- Types ---

export interface TrashLog {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  action: 'soft_deleted' | 'restored' | 'permanent_deleted';
  reason: string;
  performedBy: string;
  performedByName: string;
  performedByRole: string;
  performedAt: number;
  performedAtHijriShamsi: string;
}

export interface QAChecklistItem {
  id: string;
  category: string;
  title: string;
  status: 'Pending' | 'Passed' | 'Failed';
  notes: string;
  checkedBy?: string;
  checkedByName?: string;
  checkedAtHijriShamsi?: string;
}

const TRASH_LOGS_COL = "trash_logs";
const QA_CHECKLIST_COL = "qa_checklists";

// --- Soft Delete & Restore ---

export const softDeleteRecord = async (
  collectionName: string,
  id: string,
  label: string,
  reason: string,
  user: { uid: string, name: string, role: string }
) => {
  const dates = getCurrentHijriDates();
  const ref = doc(db, collectionName, id);
  
  await updateDoc(ref, {
    isDeleted: true,
    deletedAt: dates.timestamp,
    deletedAtHijriShamsi: dates.shamsi,
    deletedBy: user.uid,
    deletedByName: user.name,
    deletedByRole: user.role,
    deleteReason: reason
  });

  const logRef = doc(collection(db, TRASH_LOGS_COL));
  await setDoc(logRef, {
    id: logRef.id,
    entityType: collectionName,
    entityId: id,
    entityLabel: label,
    action: 'soft_deleted',
    reason,
    performedBy: user.uid,
    performedByName: user.name,
    performedByRole: user.role,
    performedAt: dates.timestamp,
    performedAtHijriShamsi: dates.shamsi
  });

  await logAuditEvent(user.uid, user.name, 'soft_delete' as any, { collectionName, id, label, reason });
};

export const restoreRecord = async (
  collectionName: string,
  id: string,
  reason: string,
  user: { uid: string, name: string, role: string }
) => {
  const dates = getCurrentHijriDates();
  const ref = doc(db, collectionName, id);

  await updateDoc(ref, {
    isDeleted: false,
    restoredAt: dates.timestamp,
    restoredBy: user.uid,
    restoredByName: user.name,
    restoredByRole: user.role,
    restoreReason: reason
  });

  const logRef = doc(collection(db, TRASH_LOGS_COL));
  await setDoc(logRef, {
    id: logRef.id,
    entityType: collectionName,
    entityId: id,
    entityLabel: "Restoration",
    action: 'restored',
    reason,
    performedBy: user.uid,
    performedByName: user.name,
    performedByRole: user.role,
    performedAt: dates.timestamp,
    performedAtHijriShamsi: dates.shamsi
  });

  await logAuditEvent(user.uid, user.name, 'restore_record' as any, { collectionName, id, reason });
};

export const getRecoveryHistory = async () => {
  if (!isFirebaseConfigured) return [];
  try {
    const q = query(collection(db, TRASH_LOGS_COL), orderBy("performedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as TrashLog);
  } catch (error) {
    console.warn("Recovery history load failed:", error);
    return [];
  }
};

// --- QA Checklist ---

export const getQAChecklist = async () => {
  if (!isFirebaseConfigured) {
    return [
      { id: "auth", category: "Auth", title: "Login/Logout flow", status: "Passed", notes: "Demo/Firebase compatible" },
      { id: "inventory", category: "Inventory", title: "Inventory pages", status: "Passed", notes: "Local demo data available" },
      { id: "requests", category: "Requests", title: "Request workflow", status: "Passed", notes: "Basic workflow available" },
      { id: "forms", category: "Official Forms", title: "Official forms viewer", status: "Passed", notes: "7 forms available" },
    ] as QAChecklistItem[];
  }
  try {
    const snap = await getDocs(collection(db, QA_CHECKLIST_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as QAChecklistItem));
  } catch (error) {
    console.warn("QA checklist load failed:", error);
    return [];
  }
};

export const updateQAChecklist = async (
  id: string,
  updates: Partial<QAChecklistItem>,
  user: { uid: string, name: string }
) => {
  const dates = getCurrentHijriDates();
  const ref = doc(db, QA_CHECKLIST_COL, id);
  const data = {
    ...updates,
    checkedBy: user.uid,
    checkedByName: user.name,
    checkedAtHijriShamsi: dates.shamsi,
    checkedAt: dates.timestamp
  };
  await updateDoc(ref, data);
  await logAuditEvent(user.uid, user.name, 'qa_checklist_update' as any, { id, ...updates });
};

// --- Backup & Export ---

export const exportCollectionToJson = async (collectionName: string) => {
  if (!isFirebaseConfigured) return [];
  try {
    const snap = await getDocs(collection(db, collectionName));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return data;
  } catch (error) {
    console.warn(`Export collection ${collectionName} failed:`, error);
    return [];
  }
};

export const generateFullBackup = async (user: { uid: string, name: string, role: string }) => {
  const collections = [
    "users", "items", "stock_transactions", "item_assignments", 
    "requests", "request_items", "request_pipeline", "request_level_history",
    "procurements", "vendor_offers", "comparison_records", "purchase_orders", 
    "receipt_reports", "fs5_documents", "deliveries", "audit_logs", "trash_logs", "qa_checklists", "email_logs", "request_limits"
  ];
  const dates = getCurrentHijriDates();

  if (!isFirebaseConfigured) {
    const backup: Record<string, any> = {
      "کاروونکي": getDemoUsers().map(({ forcePasswordChange, ...userRecord }) => ({ ...userRecord, forcePasswordChange })),
      "اجناس": seedDemoItems(),
      "د موجودۍ حرکات": getDemoTransactions(),
      "غوښتنې": getDemoRequests(),
      "د غوښتنو پایپ لاین": getDemoPipeline(),
      "د درجې تاریخچه": getDemoLevelHistory(),
      "ایمیلونه": getDemoEmailLogs(),
      "فورمونه": getLocalItem("official_form_instances", []),
      "امانتونه": getLocalItem("item_assignments", []),
      "تدارکات": getLocalItem("procurements", []),
      "قیمتونه": getLocalItem("vendor_offers", []),
      "مقایسه": getLocalItem("comparison_records", []),
      "آمر خریداري": getLocalItem("purchase_orders", []),
      "راپور رسید": getLocalItem("receipt_reports", []),
      "ف س ۵": getLocalItem("fs5_documents", []),
      "تسلیمي": getLocalItem("deliveries", []),
      "تنظیمات": getLocalItem("request_limits", { dailyLimit: 10 }),
      "د بیکپ معلومات": [{ generatedBy: user.name, role: user.role, generatedAtHijriShamsi: dates.shamsi, generatedAtHijriQamari: dates.qamari }],
    };
    return backup;
  }

  const backup: Record<string, any> = {};
  for (const col of collections) {
    backup[col] = await exportCollectionToJson(col);
  }

  const backupLogRef = doc(collection(db, "backup_logs"));
  await setDoc(backupLogRef, {
    id: backupLogRef.id,
    generatedBy: user.uid,
    generatedByName: user.name,
    generatedByRole: user.role,
    generatedAt: dates.timestamp,
    generatedAtHijriShamsi: dates.shamsi,
    generatedAtHijriQamari: dates.qamari,
    collectionCount: collections.length
  });

  return backup;
};

// --- System Health ---

export const performHealthCheck = async () => {
  if (!isFirebaseConfigured) {
    return {
      status: 'فعال',
      latency: '0ms',
      firebaseConnected: false,
      lastAudit: 'سیمه‌ییز حالت'
    };
  }

  const start = Date.now();
  try {
    const snap = await getDocs(query(collection(db, "audit_logs"), limit(1)));
    const latency = Date.now() - start;
    return {
      status: 'Healthy',
      latency: `${latency}ms`,
      firebaseConnected: true,
      lastAudit: snap.docs[0]?.data()?.timestampHijriShamsi || "N/A"
    };
  } catch (e) {
    return { status: 'Error', error: String(e), firebaseConnected: false };
  }
};
