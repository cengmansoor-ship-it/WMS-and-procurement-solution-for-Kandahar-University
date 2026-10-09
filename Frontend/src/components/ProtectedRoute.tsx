import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import { logAuditEvent } from "../firebase/audit";
import { logout } from "../firebase/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.active === false) {
        logAuditEvent(user.uid, user.email || "", "disabled_user_access_attempt", { path: location.pathname });
      }
      if (allowedRoles && !allowedRoles.includes(profile.role)) {
        logAuditEvent(user.uid, user.email || "", "unauthorized_access", {
          path: location.pathname,
          requiredRoles: allowedRoles,
          currentRole: profile.role,
        });
      }
    }
  }, [loading, user, profile, location.pathname, allowedRoles]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white text-center dark:bg-gray-900">
        <div className="mb-4 h-14 w-14 animate-spin rounded-full border-4 border-solid border-brand-500 border-t-transparent" />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">سیستم بارېږي... / سیستم در حال بارگذاری است...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  if (!profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white p-4 text-center dark:bg-gray-900">
        <h1 className="mb-4 text-2xl font-bold text-red-600">پروفایل ونه موندل شو / پروفایل پیدا نشد</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">مهرباني وکړئ بیا ننوتل وکړئ.</p>
        <button
          onClick={async () => {
            await logout();
            window.location.replace("/signin");
          }}
          className="rounded-lg bg-brand-500 px-6 py-2 text-white hover:bg-brand-600"
        >
          بېرته ننوتل / ورود دوباره
        </button>
      </div>
    );
  }

  if (profile.active === false) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white p-4 text-center dark:bg-gray-900">
        <h1 className="mb-4 text-2xl font-bold text-red-600">ستاسو حساب غیر فعال دی / حساب شما غیر فعال است</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">لطفاً د سیستم له مدیر سره اړیکه ونیسئ.</p>
        <button
          onClick={async () => {
            await logout();
            window.location.replace("/signin");
          }}
          className="rounded-lg bg-brand-500 px-6 py-2 text-white hover:bg-brand-600"
        >
          وتل / خروج
        </button>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white p-4 text-center dark:bg-gray-900">
        <h1 className="mb-4 text-2xl font-bold text-red-600">لاسرسی منع دی / دسترسی ممنوع است</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">تاسو د دې پاڼې لیدلو اجازه نه لرئ.</p>
        <button
          onClick={() => window.location.replace("/dashboard")}
          className="rounded-lg bg-brand-500 px-6 py-2 text-white hover:bg-brand-600"
        >
          عمومي پاڼه / صفحه اصلی
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
