import { useState, useEffect, useCallback } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Button from "../../components/ui/button/Button";
import { getLocalItem, setLocalItem, DEMO_SEED_USERS } from "../../firebase/localStore";
import { isFirebaseConfigured } from "../../firebase/firebase";
import { getCurrentHijriDates } from "../../utils/dateUtils";
import { useLanguage } from "../../context/LanguageContext";
import { useCalendar } from "../../context/CalendarContext";
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS } from "../../constants/roles";
import { useAuth } from "../../context/AuthContext";

const FONT_SIZE_OPTIONS = [
  { key: "small",  label_ps: "کوچنی",   label_dr: "کوچک",      px: "14px" },
  { key: "medium", label_ps: "منځنی",   label_dr: "متوسط",     px: "16px" },
  { key: "large",  label_ps: "لوی",     label_dr: "بزرگ",      px: "18px" },
  { key: "xlarge", label_ps: "ډېر لوی", label_dr: "خیلی بزرگ", px: "20px" },
];

const limitOptions = [0, 5, 10, 20, 30];

interface EmailConfig {
  id: number;
  email: string;
  label: string;
  created_at: string;
}

interface EmailForm {
  email: string;
  app_password: string;
  label: string;
}

const emptyForm: EmailForm = { email: "", app_password: "", label: "" };

interface CustomRole {
  id: number;
  name: string;
  name_ps: string;
  name_dr: string;
  permissions: string[];
  created_at: string;
}

const ALL_PERMISSIONS = Object.entries(PERMISSIONS);

const PERM_LABEL_PS: Record<string, string> = {
  [PERMISSIONS.MANAGE_USERS]: "کاربران مدیریت",
  [PERMISSIONS.MANAGE_ROLES]: "رولونه مدیریت",
  [PERMISSIONS.VIEW_AUDIT_LOGS]: "آډیټ لاګونه",
  [PERMISSIONS.VIEW_TRASH]: "ژبدار ولیدل",
  [PERMISSIONS.MANAGE_SETTINGS]: "تنظیمات",
  [PERMISSIONS.VIEW_INVENTORY]: "موجودي ولیدل",
  [PERMISSIONS.EDIT_INVENTORY]: "موجودي سمول",
  [PERMISSIONS.VIEW_PROCUREMENT]: "تدارکات ولیدل",
  [PERMISSIONS.MANAGE_PROCUREMENT]: "تدارکات مدیریت",
  [PERMISSIONS.VIEW_RECEIVING]: "تسلیمي ولیدل",
  [PERMISSIONS.MANAGE_RECEIVING]: "تسلیمي مدیریت",
  [PERMISSIONS.CREATE_REQUESTS]: "غوښتنه جوړول",
  [PERMISSIONS.CONFIRM_REQUESTS]: "غوښتنه تاییدول",
  [PERMISSIONS.VIEW_ALL_REQUESTS]: "ټولې غوښتنې",
  [PERMISSIONS.VIEW_REPORTS]: "راپورونه",
};

