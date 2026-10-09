import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  runTransaction,
  limit,
  orderBy
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { setLocalItem, seedDemoItems, getDemoTransactions, saveDemoTransactions, makeLocalId } from "./localStore";
import { getCurrentHijriDates, getHijriQamariDate, getHijriShamsiDate } from "../utils/dateUtils";
import { logAuditEvent } from "./audit";
import { apiClient } from "../api/apiClient";

// --- Data Mapping ---
const mapItemFromApi = (apiItem: any): WarehouseItem => ({
  id: apiItem.id ? apiItem.id.toString() : "",
  name: apiItem.name_ps || apiItem.name_fa || apiItem.name || "",
  category: apiItem.category_name || apiItem.category_id?.toString() || "",
  typeOrSpecification: apiItem.description || "",
  unit: apiItem.unit_name || apiItem.unit_id?.toString() || "",
  currentQuantity: Number(apiItem.current_stock) || 0,
  minimumStockLevel: Number(apiItem.minimum_stock) || 0,
  unitPrice: Number(apiItem.unit_price) || 0,
  supplierOrSource: "",
  description: apiItem.description || "",
  createdBy: apiItem.created_by?.toString() || "",
  updatedBy: apiItem.updated_by?.toString() || "",
  createdAt: apiItem.created_at ? new Date(apiItem.created_at).getTime() : Date.now(),
  updatedAt: apiItem.updated_at ? new Date(apiItem.updated_at).getTime() : Date.now(),
  createdAtHijriShamsi: "",
  createdAtHijriQamari: "",
  updatedAtHijriShamsi: "",
  updatedAtHijriQamari: "",
  isDeleted: apiItem.is_deleted === 1 || apiItem.is_deleted === true
});

const mapTransactionFromApi = (apiTx: any): StockTransaction => {
  const createdDate = apiTx.created_at ? new Date(apiTx.created_at) : new Date();
  return {
    id: apiTx.id ? apiTx.id.toString() : "",
    itemId: apiTx.item_id?.toString() || "",
    itemName: apiTx.item_name || "",
    type: apiTx.transaction_type as TransactionType || "ADJUSTMENT",
    quantity: Number(apiTx.quantity) || 0,
    unit: apiTx.unit_name || "",
    stockBefore: Number(apiTx.previous_stock) || 0,
    stockAfter: Number(apiTx.new_stock) || 0,
    reason: apiTx.notes || apiTx.source_type || "",
    sourceType: apiTx.source_type || "",
    performedBy: apiTx.created_by?.toString() || "",
    performedByName: apiTx.created_by_name || "",
    performedByRole: "",
    createdAt: createdDate.getTime(),
    createdAtHijriShamsi: getHijriShamsiDate(createdDate),
    createdAtHijriQamari: getHijriQamariDate(createdDate),
  };
};

// --- Types ---

export interface WarehouseItem {
  id: string;
  name: string;
  category: string;
  typeOrSpecification: string;
  unit: string;
  currentQuantity: number;
  minimumStockLevel: number;
  unitPrice: number;
  supplierOrSource: string;
  description: string;
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
  createdAtHijriShamsi: string;
  createdAtHijriQamari: string;
  updatedAtHijriShamsi: string;
  updatedAtHijriQamari: string;
  isDeleted: boolean;
}

export type TransactionType = 'IN' | 'OUT' | 'ADJUSTMENT';

export interface StockTransaction {
  id?: string;
  itemId: string;
  itemName: string;
  type: TransactionType;
  quantity: number;
  unit: string;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  sourceType?: string;
  requestId?: string;
  performedBy: string;
  performedByName: string;
  performedByRole: string;
  createdAt: number;
  createdAtHijriShamsi: string;
  createdAtHijriQamari: string;
  date?: number | string;
}

// --- Collections ---
const ITEMS_COL = "items";
const TRANSACTIONS_COL = "stock_transactions";

// --- Service Functions ---

