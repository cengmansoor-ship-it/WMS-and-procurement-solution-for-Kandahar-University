import { useState } from "react";
import { useNavigate } from "react-router";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import { login } from "../../firebase/auth";
import { isFirebaseConfigured } from "../../firebase/firebase";
import { DEMO_SEED_USERS, getDemoUsers, getLocalItem, setLocalItem } from "../../firebase/localStore";
import { ROLES } from "../../constants/roles";

const DEMO_AUTH_KEY = "kandahar_wms_demo_auth_user";
const DEMO_LOGGED_OUT_KEY = "kandahar_wms_user_logged_out";

async function tryDelegateLogin(email: string, password: string): Promise<{
  name: string; email: string; role: string; uid: string;
} | null> {
  try {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";
    const res = await fetch(`${apiBase}/delegations/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (json.success && json.data) return json.data;
    return null;
  } catch {
    return null;
  }
}

type OtpStep = "email" | "otp" | "newpass";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function apiSendOtp(email: string): Promise<{ success: boolean; code?: string; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch {
    return { success: false, code: "NETWORK_ERROR", message: "د شبکې ستونزه." };
  }
}

async function apiVerifyOtp(email: string, otp: string): Promise<{ success: boolean; code?: string; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    return await res.json();
  } catch {
    return { success: false, code: "NETWORK_ERROR", message: "د شبکې ستونزه." };
  }
}

async function apiResetPassword(email: string, otp: string, newPassword: string): Promise<{ success: boolean; code?: string; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, newPassword }),
    });
    return await res.json();
  } catch {
    return { success: false, code: "NETWORK_ERROR", message: "د شبکې ستونزه." };
  }
}

function friendlySmtpError(code?: string): string {
  if (code === "SMTP_NOT_CONFIGURED")
    return "د ایمیل سرور کنفیګ نه دی. مهرباني وکړئ لومړی د تنظیماتو کې د ایمیل اپ پاسورډ ولیکئ.";
  if (code === "GMAIL_BAD_CREDENTIALS")
    return "د ایمیل اپ پاسورډ ناسم دی. مهرباني وکړئ د تنظیماتو کې اپ پاسورډ بیا وچیک کړئ.";
  if (code === "TOO_MANY_REQUESTS")
    return "ډیرې غوښتنې. ۱۰ دقیقې وروسته بیا هڅه وکړئ.";
  if (code === "USER_NOT_FOUND")
    return "دا ایمیل پته د سیستم کې نه موندل کیږي. مهرباني وکړئ د سیستم مدیر سره اړیکه ونیسئ.";
  return "";
}

export default function SignInForm() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<OtpStep>("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpExpiry, setOtpExpiry] = useState(0);

  // demo-mode only
  const [demoOtpCode, setDemoOtpCode] = useState("");
  const [otpAttempts, setOtpAttempts] = useState(0);

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [forgotDone, setForgotDone] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (!isFirebaseConfigured) {
        const backendRole = (loggedInUser as any).wmsRole;
        if (backendRole) {
          navigate(backendRole === ROLES.SUPER_ADMIN ? "/superadmin" : "/dashboard", { replace: true });
          return;
        }
        const users = getDemoUsers();
        const found = users.find(u => u.uid === loggedInUser.uid);
        navigate(found?.role === ROLES.SUPER_ADMIN ? "/superadmin" : "/dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      // Normal login failed — try delegate login
      const cleanEmail = email.trim().toLowerCase();
      const delegate = await tryDelegateLogin(cleanEmail, password);
      if (delegate) {
        // Register delegate as a temporary user in localStorage so getDemoUserProfile works
        const existingUsers = getLocalItem<any[]>("users", []);
        const withoutOld = existingUsers.filter((u: any) => u.email?.toLowerCase() !== cleanEmail);
        const delegateProfile = {
          uid: delegate.uid,
          name: delegate.name,
          email: delegate.email,
          phone: "",
          role: delegate.role === "SUPER_ADMIN" ? ROLES.SUPER_ADMIN : ROLES.ADMIN,
          active: true,
          forcePasswordChange: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setLocalItem("users", [...withoutOld, delegateProfile]);
        window.localStorage.removeItem(DEMO_LOGGED_OUT_KEY);
        window.localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify({
          email: delegate.email,
          uid: delegate.uid,
          displayName: delegate.name,
        }));
        window.dispatchEvent(new Event("kandahar-wms-demo-auth-change"));
        navigate(delegate.role === "SUPER_ADMIN" ? "/superadmin" : "/dashboard", { replace: true });
        return;
      }
      console.error("Login failed:", err);
      setError("برېښنالیک یا پټنوم ناسم دی / ایمیل یا رمز اشتباه است");
      setLoading(false);
    }
  };

  const openForgot = () => {
    setShowForgot(true);
    setForgotStep("email");
    setForgotEmail(email);
    setOtpInput("");
    setDemoOtpCode("");
    setOtpExpiry(0);
    setOtpAttempts(0);
    setNewPass("");
    setConfirmPass("");
    setForgotMsg(null);
    setForgotDone(false);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = forgotEmail.trim().toLowerCase();
    if (!cleaned) {
      setForgotMsg({ text: "مهرباني وکړئ خپل ایمیل ولیکئ.", ok: false });
      return;
    }

    if (isFirebaseConfigured) {
      setForgotMsg({ text: "د Firebase له لارې د پټنوم بیا رغونې لینک ستاسې ایمیل ته ولیږل شو.", ok: true });
      return;
    }

    setForgotLoading(true);
    setForgotMsg(null);

    const result = await apiSendOtp(cleaned);
    setForgotLoading(false);

    if (result.success) {
      setOtpExpiry(Date.now() + OTP_TTL_MS);
      setOtpAttempts(0);
      setForgotStep("otp");
      const sentTo = (result as any).sentTo || "د سیستم مدیر ایمیل";
      setForgotMsg({ text: `✅ تایید کوډ (OTP) د ${sentTo} ایمیل ته ولیږل شو. هغه ایمیل وچیک کړئ.`, ok: true });
      return;
    }

    // SMTP not configured — fall back to demo mode for localStorage users
    if (result.code === "SMTP_NOT_CONFIGURED" || result.code === "NETWORK_ERROR") {
      const allUsers = [
        ...DEMO_SEED_USERS,
        ...getLocalItem<{ email: string; password: string }[]>("extra_users", []),
      ];
      const found = allUsers.find(u => u.email.toLowerCase() === cleaned);
      if (!found) {
        setForgotMsg({ text: "دا ایمیل پته د سیستم کې نه موندل کیږي. مهرباني وکړئ د سیستم مدیر سره اړیکه ونیسئ.", ok: false });
        return;
      }
      const code = generateOtp();
      setDemoOtpCode(code);
      setOtpExpiry(Date.now() + OTP_TTL_MS);
      setOtpAttempts(0);
      setForgotStep("otp");
      setForgotMsg({
        text: `⚠️ د ایمیل کنفیګ نشته — د نمایشي حالت کوډ: ${code}`,
        ok: true,
      });
      return;
    }

    const friendly = friendlySmtpError(result.code);
    setForgotMsg({ text: friendly || result.message || "د ایمیل لیږلو کې ستونزه وه.", ok: false });
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Date.now() > otpExpiry) {
      setForgotMsg({ text: "د تایید کوډ وخت ختم شوی. مهرباني وکړئ بیا هڅه وکړئ.", ok: false });
      setForgotStep("email");
      return;
    }

    // Demo fallback mode (OTP was generated locally)
    if (demoOtpCode) {
      if (otpAttempts >= MAX_OTP_ATTEMPTS) {
        setForgotMsg({ text: "ډیرې ناسمې هڅې. مهرباني وکړئ بیا د پیل کولو هڅه وکړئ.", ok: false });
        setForgotStep("email");
        return;
      }
      if (otpInput.trim() !== demoOtpCode) {
        setOtpAttempts(a => a + 1);
        setForgotMsg({ text: "تایید کوډ ناسم دی. بیا هڅه وکړئ.", ok: false });
        return;
      }
      setForgotMsg(null);
      setForgotStep("newpass");
      return;
    }

    // Real backend verification
    setForgotLoading(true);
    setForgotMsg(null);
    const result = await apiVerifyOtp(forgotEmail.trim().toLowerCase(), otpInput.trim());
    setForgotLoading(false);

    if (result.success) {
      setForgotMsg(null);
      setForgotStep("newpass");
      return;
    }

    if (result.code === "OTP_EXPIRED") {
      setForgotStep("email");
    }
    setForgotMsg({ text: result.message || "تایید کوډ ناسم دی.", ok: false });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass.trim()) {
      setForgotMsg({ text: "مهرباني وکړئ نوی پټنوم ولیکئ.", ok: false });
      return;
    }
    if (newPass.length < 6) {
      setForgotMsg({ text: "پټنوم باید لږ تر لږه ۶ توري ولري.", ok: false });
      return;
    }
    if (newPass !== confirmPass) {
      setForgotMsg({ text: "پټنومونه سره برابر نه دي.", ok: false });
      return;
    }

    // Demo fallback (localStorage)
    if (demoOtpCode) {
      const overrides = getLocalItem<{ email: string; password: string }[]>("password_overrides", []);
      const filtered = overrides.filter(o => o.email.toLowerCase() !== forgotEmail.trim().toLowerCase());
      setLocalItem("password_overrides", [...filtered, { email: forgotEmail.trim().toLowerCase(), password: newPass }]);
      setForgotDone(true);
      setForgotMsg({ text: "پټنوم بریالیتوب سره بدل شو. اوس کولی شئ نوي پټنوم سره ننوځئ.", ok: true });
      setTimeout(() => {
        setShowForgot(false);
        setForgotDone(false);
        setEmail(forgotEmail.trim().toLowerCase());
        setPassword("");
      }, 2500);
      return;
    }

    // Real backend reset
    setForgotLoading(true);
    setForgotMsg(null);
    const result = await apiResetPassword(forgotEmail.trim().toLowerCase(), otpInput.trim(), newPass);
    setForgotLoading(false);

    if (result.success) {
      // Also update localStorage password_overrides so demo-mode login works immediately
      const cleanForgotEmail = forgotEmail.trim().toLowerCase();
      const overrides = getLocalItem<{ email: string; password: string }[]>("password_overrides", []);
      const filtered = overrides.filter(o => o.email.toLowerCase() !== cleanForgotEmail);
      setLocalItem("password_overrides", [...filtered, { email: cleanForgotEmail, password: newPass }]);

      setForgotDone(true);
      setForgotMsg({ text: "✅ پټنوم بریالیتوب سره بدل شو. اوس کولی شئ نوي پټنوم سره ننوځئ.", ok: true });
      setTimeout(() => {
        setShowForgot(false);
        setForgotDone(false);
        setEmail(forgotEmail.trim().toLowerCase());
        setPassword("");
      }, 2500);
      return;
    }

    setForgotMsg({ text: result.message || "د پټنوم بدلولو کې ستونزه وه.", ok: false });
  };

  const secondsLeft = Math.max(0, Math.ceil((otpExpiry - Date.now()) / 1000));

  return (
    <div className="flex flex-col flex-1" dir="rtl">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-6 text-center">
            <h1 className="mb-3 font-bold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              د کندهار پوهنتون د عمومي ګدام او تدارکاتو مدیریت سیستم
            </h1>
            <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
              د موجودۍ، غوښتنو، تدارکاتو او ګدام مدیریت ډیجیټلي سیستم
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          {!showForgot ? (
            <>
              <form onSubmit={handleSubmit} autoComplete="off">
                <div className="space-y-5">
                  <div>
                    <Label>
                      برېښنالیک / ایمیل <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="email"
                      placeholder="خپل ایمیل ولیکئ"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>
                        پټنوم / رمز <span className="text-error-500">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={openForgot}
                        className="text-xs text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium"
                      >
                        پټنوم مو هېر شوی؟
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="پټنوم ولیکئ"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <span
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute z-30 -translate-y-1/2 cursor-pointer left-4 top-1/2"
                      >
                        {showPassword ? (
                          <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                        ) : (
                          <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                        )}
                      </span>
                    </div>
                  </div>

                  <Button className="w-full" size="sm" type="submit" disabled={loading}>
                    {loading ? "مهرباني وکړئ انتظار وکړئ..." : "سیستم ته ننوتل"}
                  </Button>
                </div>
              </form>

              <div className="mt-5 rounded-lg bg-gray-50 p-3 text-center text-xs text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
                د نوي حساب جوړول او صلاحیت ورکول یوازې د عمومي صلاحیت لرونکي له لارې کېږي.
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-brand-50 border border-brand-200 p-4 dark:bg-brand-900/20 dark:border-brand-800">
                <p className="text-sm font-semibold text-brand-700 dark:text-brand-300 mb-1">
                  🔑 د پټنوم بیا رغونه
                </p>
                <p className="text-xs text-brand-600 dark:text-brand-400">
                  {forgotStep === "email" && "خپل ایمیل ولیکئ — یو تایید کوډ (OTP) به ستاسې ایمیل ته ولیږل شي."}
                  {forgotStep === "otp" && "ستاسې ایمیل ته لیږل شوی ۶ رقمه تایید کوډ ولیکئ."}
                  {forgotStep === "newpass" && "نوی پټنوم وټاکئ."}
                </p>
              </div>

              {forgotMsg && (
                <div className={`rounded-lg p-3 text-sm font-medium border ${forgotMsg.ok
                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                  : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                }`}>
                  {forgotMsg.text}
                </div>
              )}

              {!forgotDone && forgotStep === "email" && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <Label>برېښنالیک / ایمیل</Label>
                    <Input
                      type="email"
                      placeholder="خپل ایمیل ولیکئ"
                      value={forgotEmail}
                      onChange={(e) => { setForgotEmail(e.target.value); setForgotMsg(null); }}
                    />
                  </div>
                  <Button className="w-full" size="sm" type="submit" disabled={forgotLoading}>
                    {forgotLoading ? "لیږل کیږي..." : "تایید کوډ ولیږئ"}
                  </Button>
                </form>
              )}

              {!forgotDone && forgotStep === "otp" && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <Label>تایید کوډ (OTP)</Label>
                    <Input
                      type="text"
                      placeholder="۶ رقمه کوډ"
                      value={otpInput}
                      onChange={(e) => { setOtpInput(e.target.value); setForgotMsg(null); }}
                      maxLength={6}
                    />
                    {secondsLeft > 0 && (
                      <p className="mt-1 text-xs text-gray-400 text-right">
                        د پاتې وخت: {secondsLeft} ثانیې
                        {demoOtpCode && ` — بیا هڅه: ${MAX_OTP_ATTEMPTS - otpAttempts} ځله پاتې`}
                      </p>
                    )}
                  </div>
                  <Button className="w-full" size="sm" type="submit" disabled={forgotLoading}>
                    {forgotLoading ? "تایید کیږي..." : "تایید"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setForgotStep("email"); setForgotMsg(null); setOtpInput(""); setDemoOtpCode(""); }}
                    className="w-full text-center text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  >
                    بیا کوډ ولیږئ
                  </button>
                </form>
              )}

              {!forgotDone && forgotStep === "newpass" && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <Label>نوی پټنوم</Label>
                    <div className="relative">
                      <Input
                        type={showNewPass ? "text" : "password"}
                        placeholder="نوی پټنوم (لږ تر لږه ۶ توري)"
                        value={newPass}
                        onChange={(e) => { setNewPass(e.target.value); setForgotMsg(null); }}
                      />
                      <span
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute z-30 -translate-y-1/2 cursor-pointer left-4 top-1/2"
                      >
                        {showNewPass
                          ? <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                          : <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label>پټنوم تایید کړئ</Label>
                    <Input
                      type="password"
                      placeholder="پټنوم بیا ولیکئ"
                      value={confirmPass}
                      onChange={(e) => { setConfirmPass(e.target.value); setForgotMsg(null); }}
                    />
                  </div>
                  <Button className="w-full" size="sm" type="submit" disabled={forgotLoading}>
                    {forgotLoading ? "خوندي کیږي..." : "پټنوم خوندي کړئ"}
                  </Button>
                </form>
              )}

              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium py-1"
              >
                ← شاته ورستنیدل
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