export default function SettingsPage() {
  const saved = getLocalItem("request_limits", { dailyLimit: 10, updatedAtHijriShamsi: "" });
  const [dailyLimit, setDailyLimit] = useState<number>(Number((saved as any).dailyLimit) || 10);

  // Load the authoritative limit from the backend on mount
  useEffect(() => {
    fetch("/api/settings/request-limit")
      .then(r => r.json())
      .then(d => { if (d?.data?.limit !== undefined) setDailyLimit(Number(d.data.limit)); })
      .catch(() => {});
  }, []);
  const [message, setMessage] = useState("");
  const { lang, setLang, pick } = useLanguage();
  const { calendarType, setCalendarType } = useCalendar();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === ROLES.SUPER_ADMIN;

  const [fontSize, setFontSizeState] = useState<string>(
    () => localStorage.getItem("wms_font_size") || "medium"
  );

  const applyFontSize = (key: string) => {
    const opt = FONT_SIZE_OPTIONS.find(o => o.key === key);
    if (!opt) return;
    document.documentElement.style.setProperty("--base-font-size", opt.px);
    localStorage.setItem("wms_font_size", key);
    setFontSizeState(key);
  };

  const [emailConfigs, setEmailConfigs] = useState<EmailConfig[]>([]);
  const [emailForm, setEmailForm] = useState<EmailForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Custom Roles state
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [customRolesLoading, setCustomRolesLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", name_ps: "", name_dr: "", permissions: [] as string[] });
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleMsg, setRoleMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<CustomRole | null>(null);

  // Change Password state
  const [cpForm, setCpForm] = useState({ current: "", newPass: "", confirm: "" });
  const [cpShowCurrent, setCpShowCurrent] = useState(false);
  const [cpShowNew, setCpShowNew] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpMsg, setCpMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const checkPasswordStrength = (pw: string): string[] => {
    const errors: string[] = [];
    if (pw.length < 8)        errors.push(pick("لږترلږه ۸ کرکټره وي", "حداقل ۸ کاراکتر"));
    if (!/[A-Z]/.test(pw))    errors.push(pick("یو لوی توری (A-Z)", "یک حرف بزرگ (A-Z)"));
    if (!/[a-z]/.test(pw))    errors.push(pick("یو کوچنی توری (a-z)", "یک حرف کوچک (a-z)"));
    if (!/[0-9]/.test(pw))    errors.push(pick("یو عدد (0-9)", "یک عدد (0-9)"));
    return errors;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpMsg(null);
    if (!cpForm.current) return setCpMsg({ text: pick("اوسنی پاسورډ ولیکئ.", "رمز فعلی را وارد کنید."), ok: false });
    const pwErrors = checkPasswordStrength(cpForm.newPass);
    if (pwErrors.length > 0) return setCpMsg({ text: pick("پاسورډ ضعیف دی: ", "رمز ضعیف است: ") + pwErrors.join(" | "), ok: false });
    if (cpForm.newPass !== cpForm.confirm) return setCpMsg({ text: pick("نوی پاسورډونه سره برابر نه دي.", "رمزهای جدید با هم مطابقت ندارند."), ok: false });
    if (!profile?.email) return setCpMsg({ text: pick("ایمیل پته ونه موندل شوه.", "آدرس ایمیل یافت نشد."), ok: false });

    // Demo/localStorage mode
    if (!isFirebaseConfigured) {
      const email = profile.email.trim().toLowerCase();
      const seedUser = DEMO_SEED_USERS.find(u => u.email.toLowerCase() === email);
      const overrides = getLocalItem<{ email: string; password: string }[]>("password_overrides", []);
      const override = overrides.find(o => o.email.toLowerCase() === email);
      const effectivePass = override ? override.password : (seedUser?.password || "");
      if (cpForm.current !== effectivePass) {
        setCpMsg({ text: pick("اوسنی پاسورډ ناسم دی.", "رمز فعلی نادرست است."), ok: false });
        return;
      }
      const filtered = overrides.filter(o => o.email.toLowerCase() !== email);
      setLocalItem("password_overrides", [...filtered, { email, password: cpForm.newPass }]);
      setCpForm({ current: "", newPass: "", confirm: "" });
      setCpMsg({ text: pick("✅ پاسورډ بریالیتوب سره بدل شو.", "✅ رمز با موفقیت تغییر کرد."), ok: true });
      return;
    }

    setCpLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email, currentPassword: cpForm.current, newPassword: cpForm.newPass }),
      });
      const data = await res.json();
      if (data.success) {
        setCpForm({ current: "", newPass: "", confirm: "" });
        setCpMsg({ text: pick("✅ پاسورډ بریالیتوب سره بدل شو.", "✅ رمز با موفقیت تغییر کرد."), ok: true });
      } else if (data.code === "WRONG_CURRENT_PASSWORD") {
        setCpMsg({ text: pick("اوسنی پاسورډ ناسم دی.", "رمز فعلی نادرست است."), ok: false });
      } else {
        setCpMsg({ text: data.message || pick("ستونزه وه.", "خطایی رخ داد."), ok: false });
      }
    } catch {
      setCpMsg({ text: pick("د سرور سره اتصال نشو.", "اتصال به سرور برقرار نشد."), ok: false });
    } finally {
      setCpLoading(false);
    }
  };

  // SMS Config state
  interface SmsFormState {
    provider: "twilio" | "kavenegar" | "custom";
    sender_id: string;
    api_key: string;
    auth_token: string;
    admin_phone: string;
    custom_endpoint: string;
    notify_received: boolean;
    notify_delivered: boolean;
    notify_approved: boolean;
    notify_low_stock: boolean;
    is_active: boolean;
  }
  const emptySmsForm: SmsFormState = {
    provider: "twilio", sender_id: "", api_key: "", auth_token: "",
    admin_phone: "", custom_endpoint: "",
    notify_received: true, notify_delivered: true,
    notify_approved: true, notify_low_stock: true,
    is_active: false,
  };
  const [smsForm, setSmsForm] = useState<SmsFormState>(emptySmsForm);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsTesting, setSmsTesting] = useState(false);
  const [smsMsg, setSmsMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [smsApiKeySet, setSmsApiKeySet] = useState(false);
  const [smsAuthTokenSet, setSmsAuthTokenSet] = useState(false);

  const flashSmsMsg = (text: string, type: "success" | "error") => {
    setSmsMsg({ text, type });
    setTimeout(() => setSmsMsg(null), 5000);
  };

  const loadSmsConfig = async () => {
    setSmsLoading(true);
    try {
      const res = await fetch("/api/sms/config");
      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data;
        setSmsForm({
          provider: d.provider || "twilio",
          sender_id: d.sender_id || "",
          api_key: "",
          auth_token: "",
          admin_phone: d.admin_phone || "",
          custom_endpoint: d.custom_endpoint || "",
          notify_received: Boolean(d.notify_received),
          notify_delivered: Boolean(d.notify_delivered),
          notify_approved: Boolean(d.notify_approved),
          notify_low_stock: Boolean(d.notify_low_stock),
          is_active: Boolean(d.is_active),
        });
        setSmsApiKeySet(Boolean(d.api_key_set));
        setSmsAuthTokenSet(Boolean(d.auth_token_set));
      }
    } catch {
      // silently ignore
    } finally {
      setSmsLoading(false);
    }
  };

  const handleSmsSave = async () => {
    if (!smsForm.admin_phone.trim()) {
      return flashSmsMsg(pick("د ادمین د تلیفون شمیره اړینه ده.", "شماره موبایل ادمین الزامی است."), "error");
    }
    setSmsSaving(true);
    try {
      const payload: Record<string, any> = {
        provider: smsForm.provider,
        sender_id: smsForm.sender_id,
        admin_phone: smsForm.admin_phone,
        custom_endpoint: smsForm.custom_endpoint,
        notify_received: smsForm.notify_received,
        notify_delivered: smsForm.notify_delivered,
        notify_approved: smsForm.notify_approved,
        notify_low_stock: smsForm.notify_low_stock,
        is_active: smsForm.is_active,
      };
      if (smsForm.api_key.trim()) payload.api_key = smsForm.api_key.trim();
      if (smsForm.auth_token.trim()) payload.auth_token = smsForm.auth_token.trim();

      const res = await fetch("/api/sms/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        flashSmsMsg(pick("د SMS تنظیمات خوندي شول.", "تنظیمات SMS ذخیره شد."), "success");
        await loadSmsConfig();
      } else {
        flashSmsMsg(data.message || pick("خطا", "خطا"), "error");
      }
    } catch {
      flashSmsMsg(pick("د سرور سره اتصال ونشو.", "اتصال به سرور ناموفق بود."), "error");
    } finally {
      setSmsSaving(false);
    }
  };

  const handleSmsTest = async () => {
    setSmsTesting(true);
    setSmsMsg(null);
    try {
      const res = await fetch("/api/sms/config/test", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        flashSmsMsg(
          pick(`SMS ازموینه بریالۍ شوه! SID: ${data.sid || "OK"}`, `آزمایش SMS موفق بود! SID: ${data.sid || "OK"}`),
          "success"
        );
      } else {
        const errMap: Record<string, string> = {
          SMS_NOT_CONFIGURED: pick("SMS تنظیم نه دی.", "SMS تنظیم نشده."),
          API_KEY_MISSING: pick("API کیلي ورکړل شوې نه ده.", "کلید API وارد نشده."),
          NO_ADMIN_PHONE: pick("د ادمین شمیره نشته.", "شماره ادمین وارد نشده."),
          TWILIO_CREDENTIALS_MISSING: pick("د Twilio اسناد ناقص دي.", "اطلاعات Twilio ناقص است."),
          SMS_INACTIVE: pick("SMS غیرفعال دی. فعال کول لازم دي.", "SMS غیرفعال است. فعال‌سازی لازم است."),
        };
        flashSmsMsg(errMap[data.code] || data.message || pick("ازموینه ناکام شوه.", "آزمایش ناموفق بود."), "error");
      }
    } catch {
      flashSmsMsg(pick("د سرور سره اتصال ونشو.", "اتصال به سرور ناموفق بود."), "error");
    } finally {
      setSmsTesting(false);
    }
  };

  const loadEmailConfigs = async () => {
    try {
      const res = await fetch("/api/email-config");
      const data = await res.json();
      if (data.success) setEmailConfigs(data.data);
    } catch {
      // silently ignore
    }
  };

  const loadCustomRoles = useCallback(async () => {
    setCustomRolesLoading(true);
    try {
      const res = await fetch("/api/custom-roles");
      const data = await res.json();
      if (data.success) setCustomRoles(data.data);
    } catch {
      // silently ignore
    } finally {
      setCustomRolesLoading(false);
    }
  }, []);

  const flashRoleMsg = (text: string, type: "success" | "error") => {
    setRoleMsg({ text, type });
    setTimeout(() => setRoleMsg(null), 4000);
  };

  const openAddRole = () => {
    setEditingRole(null);
    setRoleForm({ name: "", name_ps: "", name_dr: "", permissions: [] });
    setShowRoleModal(true);
  };

  const openEditRole = (role: CustomRole) => {
    setEditingRole(role);
    setRoleForm({ name: role.name, name_ps: role.name_ps, name_dr: role.name_dr, permissions: [...role.permissions] });
    setShowRoleModal(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.name.trim() || !roleForm.name_ps.trim()) {
      return flashRoleMsg(pick("نوم اړین دی", "نام الزامی است"), "error");
    }
    setRoleSaving(true);
    try {
      let res: Response;
      if (editingRole) {
        res = await fetch(`/api/custom-roles/${editingRole.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roleForm),
        });
      } else {
        res = await fetch("/api/custom-roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roleForm),
        });
      }
      const data = await res.json();
      if (data.success) {
        flashRoleMsg(
          editingRole ? pick("رول تازه شو.", "نقش بروزرسانی شد.") : pick("رول اضافه شو.", "نقش اضافه شد."),
          "success"
        );
        setShowRoleModal(false);
        loadCustomRoles();
      } else {
        flashRoleMsg(data.message || pick("ستونزه پیښه شوه.", "خطا رخ داد."), "error");
      }
    } catch {
      flashRoleMsg(pick("د سرور سره اتصال نشو.", "اتصال به سرور برقرار نشد."), "error");
    } finally {
      setRoleSaving(false);
    }
  };

  const handleDeleteRole = async (id: number) => {
    setDeletingRoleId(id);
    try {
      const res = await fetch(`/api/custom-roles/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        flashRoleMsg(pick("رول ړنګ شو.", "نقش حذف شد."), "success");
        setConfirmDeleteRole(null);
        loadCustomRoles();
      } else {
        flashRoleMsg(data.message || pick("ستونزه پیښه شوه.", "خطا رخ داد."), "error");
      }
    } catch {
      flashRoleMsg(pick("د سرور سره اتصال نشو.", "اتصال به سرور برقرار نشد."), "error");
    } finally {
      setDeletingRoleId(null);
    }
  };

  const togglePermission = (perm: string) => {
    setRoleForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm],
    }));
  };

  useEffect(() => {
    loadEmailConfigs();
    loadCustomRoles();
    loadSmsConfig();
  }, [loadCustomRoles]);

  const flashEmailMsg = (text: string, type: "success" | "error") => {
    setEmailMsg({ text, type });
    setTimeout(() => setEmailMsg(null), 4000);
  };

  const handleEmailSubmit = async () => {
    if (!emailForm.email.trim()) {
      return flashEmailMsg(pick("ایمیل خالي دی.", "ایمیل خالی است."), "error");
    }
    if (!emailForm.email.includes("@")) {
      return flashEmailMsg(pick("ایمیل سمه نه ده.", "ایمیل معتبر نیست."), "error");
    }
    // Strip spaces — Google shows App Passwords as "xxxx xxxx xxxx xxxx"
    const cleanedPass = emailForm.app_password.replace(/\s/g, "");
    if (!editingId && cleanedPass.length !== 16) {
      return flashEmailMsg(
        pick("د اپ پاسورډ باید دقیقاً ۱۶ حروف وي (د فضا پرته).", "رمز برنامه باید دقیقاً ۱۶ کاراکتر باشد (بدون فاصله)."),
        "error"
      );
    }
    if (editingId && cleanedPass !== "" && cleanedPass.length !== 16) {
      return flashEmailMsg(
        pick("د اپ پاسورډ باید دقیقاً ۱۶ حروف وي (د فضا پرته).", "رمز برنامه باید دقیقاً ۱۶ کاراکتر باشد (بدون فاصله)."),
        "error"
      );
    }

    setEmailLoading(true);
    try {
      const payload = { ...emailForm, app_password: cleanedPass };
      let res: Response;
      if (editingId) {
        res = await fetch(`/api/email-config/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/email-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (data.success) {
        flashEmailMsg(
          editingId
            ? pick("ایمیل تنظیمات تازه شو.", "تنظیمات ایمیل بروزرسانی شد.")
            : pick("ایمیل د بریالیتوب سره خوندي شو.", "ایمیل با موفقیت ذخیره شد."),
          "success"
        );
        setEmailForm(emptyForm);
        setEditingId(null);
        setShowForm(false);
        await loadEmailConfigs();
      } else {
        flashEmailMsg(data.message || pick("ستونزه پیښه شوه.", "خطا رخ داد."), "error");
      }
    } catch {
      flashEmailMsg(pick("د سرور سره اتصال نشو.", "اتصال به سرور برقرار نشد."), "error");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleEdit = (config: EmailConfig) => {
    setEditingId(config.id);
    setEmailForm({ email: config.email, app_password: "", label: config.label });
    setShowForm(true);
    setEmailMsg(null);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/email-config/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        flashEmailMsg(pick("ایمیل ړنګ شو.", "ایمیل حذف شد."), "success");
        await loadEmailConfigs();
      } else {
        flashEmailMsg(data.message || pick("ستونزه پیښه شوه.", "خطا رخ داد."), "error");
      }
    } catch {
      flashEmailMsg(pick("د سرور سره اتصال نشو.", "اتصال به سرور برقرار نشد."), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      const res = await fetch(`/api/email-config/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        flashEmailMsg(pick("✅ د ازموینې ایمیل بریالیتوب سره ولیږل شو! خپل inbox وګورئ.", "✅ ایمیل آزمایشی با موفقیت ارسال شد! صندوق ورودی را بررسی کنید."), "success");
      } else if (data.code === "GMAIL_BAD_CREDENTIALS" || (data.message || "").includes("GMAIL_BAD_CREDENTIALS")) {
        flashEmailMsg(
          pick(
            "❌ د Gmail اپ پاسورډ غلط دی — د عادي پاسورډ پر ځای باید د Gmail اپ پاسورډ (App Password) وکاروئ. myaccount.google.com/apppasswords ته لاړ شئ.",
            "❌ رمز برنامه Gmail نادرست است — به جای رمز عادی، باید App Password استفاده کنید. به myaccount.google.com/apppasswords بروید."
          ),
          "error"
        );
      } else {
        flashEmailMsg(pick("❌ ازموینه ناکامه شوه: ", "❌ آزمایش ناموفق: ") + (data.message || ""), "error");
      }
    } catch {
      flashEmailMsg(pick("د سرور سره اتصال نشو.", "اتصال به سرور برقرار نشد."), "error");
    } finally {
      setTestingId(null);
    }
  };

  const cancelForm = () => {
    setEmailForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setEmailMsg(null);
  };

  const save = async () => {
    const dates = getCurrentHijriDates();
    // Save to localStorage (legacy/fallback)
    setLocalItem("request_limits", { dailyLimit, updatedAtHijriShamsi: dates.shamsi, updatedAtHijriQamari: dates.qamari });
    // Save to backend (enforced)
    try {
      await fetch("/api/settings/request-limit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: dailyLimit }),
      });
    } catch { /* backend may be down — localStorage is fallback */ }
    setMessage(pick(
      "د ورځني غوښتنو حد خوندي شو. اوس د سیستم له لوري پلي کیږي.",
      "محدودیت درخواست‌های روزانه ذخیره و اجرا شد."
    ));
  };

  return (
    <>
      <PageMeta title={pick("تنظیمات", "تنظیمات")} description={pick("د سیستم تنظیمات", "تنظیمات سیستم")} />
      <Breadcrumb pageTitle={pick("تنظیمات", "تنظیمات")} />
      <div className="space-y-6 page-enter" dir="rtl">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-slide-up" style={{ animationDelay: "0ms" }}>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white/90">
            {pick("د سوپر اډمین تنظیمات", "تنظیمات سوپر ادمین")}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {pick(
              "د غوښتنو حد، صلاحیتونه، بیکپ، امنیتي یادښتونه او د فایربیس اتصال معلومات.",
              "محدودیت درخواست‌ها، دسترسی‌ها، پشتیبان‌گیری، یادداشت‌های امنیتی و اطلاعات اتصال Firebase."
            )}
          </p>
        </div>

        {/* Language Switcher */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-slide-up card-interactive" style={{ animationDelay: "80ms" }}>
          <h2 className="mb-4 text-lg font-bold text-gray-800 dark:text-white/90">
            {pick("د سیستم ژبه", "زبان سیستم")}
          </h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {pick(
              "هغه ژبه وټاکئ چې د ټول سیستم لپاره وکارول شي.",
              "زبانی را انتخاب کنید که برای کل سیستم استفاده شود."
            )}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setLang("ps")}
              className={`flex-1 rounded-xl border-2 py-3 px-4 text-sm font-bold transition-all ${
                lang === "ps"
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-600"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              <div className="text-base mb-1">🇦🇫</div>
              <div>پښتو</div>
              <div className="text-xs font-normal mt-0.5 opacity-70">پښتو</div>
            </button>
            <button
              onClick={() => setLang("dr")}
              className={`flex-1 rounded-xl border-2 py-3 px-4 text-sm font-bold transition-all ${
                lang === "dr"
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-600"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              <div className="text-base mb-1">🇦🇫</div>
              <div>دری</div>
              <div className="text-xs font-normal mt-0.5 opacity-70">دری</div>
            </button>
          </div>
          <p className="mt-3 text-xs text-green-600 dark:text-green-400 font-medium">
            {lang === "ps"
              ? "✓ اوس سیستم پښتو ژبه کاروي"
              : "✓ اکنون سیستم زبان دری را استفاده می‌کند"}
          </p>
        </div>

        {/* ─── Calendar Type Switcher ─── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-slide-up card-interactive" style={{ animationDelay: "90ms" }}>
          <h2 className="mb-4 text-lg font-bold text-gray-800 dark:text-white/90">
            {pick("د تاریخ ډول", "نوع تقویم")}
          </h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {pick(
              "هغه تاریخ ډول وټاکئ چې د ټول سیستم لپاره وکارول شي — ټولو ځایونو کې، چارټونو کې او جدولونو کې.",
              "نوع تقویمی را انتخاب کنید که در کل سیستم استفاده شود — در همه جا، نمودارها و جداول."
            )}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setCalendarType("shamsi")}
              className={`flex-1 rounded-xl border-2 py-3 px-4 text-sm font-bold transition-all ${
                calendarType === "shamsi"
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-600"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              <div className="text-base mb-1">🌙</div>
              <div>شمسي</div>
              <div className="text-xs font-normal mt-0.5 opacity-70">Shamsi</div>
            </button>
            <button
              onClick={() => setCalendarType("qamari")}
              className={`flex-1 rounded-xl border-2 py-3 px-4 text-sm font-bold transition-all ${
                calendarType === "qamari"
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-600"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              <div className="text-base mb-1">☪️</div>
              <div>قمري</div>
              <div className="text-xs font-normal mt-0.5 opacity-70">Qamari</div>
            </button>
            <button
              onClick={() => setCalendarType("miladi")}
              className={`flex-1 rounded-xl border-2 py-3 px-4 text-sm font-bold transition-all ${
                calendarType === "miladi"
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-600"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              <div className="text-base mb-1">📅</div>
              <div>میلادي</div>
              <div className="text-xs font-normal mt-0.5 opacity-70">Miladi</div>
            </button>
          </div>
          <p className="mt-3 text-xs text-green-600 dark:text-green-400 font-medium">
            {calendarType === "shamsi"
              ? pick("✓ اوس سیستم شمسي (هجري شمسي) تاریخ کاروي", "✓ اکنون سیستم از تقویم شمسی (هجری شمسی) استفاده می‌کند")
              : calendarType === "qamari"
              ? pick("✓ اوس سیستم قمري (هجري قمري) تاریخ کاروي", "✓ اکنون سیستم از تقویم قمری (هجری قمری) استفاده می‌کند")
              : pick("✓ اوس سیستم میلادي (ګریګوري) تاریخ کاروي", "✓ اکنون سیستم از تقویم میلادی (گریگوری) استفاده می‌کند")}
          </p>
        </div>

        {/* ─── Change Password Section ─── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-slide-up card-interactive" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between mb-5">
            <span className="text-2xl">🔑</span>
            <div className="text-right">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">
                {pick("د پاسورډ بدلول", "تغییر رمز عبور")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {pick(
                  `اوسنی حساب: ${profile?.email || ""}`,
                  `حساب فعلی: ${profile?.email || ""}`
                )}
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm mr-auto">
            {/* Current Password */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-600 dark:text-gray-400">
                {pick("اوسنی پاسورډ", "رمز فعلی")} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={cpShowCurrent ? "text" : "password"}
                  value={cpForm.current}
                  onChange={e => { setCpForm(f => ({ ...f, current: e.target.value })); setCpMsg(null); }}
                  placeholder={pick("اوسنی پاسورډ ولیکئ", "رمز فعلی را وارد کنید")}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-400 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setCpShowCurrent(v => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                >
                  {cpShowCurrent ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-600 dark:text-gray-400">
                {pick("نوی پاسورډ", "رمز جدید")} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={cpShowNew ? "text" : "password"}
                  value={cpForm.newPass}
                  onChange={e => { setCpForm(f => ({ ...f, newPass: e.target.value })); setCpMsg(null); }}
                  placeholder={pick("نوی پاسورډ (لږ تر لږه ۸ توري)", "رمز جدید (حداقل ۸ کاراکتر)")}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-400 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setCpShowNew(v => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                >
                  {cpShowNew ? "🙈" : "👁️"}
                </button>
              </div>
              {cpForm.newPass.length > 0 && (() => {
                const errs = checkPasswordStrength(cpForm.newPass);
                const score = 4 - errs.length;
                const bars = [
                  score >= 1 ? "bg-red-400" : "bg-gray-200 dark:bg-gray-700",
                  score >= 2 ? "bg-orange-400" : "bg-gray-200 dark:bg-gray-700",
                  score >= 3 ? "bg-yellow-400" : "bg-gray-200 dark:bg-gray-700",
                  score >= 4 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700",
                ];
                const lbl = score === 4 ? { t: pick("قوي ✓","قوی ✓"), c: "text-green-600 dark:text-green-400" }
                          : score === 3 ? { t: pick("منځني","متوسط"),  c: "text-yellow-600 dark:text-yellow-400" }
                          : score === 2 ? { t: pick("کمزوری","ضعیف"),  c: "text-orange-600 dark:text-orange-400" }
                          :               { t: pick("ضعیف","خیلی ضعیف"), c: "text-red-600 dark:text-red-400" };
                return (
                  <div className="mt-2 space-y-1.5" dir="rtl">
                    <div className="flex items-center gap-1.5">
                      {bars.map((cls, i) => <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${cls}`} />)}
                      <span className={`text-xs font-semibold mr-1 ${lbl.c}`}>{lbl.t}</span>
                    </div>
                    {errs.length > 0 && (
                      <ul className="space-y-0.5">
                        {errs.map((er, i) => <li key={i} className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400"><span>✗</span>{er}</li>)}
                      </ul>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-600 dark:text-gray-400">
                {pick("پاسورډ تایید کړئ", "تأیید رمز جدید")} <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={cpForm.confirm}
                onChange={e => { setCpForm(f => ({ ...f, confirm: e.target.value })); setCpMsg(null); }}
                placeholder={pick("پاسورډ بیا ولیکئ", "رمز جدید را دوباره وارد کنید")}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 bg-white dark:bg-gray-900 transition-colors ${
                  cpForm.confirm && cpForm.newPass !== cpForm.confirm
                    ? "border-red-300 focus:ring-red-300 dark:border-red-700"
                    : cpForm.confirm && cpForm.newPass === cpForm.confirm
                    ? "border-green-300 focus:ring-green-300 dark:border-green-700"
                    : "border-gray-200 dark:border-gray-700 focus:ring-brand-400"
                }`}
                autoComplete="new-password"
              />
              {cpForm.confirm && cpForm.newPass !== cpForm.confirm && (
                <p className="mt-1 text-xs text-red-500">{pick("پاسورډونه سره برابر نه دي", "رمزها با هم مطابقت ندارند")}</p>
              )}
            </div>

            {/* Message */}
            {cpMsg && (
              <div className={`rounded-xl p-3 text-sm font-medium border ${cpMsg.ok
                ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
              }`}>
                {cpMsg.text}
              </div>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={cpLoading || !cpForm.current || !cpForm.newPass || !cpForm.confirm}
              className="w-full sm:w-auto"
            >
              {cpLoading
                ? pick("خوندي کیږي...", "در حال ذخیره...")
                : pick("پاسورډ خوندي کړئ", "ذخیره رمز")}
            </Button>
          </form>
        </div>

        {/* Font Size Setting — Super Admin only */}
        {isSuperAdmin && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-slide-up card-interactive" style={{ animationDelay: "120ms" }}>
            <h2 className="mb-4 text-lg font-bold text-gray-800 dark:text-white/90">
              {pick("د متن اندازه", "اندازه متن")}
            </h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              {pick(
                "د ټول سیستم د متن اندازه وټاکئ. دغه بدلون سمدستي پلي کیږي.",
                "اندازه متن کل سیستم را انتخاب کنید. این تغییر فوری اعمال می‌شود."
              )}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FONT_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => applyFontSize(opt.key)}
                  className={`rounded-xl border-2 py-3 px-4 text-center transition-all ${
                    fontSize === opt.key
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-600"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
                  }`}
                >
                  <div className="font-bold" style={{ fontSize: opt.px }}>
                    {pick(opt.label_ps, opt.label_dr)}
                  </div>
                  <div className="text-xs mt-1 opacity-60">{opt.px}</div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-green-600 dark:text-green-400 font-medium">
              {pick(
                `✓ اوس د متن اندازه "${FONT_SIZE_OPTIONS.find(o => o.key === fontSize)?.[lang === "ps" ? "label_ps" : "label_dr"] ?? fontSize}" ده`,
                `✓ اندازه متن فعلی "${FONT_SIZE_OPTIONS.find(o => o.key === fontSize)?.[lang === "ps" ? "label_ps" : "label_dr"] ?? fontSize}" است`
              )}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-slide-up card-interactive" style={{ animationDelay: "160ms" }}>
            <h2 className="mb-4 text-lg font-bold">
              {pick("د ورځني غوښتنو حد", "محدودیت درخواست‌های روزانه")}
            </h2>
            <label className="mb-2 block text-sm font-semibold">
              {pick(
                "هر غوښتونکی په ورځ کې څو غوښتنې ثبتولای شي؟",
                "هر درخواست‌کننده در روز چند درخواست می‌تواند ثبت کند؟"
              )}
            </label>
            <select className="w-full rounded-lg border p-3 text-right" value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))}>
              {limitOptions.map((limit) => (
                <option key={limit} value={limit}>
                  {limit === 0
                    ? pick("نن هېڅوک غوښتنه نه شي ثبتولای", "امروز هیچ‌کس نمی‌تواند درخواست ثبت کند")
                    : pick(`${limit} غوښتنې`, `${limit} درخواست`)}
                </option>
              ))}
              <option value={50}>{pick("۵۰ غوښتنې", "۵۰ درخواست")}</option>
            </select>
            <Button className="mt-4" onClick={save}>
              {pick("حد خوندي کول", "ذخیره محدودیت")}
            </Button>
            {message && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-slide-up card-interactive" style={{ animationDelay: "220ms" }}>
            <h2 className="mb-4 text-lg font-bold">
              {pick("د فایربیس اتصال طریقه", "روش اتصال Firebase")}
            </h2>
            <ol className="list-decimal space-y-2 pr-5 text-sm leading-7 text-gray-600 dark:text-gray-400">
              <li>{pick("د پروژې په اصلي فولډر کې", "در پوشه اصلی پروژه")} <code>.env.local</code> {pick("فایل جوړ کړئ.", "فایل بسازید.")}</li>
              <li>{pick("د Firebase Console د Project settings له Web app څخه SDK config واخلئ.", "از Firebase Console → Project settings → Web app تنظیمات SDK را بگیرید.")}</li>
              <li>{pick("هماغه values د", "همان values را به شکل")} <code>.env.example</code> {pick("په بڼه کې واچوئ.", "وارد کنید.")}</li>
              <li>{pick("وروسته", "سپس")} <code>npm run dev</code> {pick("بیا چالان کړئ.", "را دوباره اجرا کنید.")}</li>
            </ol>
            <p className="mt-4 rounded-lg bg-orange-50 p-3 text-sm text-orange-700">
              {pick(
                "محرمانه کلیدونه، GitHub token او پاسورډونه په frontend کې مه ساتئ.",
                "کلیدهای محرمانه، GitHub token و رمزها را در frontend نگه ندارید."
              )}
            </p>
          </div>
        </div>

        {/* ─── Permissions Management Section ─── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-slide-up" style={{ animationDelay: "260ms" }}>
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={openAddRole}
              className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              <span className="text-base leading-none">+</span>
              {pick("نوی رول", "نقش جدید")}
            </button>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <div className="text-right">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">
                  {pick("د صلاحیتونو مدیریت", "مدیریت صلاحیت‌ها")}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {pick("د هر رول لپاره د لاسرسي سطح او اجازه‌ناوې", "سطح دسترسی و مجوزها برای هر نقش")}
                </p>
              </div>
            </div>
          </div>

          {/* Feedback message */}
          {roleMsg && (
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
              roleMsg.type === "success"
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            }`}>
              {roleMsg.type === "success" ? "✓ " : "✗ "}{roleMsg.text}
            </div>
          )}

          {/* System roles matrix */}
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 text-right">
            {pick("د سیستم رولونه (لوستلو وړ)", "نقش‌های سیستم (فقط نمایش)")}
          </p>
          <div className="space-y-3 mb-6">
            {(Object.values(ROLES) as string[]).map((role) => {
              const perms = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [];
              const roleColors: Record<string, string> = {
                [ROLES.SUPER_ADMIN]: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/40",
                [ROLES.ADMIN]: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800/40",
                [ROLES.PROCUREMENT_DIRECTOR]: "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/40",
                [ROLES.WAREHOUSE_DIRECTOR]: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/40",
                [ROLES.WAREHOUSE_ENTRY_PERSON]: "bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800/40",
                [ROLES.REQUESTER]: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/40",
                [ROLES.REQUEST_CONFIRMER]: "bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800/40",
              };
              const badgeColors: Record<string, string> = {
                [ROLES.SUPER_ADMIN]: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
                [ROLES.ADMIN]: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
                [ROLES.PROCUREMENT_DIRECTOR]: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
                [ROLES.WAREHOUSE_DIRECTOR]: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                [ROLES.WAREHOUSE_ENTRY_PERSON]: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
                [ROLES.REQUESTER]: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
                [ROLES.REQUEST_CONFIRMER]: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
              };
              const roleNamePs: Record<string, string> = {
                [ROLES.SUPER_ADMIN]: "سوپر اډمین",
                [ROLES.ADMIN]: "اډمین",
                [ROLES.PROCUREMENT_DIRECTOR]: "د تدارکاتو مدیر",
                [ROLES.WAREHOUSE_DIRECTOR]: "د ګدام مدیر",
                [ROLES.WAREHOUSE_ENTRY_PERSON]: "د ګدام داخلوونکی",
                [ROLES.REQUESTER]: "غوښتونکی",
                [ROLES.REQUEST_CONFIRMER]: "د غوښتنې تاییدوونکی",
              };
              return (
                <div key={role} className={`rounded-xl border p-4 ${roleColors[role] || "bg-gray-50 border-gray-200"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-semibold opacity-60 bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full">{perms.length} {pick("اجازه","مجوز")}</span>
                    <div className="text-right">
                      <p className="font-bold text-sm text-gray-800 dark:text-white">{roleNamePs[role] || role}</p>
                      <p className="text-xs text-gray-400 font-normal mt-0.5">{role}</p>
                    </div>
                  </div>
                  {perms.length === 0 ? (
                    <p className="text-xs opacity-50 text-center mt-2">{pick("هیڅ ځانګړي اجازه نشته","هیچ مجوز خاصی ندارد")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 justify-end mt-2">
                      {perms.map((perm) => (
                        <span key={perm} className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColors[role] || "bg-gray-100 text-gray-600"}`}>
                          {PERM_LABEL_PS[perm] || perm}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom Roles section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 text-right">
              {pick("ځانګړي رولونه (د سمون او ړنګولو وړ)", "نقش‌های سفارشی (قابل ویرایش و حذف)")}
            </p>

            {customRolesLoading ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
              </div>
            ) : customRoles.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-8 text-center">
                <div className="text-2xl mb-2">🔐</div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {pick("هیڅ ځانګړی رول نشته. د «نوی رول» تڼۍ فشار کړئ.", "هیچ نقش سفارشی موجود نیست. دکمه «نقش جدید» را بزنید.")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {customRoles.map((role) => (
                  <div key={role.id} className="rounded-xl border border-indigo-200 bg-indigo-50 dark:border-indigo-800/40 dark:bg-indigo-900/20 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmDeleteRole(role)}
                          disabled={deletingRoleId === role.id}
                          className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400 disabled:opacity-50 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {pick("حذف کول", "حذف")}
                        </button>
                        <button
                          onClick={() => openEditRole(role)}
                          className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {pick("سمون", "ویرایش")}
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-indigo-800 dark:text-indigo-200">{role.name_ps || role.name}</p>
                        {role.name_dr && <p className="text-xs text-indigo-500 dark:text-indigo-400">{role.name_dr}</p>}
                        <p className="text-xs text-gray-400 font-mono">{role.name}</p>
                      </div>
                    </div>
                    {role.permissions.length === 0 ? (
                      <p className="text-xs text-indigo-400 text-center mt-2">{pick("هیڅ اجازه ندارد","هیچ مجوزی ندارد")}</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 justify-end mt-2">
                        {role.permissions.map((perm) => (
                          <span key={perm} className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-medium">
                            {PERM_LABEL_PS[perm] || perm}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Custom Role Modal ─── */}
        {showRoleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRoleModal(false)} />
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-lg w-full animate-scale-in max-h-[90vh] overflow-y-auto" dir="rtl">
              <div className="flex items-center justify-between mb-5">
                <button onClick={() => setShowRoleModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                <h3 className="font-bold text-gray-800 dark:text-white text-base">
                  {editingRole ? `✏️ ${pick("رول سمول","ویرایش نقش")}` : `➕ ${pick("نوی رول","نقش جدید")}`}
                </h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{pick("د رول نوم (سیستمي) *","نام سیستمی نقش *")}</label>
                  <input
                    value={roleForm.name} onChange={e => setRoleForm(f => ({...f, name: e.target.value}))}
                    placeholder="e.g. Department Head"
                    dir="ltr"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-left text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{pick("د رول نوم (پښتو) *","نام نقش (پشتو) *")}</label>
                  <input
                    value={roleForm.name_ps} onChange={e => setRoleForm(f => ({...f, name_ps: e.target.value}))}
                    placeholder="د پوهنځي مشر"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{pick("د رول نوم (دري)","نام نقش (دری)")}</label>
                  <input
                    value={roleForm.name_dr} onChange={e => setRoleForm(f => ({...f, name_dr: e.target.value}))}
                    placeholder="رئیس دانشکده"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-right text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">{pick("اجازه‌ناوې","مجوزها")} ({roleForm.permissions.length} {pick("ټاکل شوي","انتخاب‌شده")})</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-800/50">
                    {ALL_PERMISSIONS.map(([, permValue]) => (
                      <label key={permValue} className="flex items-center gap-2 cursor-pointer group justify-end">
                        <span className="text-xs text-gray-700 dark:text-gray-300 text-right">{PERM_LABEL_PS[permValue] || permValue}</span>
                        <input
                          type="checkbox"
                          checked={roleForm.permissions.includes(permValue)}
                          onChange={() => togglePermission(permValue)}
                          className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 flex-shrink-0"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowRoleModal(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">
                  {pick("لغوه","لغو")}
                </button>
                <button onClick={handleSaveRole} disabled={roleSaving} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-bold transition-all">
                  {roleSaving ? "..." : pick("ذخیره","ذخیره")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Confirm Delete Role Dialog ─── */}
        {confirmDeleteRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteRole(null)} />
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full" dir="rtl">
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">⚠️</div>
                <p className="font-semibold text-gray-800 dark:text-white">{pick("ایا مطمئن یاست؟","آیا مطمئن هستید؟")}</p>
                <p className="text-sm text-gray-500 mt-1">«{confirmDeleteRole.name_ps || confirmDeleteRole.name}»</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteRole(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">
                  {pick("لغوه","لغو")}
                </button>
                <button
                  onClick={() => handleDeleteRole(confirmDeleteRole.id)}
                  disabled={deletingRoleId === confirmDeleteRole.id}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-bold transition-all disabled:opacity-60"
                >
                  {deletingRoleId === confirmDeleteRole.id ? "..." : pick("حذف کول","حذف")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Email Configuration Section ─── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] animate-slide-up" style={{ animationDelay: "280ms" }}>
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white/90 flex items-center gap-2">
                <span className="text-xl">📧</span>
                {pick("د ایمیل تنظیمات", "تنظیمات ایمیل")}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {pick(
                  "د Gmail اپ پاسورډ سره د لیږلو ایمیل تنظیم کړئ. هر ایمیل ادرس باید ۱۶ حروفه اپ پاسورډ ولري.",
                  "ایمیل ارسال را با رمز برنامه Gmail تنظیم کنید. هر آدرس ایمیل باید یک رمز برنامه ۱۶ کاراکتری داشته باشد."
                )}
              </p>
            </div>
            {!showForm && (
              <button
                onClick={() => { setShowForm(true); setEditingId(null); setEmailForm(emptyForm); setEmailMsg(null); }}
                className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors whitespace-nowrap"
              >
                <span className="text-base leading-none">+</span>
                {pick("نوی ایمیل", "ایمیل جدید")}
              </button>
            )}
          </div>

          {/* Add / Edit Form */}
          {showForm && (
            <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/40 p-5 dark:border-brand-800/40 dark:bg-brand-900/10">
              <h3 className="mb-4 text-sm font-bold text-gray-700 dark:text-white/80">
                {editingId
                  ? pick("د ایمیل سمول", "ویرایش ایمیل")
                  : pick("نوی ایمیل اضافه کول", "افزودن ایمیل جدید")}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Email */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {pick("ایمیل ادرس *", "آدرس ایمیل *")}
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    value={emailForm.email}
                    onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                    placeholder="example@gmail.com"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-left placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-white/5 dark:text-white dark:placeholder-gray-500"
                  />
                </div>
                {/* Label */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {pick("نوم / لیبل (اختیاري)", "نام / برچسب (اختیاری)")}
                  </label>
                  <input
                    type="text"
                    value={emailForm.label}
                    onChange={(e) => setEmailForm({ ...emailForm, label: e.target.value })}
                    placeholder={pick("لکه: د اطلاعاتو ایمیل", "مثلاً: ایمیل اطلاع‌رسانی")}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-white/5 dark:text-white dark:placeholder-gray-500"
                  />
                </div>
                {/* App Password */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {editingId
                      ? pick("د اپ پاسورډ (که بدلول غواړئ ۱۶ حروف ولیکئ، که نه خالي پریږدئ)", "رمز برنامه (اگر می‌خواهید تغییر دهید ۱۶ کاراکتر وارد کنید، وگرنه خالی بگذارید)")
                      : pick("د اپ پاسورډ — دقیقاً ۱۶ حروف *", "رمز برنامه — دقیقاً ۱۶ کاراکتر *")}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      dir="ltr"
                      value={emailForm.app_password}
                      onChange={(e) => setEmailForm({ ...emailForm, app_password: e.target.value })}
                      maxLength={19}
                      placeholder="xxxx xxxx xxxx xxxx"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-left tracking-widest placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-white/5 dark:text-white dark:placeholder-gray-500"
                    />
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono ${
                      emailForm.app_password.replace(/\s/g, "").length === 16
                        ? "text-green-500"
                        : emailForm.app_password.replace(/\s/g, "").length > 0
                        ? "text-orange-500"
                        : "text-gray-400"
                    }`}>
                      {emailForm.app_password.replace(/\s/g, "").length}/16
                    </span>
                  </div>
                  <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-semibold mb-1">
                      {pick("⚠️ د عادي پاسورډ پر ځای باید د Gmail اپ پاسورډ وکاروئ:", "⚠️ باید از App Password Gmail استفاده کنید، نه رمز عادی:")}
                    </p>
                    <ol className="list-decimal list-inside space-y-0.5 text-amber-700 dark:text-amber-400">
                      <li>{pick("myaccount.google.com ته لاړ شئ", "وارد myaccount.google.com شوید")}</li>
                      <li>{pick("Security → 2-Step Verification (فعال وي)", "Security → 2-Step Verification (باید فعال باشد)")}</li>
                      <li>{pick("App Passwords ته لاړ شئ", "به App Passwords بروید")}</li>
                      <li>{pick("نوی اپ پاسورډ جوړ کړئ (۱۶ حروف)", "یک App Password جدید بسازید (۱۶ کاراکتر)")}</li>
                    </ol>
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1.5 font-semibold underline text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200"
                    >
                      {pick("→ د اپ پاسورډ جوړولو لینک", "→ لینک ساخت App Password")}
                    </a>
                  </div>
                </div>
              </div>
              {/* Form actions */}
              <div className="mt-4 flex items-center gap-3 justify-end">
                <button
                  onClick={cancelForm}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-white/5 transition-colors"
                >
                  {pick("لغو", "انصراف")}
                </button>
                <button
                  onClick={handleEmailSubmit}
                  disabled={emailLoading}
                  className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
                >
                  {emailLoading
                    ? pick("خوندي کیږي...", "در حال ذخیره...")
                    : editingId
                    ? pick("تازه کول", "بروزرسانی")
                    : pick("خوندي کول", "ذخیره")}
                </button>
              </div>
            </div>
          )}

          {/* Feedback message */}
          {emailMsg && (
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
              emailMsg.type === "success"
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            }`}>
              {emailMsg.type === "success" ? "✓ " : "✗ "}{emailMsg.text}
            </div>
          )}

          {/* Email list */}
          {emailConfigs.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-10 text-center">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pick("هیڅ ایمیل تنظیم شوی نه دی.", "هیچ ایمیلی تنظیم نشده است.")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {emailConfigs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3.5 dark:border-gray-700 dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-sm font-bold">
                      @
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white/90 truncate" dir="ltr">
                        {config.email}
                      </p>
                      {config.label && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {config.label}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {pick("د اپ پاسورډ:", "رمز برنامه:")} <span dir="ltr" className="font-mono">••••••••••••••••</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Test button */}
                    <button
                      onClick={() => handleTest(config.id)}
                      disabled={testingId === config.id}
                      className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-600 hover:bg-green-100 dark:border-green-800/40 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30 disabled:opacity-50 transition-colors"
                      title={pick("د ایمیل ازموینه", "آزمایش ایمیل")}
                    >
                      {testingId === config.id ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      )}
                      {pick("ازموینه", "آزمایش")}
                    </button>
                    {/* Edit button */}
                    <button
                      onClick={() => handleEdit(config)}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {pick("سمون", "ویرایش")}
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(config.id)}
                      disabled={deletingId === config.id}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
                    >
                      {deletingId === config.id ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                      {pick("حذف کول", "حذف")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* د SMS تنظیمات */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30 text-lg">📱</span>
            <div>
              <h2 className="text-base font-bold text-gray-800 dark:text-white/90">
                {pick("د SMS خبرتیا تنظیمات", "تنظیمات اطلاع‌رسانی SMS")}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {pick("د موبایل له لارې خبرتیاوې لیږل", "ارسال اعلانات از طریق پیامک")}
              </p>
            </div>
          </div>

          {/* SMS status message */}
          {smsMsg && (
            <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
              smsMsg.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 text-green-800 dark:text-green-300"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300"
            }`}>
              <span>{smsMsg.type === "success" ? "✅" : "❌"}</span>
              <span>{smsMsg.text}</span>
            </div>
          )}

          {smsLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
              <span className="animate-spin">⏳</span>
              <span>{pick("د SMS تنظیمات لوستل...", "در حال بارگذاری تنظیمات SMS...")}</span>
            </div>
          ) : (
            <>
              {/* Active toggle row */}
              <div className="mb-5 flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {pick("SMS خبرتیا فعاله کړئ", "فعال‌سازی اطلاع‌رسانی SMS")}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {smsForm.is_active
                      ? pick("SMS فعال دی — خبرتیاوې لیږل کیږي", "SMS فعال است — اطلاعات ارسال می‌شوند")
                      : pick("SMS غیرفعال دی", "SMS غیرفعال است")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSmsForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    smsForm.is_active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    smsForm.is_active ? (lang === "ps" ? "-translate-x-6" : "translate-x-6") : (lang === "ps" ? "-translate-x-1" : "translate-x-1")
                  }`} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Provider */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {pick("د SMS سرویس چمتو کوونکی", "ارائه‌دهنده سرویس SMS")}
                  </label>
                  <select
                    value={smsForm.provider}
                    onChange={e => setSmsForm(f => ({ ...f, provider: e.target.value as any }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="twilio">Twilio</option>
                    <option value="kavenegar">Kavenegar (کاوه‌نگار)</option>
                    <option value="custom">{pick("ځانګړی API", "API سفارشی")}</option>
                  </select>
                </div>

                {/* Admin Phone */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {pick("د ادمین تلیفون شمیره *", "شماره موبایل ادمین *")}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={smsForm.admin_phone}
                    onChange={e => setSmsForm(f => ({ ...f, admin_phone: e.target.value }))}
                    placeholder="+93XXXXXXXXX"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-400"
                  />
                </div>

                {/* Sender ID */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {pick("د لیږونکي شمیره / Sender ID", "شماره فرستنده / Sender ID")}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={smsForm.sender_id}
                    onChange={e => setSmsForm(f => ({ ...f, sender_id: e.target.value }))}
                    placeholder={smsForm.provider === "kavenegar" ? "10004346" : "+1XXXXXXXXXX"}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-400"
                  />
                </div>

                {/* API Key / Account SID */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {smsForm.provider === "twilio"
                      ? pick("د حساب SID (Account SID)", "شناسه حساب (Account SID)")
                      : pick("د API کیلي", "کلید API")}
                  </label>
                  <input
                    type="password"
                    dir="ltr"
                    value={smsForm.api_key}
                    onChange={e => setSmsForm(f => ({ ...f, api_key: e.target.value }))}
                    placeholder={smsApiKeySet ? pick("(ذخیره شوی — بدلولو لپاره ولیکئ)", "(ذخیره شده — برای تغییر وارد کنید)") : (smsForm.provider === "twilio" ? "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" : "API_KEY")}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-400"
                    autoComplete="new-password"
                  />
                  {smsApiKeySet && !smsForm.api_key && (
                    <p className="mt-1 text-[11px] text-green-600 dark:text-green-400">
                      {pick("✓ API کیلي ذخیره شوې ده", "✓ کلید API ذخیره شده است")}
                    </p>
                  )}
                </div>

                {/* Auth Token (Twilio only) */}
                {smsForm.provider === "twilio" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                      {pick("د تصدیق ټوکن (Auth Token)", "توکن احراز هویت (Auth Token)")}
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={smsForm.auth_token}
                      onChange={e => setSmsForm(f => ({ ...f, auth_token: e.target.value }))}
                      placeholder={smsAuthTokenSet ? pick("(ذخیره شوی — بدلولو لپاره ولیکئ)", "(ذخیره شده — برای تغییر وارد کنید)") : "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-400"
                      autoComplete="new-password"
                    />
                    {smsAuthTokenSet && !smsForm.auth_token && (
                      <p className="mt-1 text-[11px] text-green-600 dark:text-green-400">
                        {pick("✓ Auth Token ذخیره شوی دی", "✓ Auth Token ذخیره شده است")}
                      </p>
                    )}
                  </div>
                )}

                {/* Custom Endpoint */}
                {smsForm.provider === "custom" && (
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                      {pick("ځانګړی API پته (Endpoint URL)", "آدرس API سفارشی (Endpoint URL)")}
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={smsForm.custom_endpoint}
                      onChange={e => setSmsForm(f => ({ ...f, custom_endpoint: e.target.value }))}
                      placeholder="https://api.example.com/v1/sms/send"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-400"
                    />
                  </div>
                )}
              </div>

              {/* Notification types */}
              <div className="mt-5">
                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-3">
                  {pick("د SMS خبرتیاوو ډولونه", "انواع اعلانات SMS")}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {([
                    ["notify_received",  pick("د اجناسو رسید", "دریافت کالا"),    pick("کله چې اجناس ګدام ته رسیږي", "هنگام دریافت کالا")],
                    ["notify_approved",  pick("د غوښتنې تایید", "تأیید درخواست"), pick("کله چې غوښتنه تایید شي", "هنگام تأیید درخواست")],
                    ["notify_delivered", pick("د تسلیمۍ خبر", "اطلاع تحویل"),    pick("کله چې جنس تسلیم شي", "هنگام تحویل کالا")],
                    ["notify_low_stock", pick("د موجودۍ کمښت", "کمبود موجودی"),  pick("کله چې موجودي ټیټه شي", "هنگام کاهش موجودی")],
                  ] as [keyof typeof smsForm, string, string][]).map(([key, title, desc]) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-gray-50 dark:bg-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(smsForm[key])}
                        onChange={e => setSmsForm(f => ({ ...f, [key]: e.target.checked }))}
                        className="h-4 w-4 accent-primary"
                      />
                      <div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{title}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSmsSave}
                  disabled={smsSaving}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {smsSaving ? <span className="animate-spin">⏳</span> : <span>💾</span>}
                  {smsSaving
                    ? pick("خوندي کیږي...", "در حال ذخیره...")
                    : pick("د SMS تنظیمات خوندي کول", "ذخیره تنظیمات SMS")}
                </button>

                <button
                  type="button"
                  onClick={handleSmsTest}
                  disabled={smsTesting || !smsForm.is_active}
                  title={!smsForm.is_active ? pick("لومړی SMS فعال کړئ", "ابتدا SMS را فعال کنید") : ""}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {smsTesting ? <span className="animate-spin">📡</span> : <span>📱</span>}
                  {smsTesting
                    ? pick("SMS لیږل کیږي...", "در حال ارسال SMS...")
                    : pick("د SMS ازموینه", "آزمایش SMS")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
