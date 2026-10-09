interface WmsDialogProps {
  type?: "confirm" | "alert" | "success" | "error" | "warning";
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

const icons: Record<string, string> = {
  confirm: "❓",
  alert: "ℹ️",
  success: "✅",
  error: "❌",
  warning: "⚠️",
};

const colors: Record<string, { border: string; icon_bg: string; title: string; confirm: string }> = {
  confirm: {
    border: "border-blue-200 dark:border-blue-800/50",
    icon_bg: "bg-blue-50 dark:bg-blue-900/30",
    title: "text-blue-700 dark:text-blue-300",
    confirm: "bg-blue-600 hover:bg-blue-700",
  },
  alert: {
    border: "border-gray-200 dark:border-gray-700",
    icon_bg: "bg-gray-50 dark:bg-gray-800",
    title: "text-gray-700 dark:text-gray-200",
    confirm: "bg-primary hover:bg-primary/90",
  },
  success: {
    border: "border-green-200 dark:border-green-800/50",
    icon_bg: "bg-green-50 dark:bg-green-900/30",
    title: "text-green-700 dark:text-green-300",
    confirm: "bg-green-600 hover:bg-green-700",
  },
  error: {
    border: "border-red-200 dark:border-red-800/50",
    icon_bg: "bg-red-50 dark:bg-red-900/30",
    title: "text-red-700 dark:text-red-300",
    confirm: "bg-red-600 hover:bg-red-700",
  },
  warning: {
    border: "border-orange-200 dark:border-orange-800/50",
    icon_bg: "bg-orange-50 dark:bg-orange-900/30",
    title: "text-orange-700 dark:text-orange-300",
    confirm: "bg-orange-500 hover:bg-orange-600",
  },
};

export default function WmsDialog({
  type = "confirm",
  title,
  message,
  confirmText = "تایید",
  cancelText = "لغوه",
  onConfirm,
  onCancel,
}: WmsDialogProps) {
  const c = colors[type] || colors.confirm;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" dir="rtl">
      <div className={`w-full max-w-sm rounded-2xl border-2 ${c.border} bg-white dark:bg-gray-900 shadow-2xl overflow-hidden`}>
        <div className={`px-6 pt-5 pb-4 ${c.icon_bg} border-b ${c.border}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icons[type]}</span>
            <h4 className={`text-base font-bold ${c.title}`}>{title}</h4>
          </div>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl ${c.confirm} text-white text-sm font-bold shadow-sm transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
