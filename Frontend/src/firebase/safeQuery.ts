import { 
  getDocs, 
  Query, 
  QuerySnapshot, 
  Timestamp 
} from "firebase/firestore";

/**
 * Normalizes Firestore errors into human-readable (and Pashto/Dari) messages
 */
export const normalizeFirestoreError = (error: any): string => {
  console.error("Firestore Error Detailed:", error);
  
  const code = error?.code || "unknown";
  
  switch (code) {
    case "permission-denied":
      return "تاسې دې برخې ته اجازه نه لرئ. / شما به این بخش اجازه ندارید.";
    case "unauthenticated":
      return "مهرباني وکړئ لومړی ننوځئ. / لطفا ابتدا وارد شوید.";
    case "not-found":
      return "معلومات ونه موندل شول. / معلومات پیدا نشد.";
    case "failed-precondition":
      return "د ډیټابیس ستونزه (Index). مهرباني وکړئ وروسته هڅه وکړئ.";
    case "unavailable":
      return "انټرنیټ یا ډیټابیس کار نه کوي. / انترنت یا دیتابیس کار نمیکند.";
    default:
      return "د معلوماتو په راوړلو کې ستونزه رامنځته شوه. / مشکلی در دریافت معلومات رخ داد.";
  }
};

/**
 * Safely converts Firestore Timestamp to JS Date or fallback
 */
export const safeTimestampToDate = (timestamp: any, fallback: Date = new Date()): Date => {
  if (!timestamp) return fallback;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  if (typeof timestamp === 'number') return new Date(timestamp);
  return fallback;
};

/**
 * Executes a query with a timeout to prevent infinite loading on bad networks
 */
export const safeGetDocs = async (q: Query, timeoutMs: number = 10000): Promise<QuerySnapshot> => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("تایم آوټ: انټرنیټ ډیر ضعیف دی. / تایم اوت: انترنت بسیار ضعیف است.")), timeoutMs);
  });

  return Promise.race([
    getDocs(q),
    timeoutPromise as Promise<QuerySnapshot>
  ]);
};

/**
 * Safely removes undefined fields before saving to Firestore
 */
export const removeUndefinedFields = (obj: any): any => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      newObj[key] = null; // or delete newObj[key]
    } else if (typeof newObj[key] === 'object' && newObj[key] !== null) {
      newObj[key] = removeUndefinedFields(newObj[key]);
    }
  });
  return newObj;
};

/**
 * Client-side sort helper for items with createdAt field
 */
export const safeSortByCreatedAt = <T extends { createdAt?: any }>(items: T[], direction: 'asc' | 'desc' = 'desc'): T[] => {
  return [...items].sort((a, b) => {
    const dateA = safeTimestampToDate(a.createdAt, new Date(0)).getTime();
    const dateB = safeTimestampToDate(b.createdAt, new Date(0)).getTime();
    return direction === 'desc' ? dateB - dateA : dateA - dateB;
  });
};
