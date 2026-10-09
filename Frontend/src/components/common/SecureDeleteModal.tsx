import { useState } from "react";
import { DEMO_SEED_USERS, getLocalItem } from "../../firebase/localStore";
import { isFirebaseConfigured } from "../../firebase/firebase";
import { reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth } from "../../firebase/firebase";

interface SecureDeleteModalProps {
  title: string;
  description: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  currentUserEmail?: string;
  requireReason?: boolean;
}

export default function SecureDeleteModal({
  title,
  description,
  onConfirm,
  onCancel,
  currentUserEmail,
  requireReason = true,
}: SecureDeleteModalProps) {
  const [inputEmail, setInputEmail] = useState(currentUserEmail || "");
  const [inputPass, setInputPass] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputEmail.trim() || !inputPass.trim()) {
      setError("د حذف لپاره خپل برېښنالیک او پټنوم ولیکئ");
      return;
    }
    if (requireReason && !reason.trim()) {
      setError("مهرباني وکړئ د حذف دلیل ولیکئ. / لطفاً دلیل حذف را بنویسید.");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      if (isFirebaseConfigured) {
        const user = auth.currentUser;
        if (!user) throw new Error("دا عمل اجازه نه لري");
        const cred = EmailAuthProvider.credential(inputEmail.trim(), inputPass);
        await reauthenticateWithCredential(user, cred);
        onConfirm(reason.trim());
        return;
      }

      try {
        const response = await fetch('/api/auth/verify-current-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: inputEmail.trim(), password: inputPass }),
        });
        if (response.ok) {
          onConfirm(reason.trim());
          return;
        }
        if (response.status !== 404) {
          setError("پټنوم ناسم دی");
          return;
        }
      } catch {
        // Offline/demo fallback below.
      }

      const overrides = getLocalItem<{ email: string; password: string }[]>("password_overrides", []);
      const override = overrides.find(o => o.email.toLowerCase() === inputEmail.trim().toLowerCase());
      const effectivePassword = override ? override.password : undefined;

      const matched = DEMO_SEED_USERS.find(u => u.email.toLowerCase() === inputEmail.trim().toLowerCase());
      const checkPassword = effectivePassword ?? matched?.password ?? null;

      if (!matched && !override) {
        setError("پټنوم ناسم دی");
        return;
      }
      if (inputPass !== checkPassword) {
        setError("پټنوم ناسم دی");
        return;
      }
      onConfirm(reason.trim());
    } catch {
      setError("پټنوم ناسم دی");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white dark:border-red-900/40 dark:bg-gray-900 shadow-2xl p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-2xl">🔐</span>
          <h4 className="text-base font-bold text-gray-800 dark:text-white">{title}</h4>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{description}</p>
        <p className="text-xs text-red-500 mb-4">د حذف لپاره خپل ننوتلو معلومات تایید کړئ.</p>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-3">
          {requireReason && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                د حذف دلیل <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal"> / دلیل حذف</span>
              </label>
              <textarea
                value={reason}
                onChange={e => { setReason(e.target.value); setError(""); }}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-red-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90"
                placeholder="ولې دا ریکارډ حذف کوئ؟ / چرا این رکورد را حذف می‌کنید؟"
                required
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">برېښنالیک</label>
            <input
              type="email"
              value={inputEmail}
              onChange={e => { setInputEmail(e.target.value); setError(""); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-red-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90"
              placeholder="ستاسې ایمیل"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">پټنوم</label>
            <input
              type="password"
              value={inputPass}
              onChange={e => { setInputPass(e.target.value); setError(""); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-red-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90"
              placeholder="ستاسې پټنوم"
              required
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition"
            >
              لغوه
            </button>
            <button
              type="submit"
              disabled={verifying}
              className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-60 text-sm font-bold text-white transition"
            >
              {verifying ? "تایید..." : "تایید او حذف"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