export const getItems = async () => {
  try {
    const apiItems = await apiClient.get('/inventory/items');
    return apiItems.map(mapItemFromApi);
  } catch (apiError) {
    console.warn("Backend getItems failed; falling back to Firebase/Local");
    if (!isFirebaseConfigured) {
      return seedDemoItems().filter((item) => !item.isDeleted);
    }

    try {
      const q = query(collection(db, ITEMS_COL), where("isDeleted", "==", false));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as WarehouseItem));
    } catch (error) {
      console.warn("Firebase getItems failed; using demo items:", error);
      return seedDemoItems().filter((item) => !item.isDeleted);
    }
  }
};

export const getItemById = async (id: string) => {
  try {
    const apiItem = await apiClient.get(`/inventory/items/${id}`);
    if (apiItem) return mapItemFromApi(apiItem);
  } catch (apiError) {
    console.warn(`Backend getItemById failed for ${id}; falling back to Firebase/Local`);
    if (!isFirebaseConfigured) {
      return seedDemoItems().find((item) => item.id === id) || null;
    }

    try {
      const docRef = doc(db, ITEMS_COL, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) return { id: snap.id, ...snap.data() } as WarehouseItem;
      return null;
    } catch (error) {
      console.warn("Firebase getItemById failed; using demo items:", error);
      return seedDemoItems().find((item) => item.id === id) || null;
    }
  }
};

