import React from "react";
import GridShape from "../../components/common/GridShape";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";
const kuLogo = "/kandahar-university-logo.png";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-1 bg-white p-6 dark:bg-gray-900 sm:p-0" dir="rtl">
      <div className="relative flex min-h-screen w-full flex-col justify-center lg:flex-row dark:bg-gray-900 sm:p-0">
        {children}
        <div className="hidden h-full min-h-screen w-full items-center bg-brand-950 lg:grid lg:w-1/2 dark:bg-white/5">
          <div className="relative z-1 flex items-center justify-center">
            <GridShape />
            <div className="flex max-w-sm flex-col items-center px-6 text-center">
              <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-white/10 p-2 overflow-hidden">
                <img src={kuLogo} alt="Kandahar University Logo" className="h-full w-full object-contain rounded-full drop-shadow-lg" />
              </div>
              <h2 className="mb-4 text-2xl font-bold text-white">
                د کندهار پوهنتون WMS
              </h2>
              <p className="text-center leading-7 text-gray-300 dark:text-white/70">
                د اجناسو غوښتنه، موجودي، تدارکات، ترلاسه کول، تسلیمي او راپورونه په یوه منظم ډیجیټلي سیستم کې.
              </p>
            </div>
          </div>
        </div>
        <div className="fixed bottom-6 left-6 z-50 hidden sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
