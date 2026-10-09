import { getCurrentHijriDates } from "../utils/dateUtils";
import { getDemoEmailLogs, saveDemoEmailLogs, makeLocalId, DemoEmailLog } from "./localStore";

export const getEmailLogs = async (): Promise<DemoEmailLog[]> => {
  return getDemoEmailLogs().sort((a, b) => b.createdAt - a.createdAt);
};

export const saveEmailDraft = async (payload: Omit<DemoEmailLog, "id" | "createdAt" | "createdAtHijriShamsi" | "createdAtHijriQamari" | "status"> & { status?: DemoEmailLog["status"] }) => {
  const dates = getCurrentHijriDates();
  const log: DemoEmailLog = {
    id: makeLocalId("email"),
    to: payload.to,
    subject: payload.subject,
    body: payload.body,
    relatedRequestId: payload.relatedRequestId,
    requestLevel: payload.requestLevel,
    status: payload.status || "Draft",
    createdAt: dates.timestamp,
    createdAtHijriShamsi: dates.shamsi,
    createdAtHijriQamari: dates.qamari,
  };
  saveDemoEmailLogs([log, ...getDemoEmailLogs()]);
  return log;
};

export const openMailClient = async (log: DemoEmailLog) => {
  const subject = encodeURIComponent(log.subject);
  const body = encodeURIComponent(log.body);
  const mailtoUrl = `mailto:${encodeURIComponent(log.to)}?subject=${subject}&body=${body}`;
  const win = window.open(mailtoUrl, "_blank");
  if (!win) {
    window.location.href = mailtoUrl;
  }
};
