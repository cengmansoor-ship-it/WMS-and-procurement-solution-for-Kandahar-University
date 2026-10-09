import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export type AuditEventType = 
  | 'login' 
  | 'logout' 
  | 'signup' 
  | 'role_change' 
  | 'unauthorized_access' 
  | 'disabled_user_access_attempt'
  | 'system_setting_change';

export interface AuditLog {
  uid: string;
  email: string;
  event: AuditEventType;
  details?: any;
  timestamp: any;
  ip?: string;
}

const COLLECTION_NAME = "audit_logs";

export const logAuditEvent = async (
  uid: string, 
  email: string, 
  event: AuditEventType, 
  details?: any
) => {
  try {
    await addDoc(collection(db, COLLECTION_NAME), {
      uid,
      email,
      event,
      details: details || {},
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging audit event:", error);
  }
};
