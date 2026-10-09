import { useState, useEffect } from "react";

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      setWasOffline(true);
      setShowReconnected(false);
    };

    const goOnline = () => {
      setIsOffline(false);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [wasOffline]);

  if (!isOffline && !showReconnected) return null;

  return (
    <div
      dir="rtl"
      className={`fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2 flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg transition-all duration-300 ${
        isOffline
          ? "bg-red-600 text-white"
          : "bg-green-600 text-white"
      }`}
    >
      {isOffline ? (
        <>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-200 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-100" />
          </span>
          آفلاین — د سیسټم نوري برخي د ذخیره شوي معلوماتو له لارې کار کوي
        </>
      ) : (
        <>
          <span className="h-2.5 w-2.5 rounded-full bg-green-200" />
          ✓ شبکه بیا وصل شوه
        </>
      )}
    </div>
  );
}
