import { useCalendar } from "../../context/CalendarContext";
import { getHijriShamsiDate } from "../../utils/dateUtils";

interface CurrentDateBadgeProps {
  className?: string;
  label?: string;
  forceShamsi?: boolean;
}

export default function CurrentDateBadge({ className = "", label, forceShamsi = false }: CurrentDateBadgeProps) {
  const { getCurrentDateString, getServerNow, calendarType } = useCalendar();
  const calLabel = forceShamsi
    ? "شمسي"
    : calendarType === "shamsi" ? "شمسي" :
      calendarType === "qamari" ? "قمري" : "میلادي";
  const dateText = forceShamsi ? getHijriShamsiDate(getServerNow()) : getCurrentDateString();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary dark:border-primary/30 dark:bg-primary/10 dark:text-primary/80 ${className}`}
      dir="rtl"
    >
      <span>📅</span>
      <span>{label ? `${label}: ` : ""}{dateText}</span>
      <span className="opacity-60">({calLabel})</span>
    </span>
  );
}
