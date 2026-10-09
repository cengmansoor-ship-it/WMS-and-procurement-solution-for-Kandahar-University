import { useEffect, useState } from "react";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";
import { useLanguage } from "../../context/LanguageContext";

interface ActiveDelegate {
  id: number;
  delegated_role: "SUPER_ADMIN" | "ADMIN";
  delegated_user_name: string;
  delegated_user_email: string;
  end_date: string;
}

export default function DelegationBanner() {
  const { profile } = useAuth();
  const { pick } = useLanguage();
  const [delegates, setDelegates] = useState<ActiveDelegate[]>([]);
  const [dismissed, setDismissed] = useState(false);

  const isSuperAdmin = profile?.role === ROLES.SUPER_ADMIN;

  useEffect(() => {
    if (!isSuperAdmin) return;
    apiClient.get("/delegations/active")
      .then((res: any) => {
        const data = Array.isArray(res) ? res : (res?.data || []);
        setDelegates(data);
      })
      .catch(() => {});
  }, [isSuperAdmin]);

  if (!isSuperAdmin || dismissed || delegates.length === 0) return null;

  return (
    <div
      dir="rtl"
      className="w-full bg-amber-50 border-b border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/40 px-4 py-2.5"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg">👑</span>
          <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
            {pick("فعال کفالت:", "نمایندگی فعال:")}
          </span>
          {delegates.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 dark:bg-amber-900/40 dark:border-amber-600 px-3 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200"
            >
              <span>{d.delegated_user_name}</span>
              <span className="text-amber-500 dark:text-amber-400">·</span>
              <span className={d.delegated_role === "SUPER_ADMIN" ? "text-red-600 dark:text-red-400 font-bold" : "text-blue-600 dark:text-blue-400 font-bold"}>
                {d.delegated_role === "SUPER_ADMIN"
                  ? pick("سوپر اډمین", "سوپر ادمین")
                  : pick("اډمین", "ادمین")}
              </span>
              <span className="text-amber-400">·</span>
              <span className="text-amber-600 dark:text-amber-400 font-mono text-[10px]">
                {pick("تر", "تا")} {d.end_date ? d.end_date.split("T")[0] : ""}
              </span>
            </span>
          ))}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200 text-lg leading-none transition"
          title={pick("پټول", "بستن")}
        >
          ×
        </button>
      </div>
    </div>
  );
}