export const createItem = async (
  itemData: Partial<WarehouseItem> & { initialQuantity?: number }, 
  userId: string, 
  userName: string, 
  userRole: string
) => {
  const dates = getCurrentHijriDates();
  const initialQty = itemData.initialQuantity || 0;

  try {
    const anyData = itemData as any;
    const apiPayload: any = {
      item_code: `ITEM-${Date.now()}`,
      name_ps: itemData.name || "",
      name_fa: itemData.name || "",
      description: itemData.description || anyData.typeOrSpecification || "",
      category_id: Number(anyData.category_id) || 1,
      unit_id: Number(anyData.unit_id) || 1,
      warehouse_id: Number(anyData.warehouse_id) || 1,
      minimum_stock: itemData.minimumStockLevel || 0,
      unit_price: itemData.unitPrice || 0,
      supplier_source: anyData.supplierOrSource || "",
    };
    if (anyData.bab_id) apiPayload.bab_id = Number(anyData.bab_id);
    if (anyData.fasl_id) apiPayload.fasl_id = Number(anyData.fasl_id);
    const response = await apiClient.post('/inventory/items', apiPayload);
    const newId = response.id?.toString() || "";
    
    if (initialQty > 0 && newId) {
      await apiClient.post('/inventory/stock-in', {
        item_id: response.id,
        quantity: initialQty,
        source_type: 'INITIAL',
        notes: "د جنس لومړنۍ ثبت / ثبت اولیه جنس"
      });
    }
    return newId;
  } catch (apiError) {
    console.warn("Backend createItem failed; falling back to Firebase/Local");
    if (!isFirebaseConfigured) {
    const items = seedDemoItems();

    const newItem: WarehouseItem = {
      id: makeLocalId("item"),
      name: itemData.name || "",
      category: itemData.category || "",
      typeOrSpecification: itemData.typeOrSpecification || "",
      unit: itemData.unit || "",
      currentQuantity: initialQty,
      minimumStockLevel: itemData.minimumStockLevel || 0,
      unitPrice: itemData.unitPrice || 0,
      supplierOrSource: itemData.supplierOrSource || "",
      description: itemData.description || "",
      createdBy: userId,
      updatedBy: userId,
      createdAt: dates.timestamp,
      updatedAt: dates.timestamp,
      createdAtHijriShamsi: dates.shamsi,
      createdAtHijriQamari: dates.qamari,
      updatedAtHijriShamsi: dates.shamsi,
      updatedAtHijriQamari: dates.qamari,
      isDeleted: false,
    };
    setLocalItem("items", [newItem, ...items]);
    if (initialQty > 0) {
      const transactions = getDemoTransactions();
      transactions.unshift({
        id: makeLocalId("trx"),
        itemId: newItem.id,
        itemName: newItem.name,
        type: "IN",
        quantity: initialQty,
        unit: newItem.unit,
        stockBefore: 0,
        stockAfter: initialQty,
        reason: "د جنس لومړنۍ ثبت / ثبت اولیه جنس",
        performedBy: userId,
        performedByName: userName,
        performedByRole: userRole,
        createdAt: dates.timestamp,
        createdAtHijriShamsi: dates.shamsi,
        createdAtHijriQamari: dates.qamari,
      });
      saveDemoTransactions(transactions);
    }
    return newItem.id;
  }
  }

  const resultId = await runTransaction(db, async (transaction) => {
    const itemRef = doc(collection(db, ITEMS_COL));
    
    const newItem: WarehouseItem = {
      id: itemRef.id,
      name: itemData.name || "",
      category: itemData.category || "",
      typeOrSpecification: itemData.typeOrSpecification || "",
      unit: itemData.unit || "",
      currentQuantity: initialQty,
      minimumStockLevel: itemData.minimumStockLevel || 0,
      unitPrice: itemData.unitPrice || 0,
      supplierOrSource: itemData.supplierOrSource || "",
      description: itemData.description || "",
      createdBy: userId,
      updatedBy: userId,
      createdAt: dates.timestamp,
      updatedAt: dates.timestamp,
      createdAtHijriShamsi: dates.shamsi,
      createdAtHijriQamari: dates.qamari,
      updatedAtHijriShamsi: dates.shamsi,
      updatedAtHijriQamari: dates.qamari,
      isDeleted: false,
    };

    transaction.set(itemRef, newItem);

    if (initialQty > 0) {
      const transRef = doc(collection(db, TRANSACTIONS_COL));
      const transData: StockTransaction = {
        itemId: itemRef.id,
        itemName: newItem.name,
        type: 'IN',
        quantity: initialQty,
        unit: newItem.unit,
        stockBefore: 0,
        stockAfter: initialQty,
        reason: "د جنس لومړنۍ ثبت / ثبت اولیه جنس",
        performedBy: userId,
        performedByName: userName,
        performedByRole: userRole,
        createdAt: dates.timestamp,
        createdAtHijriShamsi: dates.shamsi,
        createdAtHijriQamari: dates.qamari,
      };
      transaction.set(transRef, transData);
    }

    return itemRef.id;
  });

  // Log audit event AFTER transaction succeeds
  try {
    await logAuditEvent(userId, userName, 'item_created' as any, { 
      itemId: resultId, 
      itemName: itemData.name, 
      initialQty 
    });
  } catch (auditError) {
    console.error("Audit logging failed but item was created:", auditError);
  }

  return resultId;
};

export const updateItem = async (id: string, itemData: Partial<WarehouseItem>, userId: string, userName: string) => {
  const dates = getCurrentHijriDates();

  try {
    const apiPayload = {
      name_ps: itemData.name,
      name_fa: itemData.name,
      description: itemData.description,
      minimum_stock: itemData.minimumStockLevel
    };
    await apiClient.put(`/inventory/items/${id}`, apiPayload);
    return;
  } catch (apiError) {
    console.warn(`Backend updateItem failed for ${id}; falling back to Firebase/Local`);
    if (!isFirebaseConfigured) {
    const items = seedDemoItems().map((item) =>
      item.id === id
        ? {
            ...item,
            ...itemData,
            updatedBy: userId,
            updatedAt: dates.timestamp,
            updatedAtHijriShamsi: dates.shamsi,
            updatedAtHijriQamari: dates.qamari,
          }
        : item
    );
    setLocalItem("items", items);
    return;
  }
  }

  const itemRef = doc(db, ITEMS_COL, id);
  
  const updateData = {
    ...itemData,
    updatedBy: userId,
    updatedAt: dates.timestamp,
    updatedAtHijriShamsi: dates.shamsi,
    updatedAtHijriQamari: dates.qamari,
  };

  await updateDoc(itemRef, updateData);
  await logAuditEvent(userId, userName, 'item_updated' as any, { itemId: id });
};

