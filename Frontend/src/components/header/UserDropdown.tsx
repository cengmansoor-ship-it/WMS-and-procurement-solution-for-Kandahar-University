import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { logout } from "../../firebase/auth";

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { profile, user } = useAuth();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.replace("/signin");
    }
  };

  const firstLetter =
    profile?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || "U";

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className="relative" dir="rtl">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1 text-gray-700 dropdown-toggle dark:text-gray-400"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0">
          <span className="font-bold text-gray-600 dark:text-gray-300 text-sm">
            {firstLetter}
          </span>
        </span>
        <span className="hidden sm:block font-medium text-theme-sm max-w-[120px] truncate">
          {profile?.name || "کارونکی"}
        </span>
        <svg
          className={`shrink-0 stroke-gray-500 transition-transform duration-200 dark:stroke-gray-400 ${isOpen ? "rotate-180" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 18 20"
          fill="none"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown panel — absolute relative to wrapper, no JS positioning needed */}
      {isOpen && (
        <div
          className={[
            "absolute top-[calc(100%+8px)] z-[9999]",
            "w-64 rounded-2xl border border-gray-200 bg-white shadow-lg",
            "dark:border-gray-700 dark:bg-gray-900",
            "flex flex-col p-3",
            // In RTL the button is on the left edge, open panel to the right (ltr direction):
            "left-0",
          ].join(" ")}
          dir="rtl"
        >
          {/* User info */}
          <div className="pb-3 border-b border-gray-100 dark:border-gray-800">
            <span className="block font-semibold text-gray-800 text-sm dark:text-white/90 leading-tight">
              {profile?.name || "کارونکی"}
            </span>
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400 break-all leading-snug">
              {user?.email}
            </span>
            <span className="mt-1.5 inline-block rounded-full bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
              {profile?.role || "User"}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            وتل / خروج
          </button>
        </div>
      )}
    </div>
  );
}
