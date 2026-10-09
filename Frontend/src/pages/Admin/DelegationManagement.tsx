import React, { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";
import SecureDeleteModal from "../../components/common/SecureDeleteModal";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { apiClient } from "../../api/apiClient";

interface Delegation {
  id: number;
  delegated_role: "SUPER_ADMIN" | "ADMIN";
  delegated_user_id: number;
  delegated_user_name: string;
  delegated_user_email: string;
  delegated_by_name: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  delegated_role: "SUPER_ADMIN" as "SUPER_ADMIN" | "ADMIN",
  delegated_user_name: "",
  delegated_user_email: "",
  password: "",
  confirm_password: "",
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
  reason: "",
};

export default function DelegationManagement() {
  const { profile } = useAuth();
  const { pick } = useLanguage();

  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Delegation | null>(null);

  const fetchDelegations = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/delegations");
      setDelegations(Array.isArray(res) ? res : res.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDelegations(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.delegated_user_email || !form.start_date || !form.end_date) {
      setError(pick("ټول اړین ساحې پوره کړئ.", "همه فیلدهای الزامی را پر کنید."));
      return;
    }
    if (!form.password || form.password.trim().length < 6) {
      setError(pick("پاسورډ باید لږ تر لږه ۶ توري ولري.", "رمز باید حداقل ۶ کاراکتر داشته باشد."));
      return;
    }
    if (form.password !== form.confirm_password) {
      setError(pick("پاسورډونه سره برابر نه دي.", "رمزها با هم مطابقت ندارند."));
      return;
    }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      setError(pick("د پای نیټه باید له پیل نیټې وروسته وي.", "تاریخ پایان باید بعد از شروع باشد."));
      return;
    }
    setSaving(true);
    try {
      await apiClient.post("/delegations", {
        delegated_role: form.delegated_role,
        delegated_user_name: form.delegated_user_name,
        delegated_user_email: form.delegated_user_email,
        password: form.password,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
        delegated_by_name: profile?.name || "SuperAdmin",
        delegated_user_id: 0,
      });
      setSuccess(pick("کفیل بریالیتوب سره تعیین شو.", "نماینده با موفقیت تعیین شد."));
      setShowForm(false);
      setForm({ ...emptyForm });
      fetchDelegations();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || pick("خطا پیښه شوه.", "خطایی رخ داد."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await apiClient.put(`/delegations/${id}/deactivate`, {});
      fetchDelegations();
    } catch {}
  };

  const handleDelete = async (_reason: string) => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    try {
      await apiClient.delete(`/delegations/${id}`);
      fetchDelegations();
    } catch {}
  };

  const isActive = (d: Delegation) => {
    const today = new Date().toISOString().split("T")[0];
    return d.is_active && d.start_date <= today && d.end_date >= today;
  };

  const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
  const labelCls = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";

  return (
    <>
      <PageMeta title="د کفیل مدیریت | Kandahar University WMS" description="د سوپر اډمین کفیل سیستم" />
      <Breadcrumb pageTitle={pick("د کفیل مدیریت", "مدیریت نمایندگی")} />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="space-y-6" dir="rtl">

        {success && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-green-700 text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
            ✓ {success}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            ✗ {error}
          </div>
        )}

        {/* Info Banner */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800/40 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <h3 className="font-bold text-blue-800 dark:text-blue-200">
                {pick("د کفیل سیستم", "سیستم نمایندگی")}
              </h3>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                {pick(
                  "د دې برخې له لارې تاسو کولی شئ خپل ځای نیوونکی (کفیل) تعیین کړئ چي د یوې وخت موندلو لپاره ستاسو صلاحیتونه وکاروي. کفیل کولی شي د سوپر اډمین یا اډمین صلاحیتونه ولري.",
                  "از این بخش می‌توانید نماینده (کفیل) تعیین کنید که در یک دوره زمانی اختیارات شما را اعمال کند."
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Header + Add Button */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">
              {pick("د کفالت لیست", "لیست نمایندگی‌ها")}
            </h3>
            <button
              onClick={() => { setShowForm(!showForm); setError(""); }}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 transition"
            >
              {showForm ? pick("❌ لغوه", "❌ انصراف") : pick("➕ نوی کفیل", "➕ کفیل جدید")}
            </button>
          </div>

          {/* Add Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <h4 className="font-bold text-primary text-sm">
                {pick("د نوي کفیل معلومات", "اطلاعات کفیل جدید")}
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    {pick("د کفیل صلاحیت", "اختیار کفیل")} <span className="text-red-500">*</span>
                  </label>
                  <select value={form.delegated_role}
                    onChange={e => setForm(p => ({ ...p, delegated_role: e.target.value as "SUPER_ADMIN" | "ADMIN" }))}
                    required className={inputCls}>
                    <option value="SUPER_ADMIN">{pick("سوپر اډمین (مقام)", "سوپر ادمین (مقام)")}</option>
                    <option value="ADMIN">{pick("اډمین", "ادمین")}</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    {pick("د کفیل نوم", "نام کفیل")} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.delegated_user_name}
                    onChange={e => setForm(p => ({ ...p, delegated_user_name: e.target.value }))}
                    required placeholder={pick("د کفیل بشپړ نوم", "نام کامل کفیل")} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>
                    {pick("د کفیل برېښنالیک", "ایمیل کفیل")} <span className="text-red-500">*</span>
                  </label>
                  <input type="email" value={form.delegated_user_email}
                    onChange={e => setForm(p => ({ ...p, delegated_user_email: e.target.value }))}
                    required placeholder="example@ku.edu.af" className={inputCls} dir="ltr" />
                </div>
                <div>
                  <label className={labelCls}>
                    {pick("د کفیل پاسورډ", "رمز کفیل")} <span className="text-red-500">*</span>
                  </label>
                  <input type="password" value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    required placeholder={pick("لږ تر لږه ۶ توري", "حداقل ۶ کاراکتر")}
                    className={inputCls} dir="ltr" />
                </div>
                <div>
                  <label className={labelCls}>
                    {pick("پاسورډ تایید کړئ", "تأیید رمز")} <span className="text-red-500">*</span>
                  </label>
                  <input type="password" value={form.confirm_password}
                    onChange={e => setForm(p => ({ ...p, confirm_password: e.target.value }))}
                    required placeholder={pick("پاسورډ بیا ولیکئ", "رمز را مجدداً وارد کنید")}
                    className={inputCls} dir="ltr" />
                </div>
                <div>
                  <label className={labelCls}>
                    {pick("د پیل نیټه", "تاریخ شروع")} <span className="text-red-500">*</span>
                  </label>
                  <input type="date" value={form.start_date}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                    required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>
                    {pick("د پای نیټه", "تاریخ پایان")} <span className="text-red-500">*</span>
                  </label>
                  <input type="date" value={form.end_date}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                    required min={form.start_date} className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>{pick("دلیل / یادښت", "دلیل / یادداشت")}</label>
                  <textarea value={form.reason}
                    onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                    rows={2} placeholder={pick("اختیاري یادښت...", "یادداشت اختیاری...")}
                    className={inputCls + " resize-none"} />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 transition">
                  {pick("لغوه", "انصراف")}
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-60 transition">
                  {saving ? pick("⏳ ثبتیږي...", "⏳ در حال ثبت...") : pick("✅ کفیل ثبت کول", "✅ ثبت کفیل")}
                </button>
              </div>
            </form>
          )}

          {/* Table */}
          {loading ? (
            <div className="text-center py-10 text-gray-400">{pick("بارول...", "در حال بارگذاری...")}</div>
          ) : delegations.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              {pick("هیڅ کفالت ثبت نه دی.", "هیچ نمایندگی ثبت نشده است.")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-white/80">
                      {pick("حالت", "وضعیت")}
                    </th>
                    <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-white/80">
                      {pick("کفیل", "کفیل")}
                    </th>
                    <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-white/80">
                      {pick("صلاحیت", "اختیار")}
                    </th>
                    <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-white/80">
                      {pick("وخت", "دوره")}
                    </th>
                    <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-white/80">
                      {pick("دلیل", "دلیل")}
                    </th>
                    <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-white/80">
                      {pick("عمل", "عملیات")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {delegations.map(d => {
                    const active = isActive(d);
                    return (
                      <tr key={d.id}
                        className={`border-b border-gray-100 dark:border-gray-800 ${active ? "bg-green-50 dark:bg-green-900/10" : ""}`}>
                        <td className="px-4 py-3 border border-gray-100 dark:border-gray-800">
                          {active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold px-2 py-0.5">
                              ✓ {pick("فعال", "فعال")}
                            </span>
                          ) : !d.is_active ? (
                            <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 text-xs px-2 py-0.5">
                              {pick("غیر فعال", "غیرفعال")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-2 py-0.5">
                              {pick("منقضي", "منقضی")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 border border-gray-100 dark:border-gray-800 font-medium">
                          <div>{d.delegated_user_name}</div>
                          <div className="text-xs text-gray-400 font-mono" dir="ltr">{d.delegated_user_email}</div>
                        </td>
                        <td className="px-4 py-3 border border-gray-100 dark:border-gray-800">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.delegated_role === "SUPER_ADMIN" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                            {d.delegated_role === "SUPER_ADMIN" ? pick("سوپر اډمین (مقام)", "سوپر ادمین") : pick("اډمین", "ادمین")}
                          </span>
                        </td>
                        <td className="px-4 py-3 border border-gray-100 dark:border-gray-800 text-xs text-gray-500 whitespace-nowrap">
                          <div>{d.start_date}</div>
                          <div className="text-gray-400">→ {d.end_date}</div>
                        </td>
                        <td className="px-4 py-3 border border-gray-100 dark:border-gray-800 text-xs text-gray-400 max-w-[140px] truncate">
                          {d.reason || "—"}
                        </td>
                        <td className="px-4 py-3 border border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-2 justify-end">
                            {d.is_active && (
                              <button
                                onClick={() => handleDeactivate(d.id)}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 font-medium transition"
                              >
                                ⏸ {pick("غیر فعالول", "غیرفعال")}
                              </button>
                            )}
                            <button
                              onClick={() => setPendingDelete(d)}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 font-medium transition"
                            >
                              🗑 {pick("حذف", "حذف")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h4 className="font-bold text-gray-800 dark:text-white/90 mb-3">
            📋 {pick("د کفالت سیستم د کار طریقه", "نحوه کار سیستم نمایندگی")}
          </h4>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>• {pick("کفیل کولی شي د خپل ایمیل او د کفالت پاسورډ سره سیستم ته ننوځي.", "کفیل می‌تواند با ایمیل و رمز کفالت خود وارد سیستم شود.")}</li>
            <li>• {pick("کله چي کفالت فعال وي، کفیل کولی شي د ټاکل شوي صلاحیت سره سیستم وکاروي.", "وقتی نمایندگی فعال است، کفیل می‌تواند با اختیار تعیین‌شده سیستم را استفاده کند.")}</li>
            <li>• {pick("د سوپر اډمین کفیل کولی شي غوښتنې منظور کړي.", "کفیل سوپر ادمین می‌تواند درخواست‌ها را منظور کند.")}</li>
            <li>• {pick("د اډمین کفیل کولی شي د اډمین ټول کارونه وکړي.", "کفیل ادمین می‌تواند تمام کارهای ادمین را انجام دهد.")}</li>
            <li>• {pick("د وخت د ختمیدو وروسته کفالت تل غیر فعالیږي.", "بعد از پایان دوره، نمایندگی خودکار غیرفعال می‌شود.")}</li>
            <li>• {pick("یوازي سوپر اډمین کولی شي کفالت تعیین کړي.", "فقط سوپر ادمین می‌تواند نمایندگی تعیین کند.")}</li>
          </ul>
        </div>
      </div>

      {pendingDelete && (
        <SecureDeleteModal
          title={pick("⚠️ د کفالت حذف کول", "⚠️ حذف نمایندگی")}
          description={`"${pendingDelete.delegated_user_name}" ${pick("کفالت ړنګیږي. ایا ډاډه یاست؟", "نمایندگی حذف می‌شود. مطمئن هستید؟")}`}
          currentUserEmail={profile?.email || ""}
          requireReason={true}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