/**
 * Stock Transaction logic using Firestore Transaction for atomicity
 */
export const performStockTransaction = async (
  itemId: string, 
  type: TransactionType, 
  quantity: number, 
  reason: string, 
  user: { uid: string, name: string, role: string },
  itemName?: string
) => {
  if (quantity <= 0) throw new Error("مقدار باید له صفر څخه زیات وي. / مقدار باید بیشتر از صفر باشد.");

  // Demo mode — try MySQL backend first (inventory may live in DB while requests are local)
  if (!isFirebaseConfigured) {
    try {
      let apiItemId = parseInt(itemId, 10);
      if (isNaN(apiItemId) && itemName) {
        const searchRes = await apiClient.get(`/inventory/items?search=${encodeURIComponent(itemName)}`);
        const list = Array.isArray(searchRes) ? searchRes : (searchRes?.data || []);
        const match = list.find((entry: any) =>
          entry.name_ps?.trim() === itemName.trim() || entry.name_fa?.trim() === itemName.trim()
        ) || list[0];
        if (match?.id) apiItemId = Number(match.id);
      }
      if (!isNaN(apiItemId)) {
        let result;
        if (type === 'IN') {
          result = await apiClient.post('/inventory/stock-in', { item_id: apiItemId, quantity, notes: reason });
        } else if (type === 'OUT') {
          result = await apiClient.post('/inventory/stock-out', { item_id: apiItemId, quantity, notes: reason });
        }
        if (result) return { stockBefore: result.previous_stock, stockAfter: result.new_stock };
      }
    } catch (apiErr) {
      console.warn("Backend performStockTransaction (demo) failed; using localStorage", apiErr);
    }

    const dates = getCurrentHijriDates();
    const items = seedDemoItems();
    let item = items.find((entry) => entry.id === itemId);
    let matchedId = item?.id || '';
    if (!item && itemName) {
      item = items.find((entry) => entry.name.trim().toLowerCase() === itemName.trim().toLowerCase());
      matchedId = item?.id || '';
    }
    // Auto-create inventory item if not found by ID or name
    if (!item && itemName) {
      const newItem: WarehouseItem = {
        id: makeLocalId("auto_item"),
        name: itemName,
        category: "عمومی / عمومی",
        typeOrSpecification: "",
        unit: "دانه",
        currentQuantity: 0,
        minimumStockLevel: 0,
        unitPrice: 0,
        supplierOrSource: "",
        description: "",
        createdBy: user.uid,
        updatedBy: user.uid,
        createdAt: dates.timestamp,
        updatedAt: dates.timestamp,
        createdAtHijriShamsi: dates.shamsi,
        createdAtHijriQamari: dates.qamari,
        updatedAtHijriShamsi: dates.shamsi,
        updatedAtHijriQamari: dates.qamari,
        isDeleted: false,
      };
      setLocalItem("items", [newItem, ...items]);
      item = newItem;
      matchedId = newItem.id;
    }
    if (!item) throw new Error("جنس ونه موندل شو. / جنس پیدا نشد.");
    const stockBefore = Number(item.currentQuantity) || 0;
    let stockAfter = stockBefore;
    if (type === "IN") stockAfter += quantity;
    if (type === "OUT") {
      if (stockBefore < quantity) throw new Error("په ګودام کې موجودي کمه ده. / موجودی در گدام کم است.");
      stockAfter -= quantity;
    }
    if (type === "ADJUSTMENT") stockAfter = quantity;
    const updatedItems = items.map((entry) =>
      entry.id === matchedId ? { ...entry, currentQuantity: stockAfter, updatedAt: dates.timestamp } : entry
    );
    setLocalItem("items", updatedItems);
    const transactions = getDemoTransactions();
    transactions.unshift({
      id: makeLocalId("trx"),
      itemId: matchedId,
      itemName: item.name,
      type,
      quantity: type === "ADJUSTMENT" ? Math.abs(stockAfter - stockBefore) : quantity,
      unit: item.unit,
      stockBefore,
      stockAfter,
      reason,
      performedBy: user.uid,
      performedByName: user.name,
      performedByRole: user.role,
      createdAt: dates.timestamp,
      createdAtHijriShamsi: dates.shamsi,
      createdAtHijriQamari: dates.qamari,
    });
    saveDemoTransactions(transactions);
    return { stockBefore, stockAfter };
  }

  // Live mode — try backend API first, fallback to Firestore
  try {
    let result;
    if (type === 'IN') {
      result = await apiClient.post('/inventory/stock-in', {
        item_id: parseInt(itemId),
        quantity,
        notes: reason
      });
    } else if (type === 'OUT') {
      result = await apiClient.post('/inventory/stock-out', {
        item_id: parseInt(itemId),
        quantity,
        notes: reason
      });
    } else {
      return { stockBefore: 0, stockAfter: 0 };
    }
    return { stockBefore: result.previous_stock, stockAfter: result.new_stock };
  } catch (apiError: any) {
    console.warn("Backend performStockTransaction failed; falling back to Firestore", apiError);
  }

  return await runTransaction(db, async (transaction) => {
    const itemRef = doc(db, ITEMS_COL, itemId);
    const itemSnap = await transaction.get(itemRef);
    
    if (!itemSnap.exists()) throw new Error("جنس ونه موندل شو. / جنس پیدا نشد.");
    
    const item = itemSnap.data() as WarehouseItem;
    const stockBefore = item.currentQuantity;
    let stockAfter = stockBefore;

    if (type === 'IN') {
      stockAfter += quantity;
    } else if (type === 'OUT') {
      if (stockBefore < quantity) throw new Error("په ګودام کې موجودي کمه ده. / موجودی در گدام کم است.");
      stockAfter -= quantity;
    } else if (type === 'ADJUSTMENT') {
      stockAfter = quantity; // In adjustment, quantity is the NEW stock level
    }

    // Update item stock
    transaction.update(itemRef, { 
      currentQuantity: stockAfter,
      updatedAt: Date.now()
    });

    // Create transaction record
    const dates = getCurrentHijriDates();
    const transRef = doc(collection(db, TRANSACTIONS_COL));
    const transData: StockTransaction = {
      itemId,
      itemName: item.name,
      type,
      quantity: type === 'ADJUSTMENT' ? Math.abs(stockAfter - stockBefore) : quantity,
      unit: item.unit,
      stockBefore,
      stockAfter,
      reason,
      performedBy: user.uid,
      performedByName: user.name,
      performedByRole: user.role,
      createdAt: dates.timestamp,
      createdAtHijriShamsi: dates.shamsi,
      createdAtHijriQamari: dates.qamari,
    };
    
    transaction.set(transRef, transData);

    // Audit log
    const auditEvent = type === 'IN' ? 'stock_in' : type === 'OUT' ? 'stock_out' : 'stock_adjusted';
    await logAuditEvent(user.uid, user.name, auditEvent as any, { itemId, type, quantity, stockBefore, stockAfter });

    return { stockBefore, stockAfter };
  });
};

export const getRecentTransactions = async (limitCount: number = 20) => {
  try {
    const apiTxs = await apiClient.get('/inventory/transactions');
    return apiTxs.slice(0, limitCount).map(mapTransactionFromApi);
  } catch (apiError) {
    console.warn("Backend getRecentTransactions failed; falling back to Firebase/Local");
    if (!isFirebaseConfigured) {
      return getDemoTransactions().slice(0, limitCount);
    }

    try {
      const q = query(collection(db, TRANSACTIONS_COL), orderBy("createdAt", "desc"), limit(limitCount));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as StockTransaction));
    } catch (error) {
      console.warn("Firebase getRecentTransactions failed; using demo transactions:", error);
      return getDemoTransactions().slice(0, limitCount);
    }
  }
};
