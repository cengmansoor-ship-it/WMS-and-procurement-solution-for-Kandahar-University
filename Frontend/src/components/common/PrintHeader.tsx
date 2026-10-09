import { useEffect, useState } from "react";
import { getHijriShamsiDate } from "../../utils/dateUtils";
import { useCalendar } from "../../context/CalendarContext";

const cleanTitle = (title: string) =>
  title
    .replace(/\s*\|\s*Kandahar University WMS.*$/i, "")
    .replace(/\s*\|\s*WMS.*$/i, "")
    .trim();

export default function PrintHeader() {
  const { getServerNow } = useCalendar();
  const [printInfo, setPrintInfo] = useState(() => ({
    title: cleanTitle(document.title) || "د کندهار پوهنتون د اجناسو مدیریت سیستم",
    shamsiDate: getHijriShamsiDate(getServerNow()),
  }));

  useEffect(() => {
    const preparePrint = () => {
      setPrintInfo({
        title: cleanTitle(document.title) || "د کندهار پوهنتون د اجناسو مدیریت سیستم",
        shamsiDate: getHijriShamsiDate(getServerNow()),
      });
    };
    window.addEventListener("beforeprint", preparePrint);
    return () => window.removeEventListener("beforeprint", preparePrint);
  }, [getServerNow]);

  return (
    <>
      <header className="wms-print-header" dir="rtl" aria-hidden="true">
        <div className="wms-print-header__side">
          <strong>د کندهار پوهنتون</strong>
          <span>د عمومي ګدام او تدارکاتو مدیریت</span>
        </div>
        <div className="wms-print-header__brand">
          <img src="/kandahar-university-logo.png" alt="" />
          <div>
            <div className="wms-print-header__system">د اجناسو مدیریت سیستم</div>
            <div className="wms-print-header__title">{printInfo.title}</div>
          </div>
        </div>
        <div className="wms-print-header__side wms-print-header__date">
          <strong>نېټه (هجري شمسي)</strong>
          <span>{printInfo.shamsiDate}</span>
        </div>
      </header>
      <footer className="wms-print-footer" dir="rtl" aria-hidden="true">
        <span>کندهار پوهنتون — WMS</span>
        <span>دا سند د سیستم له باوري معلوماتو څخه چاپ شوی.</span>
      </footer>
    </>
  );
}
