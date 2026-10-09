import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Button from "../../components/ui/button/Button";
import { createRequest } from "../../firebase/requests";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { managementService } from "../../services/management";
import { apiClient } from "../../api/apiClient";
import { saveOfficialFormData, mapRequestToProposal, mapRequestToSI9, syncForwardOnly } from "../../utils/officialFormDataAdapter";

const REQUEST_LEVELS_PS = ["ډېر عاجل", "ډېر مهم", "متوسط", "عادي", "لږ مهم"];
const REQUEST_LEVELS_DR = ["بسیار عاجل", "بسیار مهم", "متوسط", "عادی", "کم‌اهمیت"];

interface ChecklistItem {
  id: number;
  category: string;
  item_name: string;
  description: string;
  unit: string;
  estimated_price: number;
  inv_unit_price?: number;
  item_code: string;
}

interface RequestItemRow {
  checklistId: string;
  name: string;
  unit: string;
  typeOrSpecification: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  searchText: string;
  showDropdown: boolean;
}

export default function CreateRequest() {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistCategories, setChecklistCategories] = useState<string[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<RequestItemRow[]>([]);

  const [faculties, setFaculties] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [facultyMode, setFacultyMode] = useState<"dropdown" | "text">("dropdown");
  const [departmentMode, setDepartmentMode] = useState<"dropdown" | "text">("dropdown");

  const [formData, setFormData] = useState({
    faculty: "",
    faculty_id: "",
    departmentOrPerson: "",
    department_id: "",
    reason: "",
    requestLevel: "عادي",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [limitInfo, setLimitInfo] = useState<{ limit: number; today_count: number } | null>(null);
  const { user, profile } = useAuth();
  const { pick, lang } = useLanguage();
  const navigate = useNavigate();

  const levels = lang === "dr" ? REQUEST_LEVELS_DR : REQUEST_LEVELS_PS;

  // Load today's request count vs limit
  useEffect(() => {
    if (!profile?.name) return;
    fetch(`/api/settings/request-limit?requester_name=${encodeURIComponent(profile.name)}`)
      .then(r => r.json())
      .then(d => { if (d?.data) setLimitInfo({ limit: d.data.limit, today_count: d.data.today_count }); })
      .catch(() => {});
  }, [profile?.name]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const loadChecklist = (attempt: number) => {
      if (cancelled) return;
      setChecklistLoading(true);
      Promise.all([
        apiClient.get("/checklist?active_only=true"),
        apiClient.get("/checklist/categories"),
      ]).then(([itemsRes, catsRes]) => {
        if (cancelled) return;
        const items = Array.isArray(itemsRes) ? itemsRes : [];
        setChecklistItems(items);
        setChecklistCategories(Array.isArray(catsRes) ? catsRes : []);
        setChecklistLoading(false);
        if (items.length === 0 && attempt < 3) {
          retryTimer = setTimeout(() => loadChecklist(attempt + 1), 2500);
        }
      }).catch(() => {
        if (cancelled) return;
        setChecklistLoading(false);
        if (attempt < 3) {
          retryTimer = setTimeout(() => loadChecklist(attempt + 1), 2500);
        }
      });
    };

    loadChecklist(1);

    setLoadingFaculties(true);
    managementService.getFaculties()
      .then((data: any[]) => {
        setFaculties(data || []);
        setFacultyMode(data && data.length > 0 ? "dropdown" : "text");
      })
      .catch(() => setFacultyMode("text"))
      .finally(() => setLoadingFaculties(false));

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  // For REQUESTER: auto-fill faculty/department from their traceability profile
  // Requesters may be linked to a faculty or to an administrative department.
  const isRequester = profile?.role === "Requester";
  const requesterHasRequestScope = isRequester && Boolean(profile?.faculty_id || profile?.department_id);
  const administrativeSectionLabel = pick("اداري برخه", "بخش اداری");
  useEffect(() => {
    if (!isRequester || !requesterHasRequestScope) return;
    if (profile?.faculty_id && faculties.length === 0) return;

    const fid = profile?.faculty_id ? String(profile.faculty_id) : "";
    const did = profile?.department_id ? String(profile.department_id) : "";
    const facFromProfile = fid ? faculties.find((f: any) => String(f.id) === fid) : null;

    managementService.getDepartments().then((allDepts: any[]) => {
      const dept = did ? allDepts.find((d: any) => String(d.id) === did) : null;
      const deptFacultyId = dept?.faculty_id ? String(dept.faculty_id) : "";
      const resolvedFacultyId = fid || deptFacultyId;
      const fac = facFromProfile || (resolvedFacultyId ? faculties.find((f: any) => String(f.id) === resolvedFacultyId) : null);
      const isAdministrativeDepartment = Boolean(dept && dept.department_type === "ADMIN" && !resolvedFacultyId);

      setFormData(prev => ({
        ...prev,
        faculty_id: resolvedFacultyId,
        faculty: fac
          ? (lang === "dr" ? fac.name_fa : fac.name_ps)
          : (isAdministrativeDepartment ? administrativeSectionLabel : prev.faculty),
        ...(did && dept ? {
          department_id: did,
          departmentOrPerson: lang === "dr" ? dept.name_fa : dept.name_ps,
        } : {}),
      }));

      const filtered = resolvedFacultyId
        ? allDepts.filter((d: any) => String(d.faculty_id) === resolvedFacultyId)
        : (dept ? [dept] : []);
      setDepartments(filtered);
      setDepartmentMode(filtered.length > 0 && resolvedFacultyId ? "dropdown" : "text");
      setFacultyMode(resolvedFacultyId ? "dropdown" : "text");
    }).catch(() => {
      if (!fid && did) {
        setFormData(prev => ({ ...prev, faculty: administrativeSectionLabel, department_id: did }));
        setFacultyMode("text");
        setDepartmentMode("text");
      }
    });
  }, [isRequester, profile?.faculty_id, profile?.department_id, faculties.length, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!formData.faculty_id) { setDepartments([]); return; }
    managementService.getDepartments()
      .then((data: any[]) => {
        const filtered = (data || []).filter((d: any) => String(d.faculty_id) === String(formData.faculty_id));
        setDepartments(filtered);
        setDepartmentMode(filtered.length > 0 ? "dropdown" : "text");
        // For requester with a pre-assigned faculty, don't reset their department
        const isRequesterOwnFaculty = isRequester &&
          profile?.faculty_id &&
          String(profile.faculty_id) === formData.faculty_id;
        if (!isRequesterOwnFaculty) {
          setFormData(prev => ({ ...prev, departmentOrPerson: "", department_id: "" }));
        }
      })
      .catch(() => setDepartmentMode("text"));
  }, [formData.faculty_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = () => {
    setSelectedItems(prev => [...prev, {
      checklistId: "", name: "", unit: "", typeOrSpecification: "",
      quantity: 1, unitPrice: 0, totalPrice: 0, searchText: "", showDropdown: false,
    }]);
  };

  const removeItem = (index: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const getFilteredChecklist = (search: string, excludeIds: string[]) => {
    const q = search.trim().toLowerCase();
    return checklistItems.filter(ci => {
      if (!q) return true;
      return ci.item_name.toLowerCase().includes(q) ||
        (ci.description || "").toLowerCase().includes(q) ||
        ci.category.toLowerCase().includes(q) ||
        (ci.item_code || "").toLowerCase().includes(q);
    }).slice(0, 30);
  };

  const selectChecklistItem = (index: number, ci: ChecklistItem) => {
    const updated = [...selectedItems];
    // Use live inventory unit_price if available; fall back to checklist estimated_price
    const unitPrice = (ci.inv_unit_price != null && ci.inv_unit_price > 0)
      ? ci.inv_unit_price
      : (ci.estimated_price || 0);
    const qty = updated[index].quantity || 1;
    updated[index] = {
      ...updated[index],
      checklistId: String(ci.id),
      name: ci.item_name,
      unit: ci.unit || "",
      typeOrSpecification: ci.description || "",
      unitPrice,
      totalPrice: unitPrice * qty,
      searchText: ci.item_name,
      showDropdown: false,
    };
    setSelectedItems(updated);
  };

  const handleUnitPriceChange = (index: number, price: number) => {
    const updated = [...selectedItems];
    updated[index] = { ...updated[index], unitPrice: price, totalPrice: price * (updated[index].quantity || 1) };
    setSelectedItems(updated);
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const updated = [...selectedItems];
    updated[index] = { ...updated[index], quantity: qty, totalPrice: (updated[index].unitPrice || 0) * qty };
    setSelectedItems(updated);
  };

  const handleFacultySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fid = e.target.value;
    const fac = faculties.find((f: any) => String(f.id) === fid);
    setFormData(prev => ({
      ...prev,
      faculty_id: fid,
      faculty: fac ? (lang === "dr" ? fac.name_fa : fac.name_ps) : "",
      departmentOrPerson: "",
      department_id: "",
    }));
  };

  const handleDepartmentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const did = e.target.value;
    const dept = departments.find((d: any) => String(d.id) === did);
    setFormData(prev => ({
      ...prev,
      department_id: did,
      departmentOrPerson: dept ? (lang === "dr" ? dept.name_fa : dept.name_ps) : "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user || !profile) {
      setError(pick("د کاروونکي معلومات ونه موندل شول.", "اطلاعات کاربر یافت نشد."));
      return;
    }
    if (!formData.faculty.trim() && !requesterHasRequestScope) {
      setError(pick("مهرباني وکړئ پوهنځی انتخاب کړئ.", "لطفاً پوهنکده را انتخاب کنید."));
      return;
    }
    if (selectedItems.length === 0) {
      setError(pick("مهرباني وکړئ لږترلږه یو جنس اضافه کړئ.", "لطفاً حداقل یک جنس اضافه کنید."));
      return;
    }
    const invalid = selectedItems.find(i => !i.name.trim() || i.quantity < 1);
    if (invalid) {
      setError(pick("مهرباني وکړئ د هر جنس نوم او مقدار ډک کړئ.", "لطفاً نام و مقدار هر جنس را وارد کنید."));
      return;
    }
    const unselected = checklistItems.length > 0 && selectedItems.find(i => !i.checklistId);
    if (unselected) {
      setError(pick("مهرباني وکړئ د چکلیسټ نه جنس غوره کړئ. د خپل سري لیکل مجاز ندي.", "لطفاً جنس را از چک‌لیست انتخاب کنید. متن آزاد مجاز نیست."));
      return;
    }

    setLoading(true);
    try {
      const requestItems = selectedItems.map(i => ({
        itemId: i.checklistId || "",
        name: i.name,
        unit: i.unit,
        quantity: i.quantity,
        specifications: i.typeOrSpecification,
        unitPrice: i.unitPrice || 0,
        totalPrice: i.totalPrice || 0,
      }));
      const reqPayload: any = {
        faculty: formData.faculty || (isRequester && profile.department_id ? administrativeSectionLabel : ""),
        departmentOrPerson: formData.departmentOrPerson,
        reason: formData.reason,
        originalRequestLevel: formData.requestLevel,
        currentRequestLevel: formData.requestLevel,
        items: requestItems,
        faculty_id: formData.faculty_id ? Number(formData.faculty_id) : (profile.faculty_id || undefined),
        department_id: formData.department_id ? Number(formData.department_id) : (profile.department_id || undefined),
        person_id: profile.person_id || undefined,
      };
      const requestId = await createRequest(reqPayload, user.uid, profile.name);

      // ── Auto-sync ALL official forms on new request creation ──
      // Item specs from proposal table flow into tender, comparison, purchase order, etc.
      try {
        const mockRequest: any = {
          ...reqPayload,
          id: requestId,
          requesterName: profile.name,
        };
        const proposalData = mapRequestToProposal(mockRequest);
        const si9Data = mapRequestToSI9(mockRequest);
        saveOfficialFormData(requestId, "proposal", proposalData);
        saveOfficialFormData(requestId, "si9", si9Data);
        // Push item specs forward into all downstream forms (tender → fs5)
        syncForwardOnly(requestId, "proposal", proposalData);
      } catch { /* form sync is non-critical */ }

      navigate(`/requests/details/${requestId}`);
    } catch (err: any) {
      console.error("Error creating request:", err);
      if (err?.limit_exceeded) {
        setError(err.message || pick("د ورځني غوښتنو حد خلاص شوی.", "محدودیت درخواست‌های روزانه پر شده است."));
        // Refresh the limit counter so UI reflects latest state
        if (profile?.name) {
          fetch(`/api/settings/request-limit?requester_name=${encodeURIComponent(profile.name)}`)
            .then(r => r.json())
            .then(d => { if (d?.data) setLimitInfo({ limit: d.data.limit, today_count: d.data.today_count }); })
            .catch(() => {});
        }
      } else {
        setError(pick("د غوښتنې ثبتولو کې تېروتنه رامنځته شوه.", "خطایی در ثبت درخواست رخ داد."));
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-gray-800 outline-none transition focus:border-primary dark:border-gray-700 dark:text-white/90";
  const selCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary dark:bg-gray-800 dark:border-gray-600 dark:text-white/90";

  // ── Guard: Requester must have an assigned faculty before submitting ──────
  if (isRequester && !requesterHasRequestScope) {
    return (
      <>
        <PageMeta title={pick("نوې غوښتنه", "درخواست جدید") + " | Kandahar University WMS"} description="" />
        <Breadcrumb pageTitle="نوې غوښتنه / درخواست جدید" />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-10 flex flex-col items-center justify-center gap-5 text-center min-h-[320px]" dir="rtl">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-3xl">🏫</div>
          <div>
            <h2 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">
              {pick("ستاسو پوهنځی ټاکل شوی نه دی", "پوهنکده شما تعیین نشده است")}
            </h2>
            <p className="text-sm text-amber-700 dark:text-amber-400 max-w-md leading-relaxed">
              {pick(
                "د نوي غوښتنه کولو لپاره باید سوپر ادمین ستاسو اکاونټ ته پوهنځی تاکي. مهرباني وکړئ له سوپر ادمین سره اړیکه ونیسئ.",
                "برای ثبت درخواست جدید، ادمین باید پوهنکده شما را تعیین کند. لطفاً با سوپر ادمین تماس بگیرید."
              )}
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="mt-2 px-6 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition"
          >
            {pick("بیرته ګرځئ", "بازگشت")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title={pick("نوې غوښتنه", "درخواست جدید") + " | Kandahar University WMS"} description="" />
      <Breadcrumb pageTitle="نوې غوښتنه / درخواست جدید" />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]" dir="rtl">
        {/* Daily limit usage badge */}
        {limitInfo && limitInfo.limit > 0 && (
          <div className={`mb-4 flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
            limitInfo.today_count >= limitInfo.limit
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
              : limitInfo.today_count >= limitInfo.limit - 1
              ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300"
              : "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-900/10 dark:text-blue-300"
          }`}>
            <span className="font-semibold">
              {pick("نن د غوښتنو شمیر:", "تعداد درخواست امروز:")}
            </span>
            <span className="font-black text-base">
              {limitInfo.today_count} / {limitInfo.limit}
              {limitInfo.today_count >= limitInfo.limit && (
                <span className="mr-2 text-xs font-semibold">— {pick("حد خلاص", "محدودیت پر")}</span>
              )}
            </span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                {pick("پوهنځی / فاکولته", "پوهنکده / فاکولتی")} <span className="text-red-500">*</span>
              </label>
              {isRequester ? (
                /* ── REQUESTER: always locked — no dropdown ever ── */
                requesterHasRequestScope ? (
                  <div className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-gray-800 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-gray-200 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    {formData.faculty || (profile?.department_id ? administrativeSectionLabel : "")
                      ? <span className="font-semibold">{formData.faculty || administrativeSectionLabel}</span>
                      : <span className="text-gray-400 text-sm animate-pulse">{pick("بارجیږي...", "در حال بارگذاری...")}</span>
                    }
                  </div>
                ) : (
                  <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/20 flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span className="text-amber-700 dark:text-amber-300 text-sm">{pick("پوهنځی نه دی ټاکل شوی — له سوپر ادمین سره اړیکه ونیسئ.", "پوهنکده تعیین نشده — با ادمین تماس بگیرید.")}</span>
                  </div>
                )
              ) : facultyMode === "dropdown" ? (
                /* ── Non-requester: normal dropdown ── */
                <>
                  <select value={formData.faculty_id} onChange={handleFacultySelect} required disabled={loadingFaculties} className={inputCls}>
                    <option value="">{loadingFaculties ? pick("بارگذاری...", "بارگذاری...") : pick("پوهنځی غوره کړئ...", "پوهنکده انتخاب کنید...")}</option>
                    {faculties.map((f: any) => (
                      <option key={f.id} value={f.id}>{lang === "dr" ? f.name_fa : f.name_ps}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => { setFacultyMode("text"); setFormData(p => ({ ...p, faculty_id: "", faculty: "" })); }}
                    className="mt-1 text-xs text-blue-500 hover:underline">{pick("لاسي ولیکئ", "تایپ کنید")}</button>
                </>
              ) : (
                <>
                  <input type="text" value={formData.faculty}
                    onChange={e => setFormData({ ...formData, faculty: e.target.value, faculty_id: "" })}
                    required placeholder={pick("مثلاً: کمپیوټر ساینس", "مثلاً: علوم کامپیوتر")} className={inputCls} />
                  {faculties.length > 0 && (
                    <button type="button" onClick={() => setFacultyMode("dropdown")}
                      className="mt-1 text-xs text-blue-500 hover:underline">{pick("د لیست نه غوره کړئ", "از لیست انتخاب کنید")}</button>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                {pick("ډیپارمنټ", "دیپارتمنت")} <span className="text-red-500">*</span>
              </label>
              {isRequester && profile?.department_id ? (
                <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  <span className="font-medium">{formData.departmentOrPerson || pick("د ستاسو ډیپارمنټ...", "دیپارتمنت شما...")}</span>
                </div>
              ) : departmentMode === "dropdown" && formData.faculty_id && departments.length > 0 ? (
                <>
                  <select value={formData.department_id} onChange={handleDepartmentSelect} required className={inputCls}>
                    <option value="">{pick("ډیپارمنټ غوره کړئ...", "دیپارتمنت انتخاب کنید...")}</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>{lang === "dr" ? d.name_fa : d.name_ps}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => { setDepartmentMode("text"); setFormData(p => ({ ...p, department_id: "", departmentOrPerson: "" })); }}
                    className="mt-1 text-xs text-blue-500 hover:underline">{pick("لاسي ولیکئ", "تایپ کنید")}</button>
                </>
              ) : formData.faculty_id && departments.length === 0 ? (
                <>
                  <input type="text" value={formData.departmentOrPerson}
                    onChange={e => setFormData({ ...formData, departmentOrPerson: e.target.value })}
                    required placeholder={pick("لاسي ولیکئ", "تایپ کنید")} className={inputCls} />
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    {pick("د دې پوهنځي لپاره ډیپارتمنت ثبت نه دی", "برای این پوهنکده دیپارتمنت ثبت نشده است")}
                  </p>
                </>
              ) : (
                <>
                  <input type="text" value={formData.departmentOrPerson}
                    onChange={e => setFormData({ ...formData, departmentOrPerson: e.target.value })}
                    required placeholder={pick("مثلاً: تدریسي مدیریت", "مثلاً: مدیریت آموزشی")} className={inputCls} />
                  {departments.length > 0 && (
                    <button type="button" onClick={() => setDepartmentMode("dropdown")}
                      className="mt-1 text-xs text-blue-500 hover:underline">{pick("د لیست نه غوره کړئ", "از لیست انتخاب کنید")}</button>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                {pick("د غوښتنې درجه", "درجه درخواست")} <span className="text-red-500">*</span>
              </label>
              <select className={inputCls} value={formData.requestLevel}
                onChange={e => setFormData({ ...formData, requestLevel: e.target.value })} required>
                {levels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              {pick("د غوښتنې علت / دلیل", "دلیل درخواست")} <span className="text-red-500">*</span>
            </label>
            <textarea value={formData.reason}
              onChange={e => setFormData({ ...formData, reason: e.target.value })}
              className={inputCls} rows={3} required
              placeholder={pick("د غوښتنې لنډه توضیح...", "توضیح مختصر درخواست...")} />
          </div>

          <div className="border-t pt-6 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">{pick("غوښتل شوي اجناس", "اجناس درخواست‌شده")}</h3>
                {checklistLoading && (
                  <p className="text-xs text-gray-400 mt-0.5">{pick("د چکلیسټ بارول...", "بارگذاری چک‌لیست...")}</p>
                )}
                {!checklistLoading && checklistItems.length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {pick(`${checklistItems.length} جنسونه د چکلیسټ کې`, `${checklistItems.length} جنس در چک‌لیست`)}
                  </p>
                )}
              </div>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-primary text-primary hover:bg-primary hover:text-white transition">
                + {pick("جنس اضافه کول", "افزودن جنس")}
              </button>
            </div>

            <div className="space-y-4">
              {selectedItems.map((sItem, index) => (
                <div key={index} className="rounded-xl bg-gray-50 dark:bg-white/5 p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {pick("جنس", "جنس")} #{index + 1}
                    </span>
                    <button type="button" onClick={() => removeItem(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Row 1 — item search */}
                  <div className="mb-3">
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {pick("جنس انتخاب کړئ *", "انتخاب جنس *")}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={pick("لټون... (نوم، کټګوري، کوډ)", "جستجو... (نام، دسته، کد)")}
                        value={sItem.searchText}
                        onChange={e => {
                          const updated = [...selectedItems];
                          updated[index] = { ...updated[index], searchText: e.target.value, showDropdown: true, checklistId: "", name: "" };
                          setSelectedItems(updated);
                        }}
                        onFocus={() => {
                          const updated = [...selectedItems];
                          updated[index] = { ...updated[index], showDropdown: true };
                          setSelectedItems(updated);
                        }}
                        onBlur={() => setTimeout(() => {
                          const updated = [...selectedItems];
                          updated[index] = { ...updated[index], showDropdown: false };
                          setSelectedItems(updated);
                        }, 200)}
                        className={selCls}
                      />
                      {sItem.showDropdown && (
                        <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                          {checklistLoading ? (
                            <div className="px-3 py-2 text-xs text-gray-400">{pick("بارول...", "در حال بارگذاری...")}</div>
                          ) : (
                            <>
                              {getFilteredChecklist(sItem.searchText, []).length === 0 ? (
                                <div className="px-3 py-3 text-xs text-gray-400 text-center">
                                  {pick("هیڅ جنس ونه موندل شو", "جنسی یافت نشد")}
                                </div>
                              ) : (
                                getFilteredChecklist(sItem.searchText, []).map(ci => (
                                  <button key={ci.id} type="button"
                                    onMouseDown={() => selectChecklistItem(index, ci)}
                                    className="w-full text-right px-3 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-medium text-gray-800 dark:text-white/90">{ci.item_name}</span>
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0">{ci.category}</span>
                                    </div>
                                    {ci.description && (
                                      <div className="text-xs text-gray-400 mt-0.5 truncate">{ci.description}</div>
                                    )}
                                    <div className="flex gap-2 mt-0.5">
                                      {ci.unit && <span className="text-xs text-gray-400">{pick("واحد:", "واحد:")} {ci.unit}</span>}
                                      {ci.item_code && <span className="text-xs font-mono text-gray-300 dark:text-gray-600">{ci.item_code}</span>}
                                    </div>
                                  </button>
                                ))
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2 — all columns: مقدار | واحد | مشخصات | في قیمت | مجموعه */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {/* مقدار */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{pick("مقدار *", "مقدار *")}</label>
                      <input type="number" value={sItem.quantity}
                        onChange={e => handleQuantityChange(index, Number(e.target.value))}
                        min="1" required className={selCls} />
                    </div>

                    {/* واحد */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{pick("واحد", "واحد")}</label>
                      <input
                        type="text"
                        value={sItem.unit}
                        onChange={e => {
                          const updated = [...selectedItems];
                          updated[index] = { ...updated[index], unit: e.target.value };
                          setSelectedItems(updated);
                        }}
                        placeholder={pick("مثلاً: عدد", "مثلاً: عدد")}
                        className={selCls}
                      />
                    </div>

                    {/* مشخصات/نوع */}
                    <div className="sm:col-span-1 md:col-span-1">
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{pick("مشخصات / نوع", "مشخصات / نوع")}</label>
                      <input
                        type="text"
                        value={sItem.typeOrSpecification}
                        onChange={e => {
                          const updated = [...selectedItems];
                          updated[index] = { ...updated[index], typeOrSpecification: e.target.value };
                          setSelectedItems(updated);
                        }}
                        placeholder={pick("مشخصات...", "مشخصات...")}
                        className={selCls}
                      />
                    </div>

                    {/* في قیمت */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{pick("في قیمت (افغانۍ)", "قیمت واحد (افغانی)")}</label>
                      <input
                        type="number"
                        value={sItem.unitPrice || ""}
                        onChange={e => handleUnitPriceChange(index, Number(e.target.value))}
                        min="0"
                        placeholder="0"
                        className={selCls}
                      />
                    </div>

                    {/* مجموعه */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{pick("مجموعه (افغانۍ)", "مجموع (افغانی)")}</label>
                      <div className={`${selCls} bg-gray-100 dark:bg-gray-700 font-semibold text-primary`}>
                        {sItem.totalPrice > 0 ? sItem.totalPrice.toLocaleString() : "—"}
                      </div>
                    </div>
                  </div>

                  {/* ── بل جنس هم غواړم ── */}
                  <div className="mt-3 flex justify-start border-t border-gray-100 dark:border-gray-700 pt-3">
                    <button
                      type="button"
                      onClick={addItem}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      {pick("بل جنس هم غواړم", "جنس دیگری هم می‌خواهم")}
                    </button>
                  </div>
                </div>
              ))}

              {selectedItems.length === 0 && (
                <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  <p className="mb-2">{pick("هیڅ جنس نه دی زیات شوی.", "هیچ جنسی اضافه نشده است.")}</p>
                  <p className="text-xs">{pick("د جنس اضافه کولو بټن ووهئ.", "دکمه افزودن جنس را بزنید.")}</p>
                </div>
              )}

              {selectedItems.length > 0 && (() => {
                const grandTotal = selectedItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0);
                if (grandTotal <= 0) return null;
                return (
                  <div className="flex items-center justify-between px-4 py-3 mt-2 rounded-xl bg-primary/5 border border-primary/20">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      {pick("ټولټال مجموعه:", "مجموع کل:")}
                    </span>
                    <span className="text-lg font-black text-primary">
                      {"\u060B"} {grandTotal.toLocaleString()}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="flex justify-end gap-4 border-t pt-6 dark:border-gray-700">
            <button type="button" onClick={() => navigate("/requests")}
              className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 transition font-medium">
              {pick("لغوه کول", "لغو")}
            </button>
            <Button type="submit" disabled={loading || selectedItems.length === 0}>
              {loading ? pick("ثبتیږي...", "در حال ثبت...") : pick("غوښتنه ثبتول", "ثبت درخواست")}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
