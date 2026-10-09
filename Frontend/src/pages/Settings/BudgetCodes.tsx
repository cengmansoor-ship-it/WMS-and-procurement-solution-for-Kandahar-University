import { useState, useEffect, useCallback } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import SecureDeleteModal from "../../components/common/SecureDeleteModal";
import { budgetService, BudgetBab, BudgetFasl } from "../../services/budget";
import { useAuth } from "../../context/AuthContext";

type EditTarget = { type: "bab"; item: BudgetBab } | { type: "fasl"; item: BudgetFasl };

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white/90";

const emptyBab = { bab_code: "", name_ps: "", name_fa: "", description: "" };
const emptyFasl = { fasl_code: "", name_ps: "", name_fa: "", description: "" };

export default function BudgetCodes() {
  const { profile } = useAuth();
  const [babs, setBabs] = useState<BudgetBab[]>([]);
  const [fasls, setFasls] = useState<Record<number, BudgetFasl[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [faslsLoading, setFaslsLoading] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");

  const [showAddBab, setShowAddBab] = useState(false);
  const [newBab, setNewBab] = useState({ ...emptyBab });
  const [addBabLoading, setAddBabLoading] = useState(false);
  const [addBabError, setAddBabError] = useState("");

  const [addFaslFor, setAddFaslFor] = useState<number | null>(null);
  const [newFasl, setNewFasl] = useState({ ...emptyFasl });
  const [addFaslLoading, setAddFaslLoading] = useState(false);
  const [addFaslError, setAddFaslError] = useState("");

  // Budget Ceilings state
  const [ceilings, setCeilings] = useState<any[]>([]);
  const [ceilingsLoading, setCeilingsLoading] = useState(false);
  const [showAddCeiling, setShowAddCeiling] = useState(false);
  const [newCeiling, setNewCeiling] = useState({ bab_id: "", fiscal_year: "1404", ceiling_amount: "", notes: "" });
  const [saveCeilingLoading, setSaveCeilingLoading] = useState(false);
  const [ceilingError, setCeilingError] = useState("");
  const [deletingCeiling, setDeletingCeiling] = useState<number | null>(null);

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editForm, setEditForm] = useState({ bab_code: "", name_ps: "", name_fa: "", description: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "bab" | "fasl"; id: number; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const loadBabs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await budgetService.getBabs();
      setBabs(data);
    } catch {
      showToast("د بابونو لوستل ونشول", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBabs(); }, [loadBabs]);

  const loadCeilings = useCallback(async () => {
    setCeilingsLoading(true);
    try {
      const res = await fetch("/api/budget/ceilings");
      const json = await res.json();
      if (json.success) setCeilings(json.data || []);
    } catch {}
    finally { setCeilingsLoading(false); }
  }, []);

  useEffect(() => { loadCeilings(); }, [loadCeilings]);

  const handleSaveCeiling = async () => {
    setCeilingError("");
    if (!newCeiling.bab_id || !newCeiling.ceiling_amount || !newCeiling.fiscal_year) {
      setCeilingError("باب، مالي کال او سقف اړین دي."); return;
    }
    setSaveCeilingLoading(true);
    try {
      const res = await fetch("/api/budget/ceilings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bab_id: Number(newCeiling.bab_id),
          fiscal_year: newCeiling.fiscal_year,
          ceiling_amount: Number(newCeiling.ceiling_amount),
          notes: newCeiling.notes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        await loadCeilings();
        setNewCeiling({ bab_id: "", fiscal_year: "1404", ceiling_amount: "", notes: "" });
        setShowAddCeiling(false);
        showToast("د بودجې سقف ثبت شو");
      } else {
        setCeilingError(json.message || "خطا");
      }
    } catch { setCeilingError("د سرور خطا"); }
    finally { setSaveCeilingLoading(false); }
  };

  const handleDeleteCeiling = async (id: number) => {
    setDeletingCeiling(id);
    try {
      const res = await fetch(`/api/budget/ceilings/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) { await loadCeilings(); showToast("سقف حذف شو"); }
    } catch {}
    finally { setDeletingCeiling(null); }
  };

  const toggleBab = async (bab: BudgetBab) => {
    const id = bab.id;
    if (expanded.has(id)) {
      setExpanded(prev => { const s = new Set(prev); s.delete(id); return s; });
      return;
    }
    setExpanded(prev => new Set(prev).add(id));
    if (!fasls[id]) {
      setFaslsLoading(prev => new Set(prev).add(id));
      try {
        const data = await budgetService.getFaslsByBab(id);
        setFasls(prev => ({ ...prev, [id]: data }));
      } catch {
        showToast("د فصلونو لوستل ونشول", false);
      } finally {
        setFaslsLoading(prev => { const s = new Set(prev); s.delete(id); return s; });
      }
    }
  };

  const handleAddBab = async () => {
    setAddBabError("");
    if (!newBab.bab_code || !newBab.name_ps || !newBab.name_fa) {
      setAddBabError("کود، د پښتو نوم او د دري نوم اړین دي."); return;
    }
    setAddBabLoading(true);
    try {
      const created = await budgetService.createBab(newBab);
      setBabs(prev => [...prev, created].sort((a, b) => a.bab_code.localeCompare(b.bab_code)));
      setNewBab({ ...emptyBab });
      setShowAddBab(false);
      showToast(`باب ${created.bab_code} ثبت شو`);
    } catch (e: any) {
      setAddBabError(e.message || "خطا");
    } finally {
      setAddBabLoading(false);
    }
  };

  const handleAddFasl = async (babId: number) => {
    setAddFaslError("");
    if (!newFasl.fasl_code || !newFasl.name_ps || !newFasl.name_fa) {
      setAddFaslError("کود، د پښتو نوم او د دري نوم اړین دي."); return;
    }
    setAddFaslLoading(true);
    try {
      const created = await budgetService.createFasl({ ...newFasl, bab_id: babId });
      setFasls(prev => ({
        ...prev,
        [babId]: [...(prev[babId] || []), created].sort((a, b) => a.fasl_code.localeCompare(b.fasl_code))
      }));
      setNewFasl({ ...emptyFasl });
      setAddFaslFor(null);
      showToast(`فصل ${created.fasl_code} ثبت شو`);
    } catch (e: any) {
      setAddFaslError(e.message || "خطا");
    } finally {
      setAddFaslLoading(false);
    }
  };

  const openEdit = (target: EditTarget) => {
    setEditTarget(target);
    setEditError("");
    if (target.type === "bab") {
      setEditForm({ bab_code: target.item.bab_code, name_ps: target.item.name_ps, name_fa: target.item.name_fa, description: target.item.description || "" });
    } else {
      setEditForm({ bab_code: (target.item as BudgetFasl).fasl_code, name_ps: target.item.name_ps, name_fa: target.item.name_fa, description: target.item.description || "" });
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setEditLoading(true);
    setEditError("");
    try {
      if (editTarget.type === "bab") {
        const updated = await budgetService.updateBab(editTarget.item.id, {
          bab_code: editForm.bab_code, name_ps: editForm.name_ps, name_fa: editForm.name_fa, description: editForm.description
        });
        setBabs(prev => prev.map(b => b.id === editTarget.item.id ? { ...b, ...updated } : b).sort((a, b) => a.bab_code.localeCompare(b.bab_code)));
        showToast("باب سمون وشو");
      } else {
        const fasl = editTarget.item as BudgetFasl;
        const updated = await budgetService.updateFasl(editTarget.item.id, {
          fasl_code: editForm.bab_code, name_ps: editForm.name_ps, name_fa: editForm.name_fa, description: editForm.description
        });
        setFasls(prev => ({
          ...prev,
          [fasl.bab_id]: (prev[fasl.bab_id] || []).map(f => f.id === fasl.id ? { ...f, ...updated } : f).sort((a, b) => a.fasl_code.localeCompare(b.fasl_code))
        }));
        showToast("فصل سمون وشو");
      }
      setEditTarget(null);
    } catch (e: any) {
      setEditError(e.message || "خطا");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      if (deleteConfirm.type === "bab") {
        await budgetService.deleteBab(deleteConfirm.id);
        setBabs(prev => prev.filter(b => b.id !== deleteConfirm.id));
        setFasls(prev => { const n = { ...prev }; delete n[deleteConfirm.id]; return n; });
        setExpanded(prev => { const s = new Set(prev); s.delete(deleteConfirm.id); return s; });
      } else {
        await budgetService.deleteFasl(deleteConfirm.id);
        setFasls(prev => {
          const next = { ...prev };
          for (const babId in next) {
            next[babId] = next[babId].filter(f => f.id !== deleteConfirm.id);
          }
          return next;
        });
      }
      showToast(`${deleteConfirm.type === "bab" ? "باب" : "فصل"} حذف شو`);
      setDeleteConfirm(null);
    } catch (e: any) {
      const msg = e.message || "خطا";
      setDeleteError(msg.includes("در استفاده") || msg.includes("in_use") || msg.includes("تړلی")
        ? (deleteConfirm.type === "bab" ? "دا باب د اجناسو سره تړلی دی." : "دا فصل د اجناسو سره تړلی دی.")
        : msg
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredBabs = babs.filter(b =>
    !search ||
    b.bab_code.toLowerCase().includes(search.toLowerCase()) ||
    b.name_ps.includes(search) ||
    b.name_fa.includes(search)
  );

  const totalFasls = Object.values(fasls).reduce((s, arr) => s + arr.length, 0);

  return (
    <>
      <PageMeta title="د بودجې طبقه‌بندي | Kandahar University WMS" description="" />
      <Breadcrumb pageTitle="د بودجې طبقه‌بندي / طبقه‌بندی بودجه" />

      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all animate-fade-in ${toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"}`} dir="rtl">
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-6 space-y-4" dir="rtl">
            <h3 className="text-base font-bold text-gray-800 dark:text-white/90">
              {editTarget.type === "bab" ? "د باب سمون" : "د فصل سمون"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  {editTarget.type === "bab" ? "د باب کود" : "د فصل کود"}
                </label>
                <input value={editForm.bab_code} onChange={e => setEditForm(p => ({ ...p, bab_code: e.target.value }))} className={inputCls} dir="ltr" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">د پښتو نوم</label>
                <input value={editForm.name_ps} onChange={e => setEditForm(p => ({ ...p, name_ps: e.target.value }))} className={inputCls} dir="rtl" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">نام دری</label>
                <input value={editForm.name_fa} onChange={e => setEditForm(p => ({ ...p, name_fa: e.target.value }))} className={inputCls} dir="rtl" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">توضیحات</label>
                <input value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} className={inputCls} dir="rtl" />
              </div>
            </div>
            {editError && <p className="text-xs text-red-500">{editError}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">لغوه</button>
              <button onClick={handleEdit} disabled={editLoading} className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-opacity-90 disabled:opacity-50 transition">
                {editLoading ? "ذخیره..." : "✓ ذخیره کول"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <SecureDeleteModal
          title={`⚠️ د «${deleteConfirm.name}» حذف کول`}
          description={`${deleteConfirm.type === "bab" ? "باب" : "فصل"} «${deleteConfirm.name}» به دایمي حذف کیږي.`}
          currentUserEmail={profile?.email || ""}
          requireReason={true}
          onCancel={() => { setDeleteConfirm(null); setDeleteError(""); }}
          onConfirm={(_reason) => handleDelete()}
        />
      )}

      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4" dir="rtl">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">د بودجې طبقه‌بندي</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {babs.length} باب &nbsp;·&nbsp; {totalFasls > 0 ? `${totalFasls}+ فصل لوډ شوی` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddBab(v => !v); setAddBabError(""); setNewBab({ ...emptyBab }); }}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 transition"
              >
                {showAddBab ? "✕ بندول" : "+ نوی باب اضافه کول"}
              </button>
            </div>
          </div>

          {showAddBab && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/10 p-4" dir="rtl">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">+ نوی باب ثبتول</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">کود <span className="text-red-500">*</span></label>
                  <input placeholder="مثلاً: 230" value={newBab.bab_code} onChange={e => setNewBab(p => ({ ...p, bab_code: e.target.value }))} className={inputCls} dir="ltr" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">توضیحات</label>
                  <input placeholder="لنډه توضیح" value={newBab.description} onChange={e => setNewBab(p => ({ ...p, description: e.target.value }))} className={inputCls} dir="rtl" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">د پښتو نوم <span className="text-red-500">*</span></label>
                  <input placeholder="د پښتو نوم" value={newBab.name_ps} onChange={e => setNewBab(p => ({ ...p, name_ps: e.target.value }))} className={inputCls} dir="rtl" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">نام دری <span className="text-red-500">*</span></label>
                  <input placeholder="نام دری" value={newBab.name_fa} onChange={e => setNewBab(p => ({ ...p, name_fa: e.target.value }))} className={inputCls} dir="rtl" />
                </div>
              </div>
              {addBabError && <p className="text-xs text-red-500 mb-2">{addBabError}</p>}
              <div className="flex gap-2">
                <button onClick={handleAddBab} disabled={addBabLoading}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 transition">
                  {addBabLoading ? "ثبتېږي..." : "✓ ثبتول"}
                </button>
                <button onClick={() => setShowAddBab(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">لغوه</button>
              </div>
            </div>
          )}

          <div className="mb-4" dir="rtl">
            <div className="relative">
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="د باب لټون... (کود یا نوم)"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-4 text-sm text-right text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white/90" dir="rtl" />
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer h-14 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          ) : filteredBabs.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500" dir="rtl">
              {search ? `"${search}" لپاره هیڅ باب ونه موندل شو` : "هیڅ باب نشته"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBabs.map(bab => (
                <div key={bab.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                    onClick={() => toggleBab(bab)}
                    dir="rtl"
                  >
                    <span className={`text-gray-400 transition-transform duration-200 ${expanded.has(bab.id) ? "rotate-90" : ""}`}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l4 4-4 4V4z" /></svg>
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold">
                      {bab.bab_code}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white/90 truncate">{bab.name_ps}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{bab.name_fa}{bab.description ? ` — ${bab.description}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      {fasls[bab.id] && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 px-2">{fasls[bab.id].length} فصل</span>
                      )}
                      <button
                        onClick={() => openEdit({ type: "bab", item: bab })}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition"
                        title="سمون"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: "bab", id: bab.id, name: `${bab.bab_code} - ${bab.name_ps}` })}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition"
                        title="حذف"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {expanded.has(bab.id) && (
                    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-white/[0.02]">
                      {faslsLoading.has(bab.id) ? (
                        <div className="p-4 space-y-2">
                          {[1, 2, 3].map(i => <div key={i} className="skeleton-shimmer h-9 rounded-lg" />)}
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                          {(fasls[bab.id] || []).length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 px-6 py-4 text-right">هیڅ فصل نشته</p>
                          ) : (
                            (fasls[bab.id] || []).map(fasl => (
                              <div key={fasl.id} className="flex items-center gap-3 px-6 py-2.5 group hover:bg-gray-50 dark:hover:bg-gray-800/30 transition" dir="rtl">
                                <span className="text-gray-200 dark:text-gray-700 text-xs">└</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-mono">
                                  {fasl.fasl_code}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-700 dark:text-white/80 truncate">{fasl.name_ps}</p>
                                  {fasl.name_fa !== fasl.name_ps && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{fasl.name_fa}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                  <button
                                    onClick={() => openEdit({ type: "fasl", item: fasl })}
                                    className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition"
                                    title="سمون"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm({ type: "fasl", id: fasl.id, name: `${fasl.fasl_code} - ${fasl.name_ps}` })}
                                    className="p-1.5 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition"
                                    title="حذف"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))
                          )}

                          {addFaslFor === bab.id ? (
                            <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/10 space-y-2" dir="rtl">
                              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">+ نوی فصل د باب {bab.bab_code} لپاره</p>
                              <div className="grid grid-cols-2 gap-2">
                                <input placeholder="کود *" value={newFasl.fasl_code} onChange={e => setNewFasl(p => ({ ...p, fasl_code: e.target.value }))} className={inputCls} dir="ltr" />
                                <input placeholder="توضیحات" value={newFasl.description} onChange={e => setNewFasl(p => ({ ...p, description: e.target.value }))} className={inputCls} dir="rtl" />
                                <input placeholder="د پښتو نوم *" value={newFasl.name_ps} onChange={e => setNewFasl(p => ({ ...p, name_ps: e.target.value }))} className={inputCls} dir="rtl" />
                                <input placeholder="نام دری *" value={newFasl.name_fa} onChange={e => setNewFasl(p => ({ ...p, name_fa: e.target.value }))} className={inputCls} dir="rtl" />
                              </div>
                              {addFaslError && <p className="text-xs text-red-500">{addFaslError}</p>}
                              <div className="flex gap-2">
                                <button onClick={() => handleAddFasl(bab.id)} disabled={addFaslLoading}
                                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50 transition">
                                  {addFaslLoading ? "ثبتېږي..." : "✓ ثبتول"}
                                </button>
                                <button onClick={() => { setAddFaslFor(null); setAddFaslError(""); setNewFasl({ ...emptyFasl }); }}
                                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                                  لغوه
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="px-6 py-2">
                              <button
                                onClick={() => { setAddFaslFor(bab.id); setAddFaslError(""); setNewFasl({ ...emptyFasl }); }}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline py-1"
                              >
                                + نوی فصل اضافه کول
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Budget Ceilings Card */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden" dir="rtl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">د بودجې سقف تنظیمات</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">د هر باب لپاره کلنی بودجه سقف — چې ٨٠٪ یا ١٠٠٪ ته ورسي SMS خبرتیا لیږل کیږي</p>
            </div>
            <button
              onClick={() => { setShowAddCeiling(p => !p); setCeilingError(""); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:bg-primary/90 transition"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              سقف اضافه کول
            </button>
          </div>

          {showAddCeiling && (
            <div className="px-5 py-4 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20 space-y-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">نوی د بودجې سقف</p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newCeiling.bab_id}
                  onChange={e => setNewCeiling(p => ({ ...p, bab_id: e.target.value }))}
                  className={`${inputCls} col-span-2`}
                >
                  <option value="">باب غوره کړئ *</option>
                  {babs.map(b => (
                    <option key={b.id} value={b.id}>{b.bab_code} — {b.name_ps}</option>
                  ))}
                </select>
                <input
                  placeholder="مالي کال * (مثال: 1404)"
                  value={newCeiling.fiscal_year}
                  onChange={e => setNewCeiling(p => ({ ...p, fiscal_year: e.target.value }))}
                  className={inputCls}
                  dir="ltr"
                />
                <input
                  placeholder="سقف (افغانۍ) *"
                  type="number"
                  min="0"
                  value={newCeiling.ceiling_amount}
                  onChange={e => setNewCeiling(p => ({ ...p, ceiling_amount: e.target.value }))}
                  className={inputCls}
                  dir="ltr"
                />
                <input
                  placeholder="یادداشت"
                  value={newCeiling.notes}
                  onChange={e => setNewCeiling(p => ({ ...p, notes: e.target.value }))}
                  className={`${inputCls} col-span-2`}
                  dir="rtl"
                />
              </div>
              {ceilingError && <p className="text-xs text-red-500">{ceilingError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCeiling}
                  disabled={saveCeilingLoading}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {saveCeilingLoading ? "ثبتېږي..." : "✓ ثبتول"}
                </button>
                <button
                  onClick={() => { setShowAddCeiling(false); setCeilingError(""); }}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  لغوه
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {ceilingsLoading ? (
              <div className="px-5 py-6 text-center text-xs text-gray-400">لوډیږي...</div>
            ) : ceilings.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-gray-400">
                هیڅ بودجه سقف نشته — د پورتنۍ تڼۍ له لارې اضافه کړئ
              </div>
            ) : (
              ceilings.map((c: any) => {
                const pct = Number(c.utilization_percent);
                const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-emerald-500";
                const textColor = pct >= 100 ? "text-red-600 dark:text-red-400" : pct >= 80 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
                return (
                  <div key={c.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{c.bab_code}</span>
                          <span className="text-xs text-gray-600 dark:text-gray-300">{c.name_ps}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">مالي کال: {c.fiscal_year}</span>
                          {c.alert_100_sent ? (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">سقف بشپړ SMS</span>
                          ) : c.alert_80_sent ? (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">٨٠٪ SMS</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">
                            مصرف: <b>{Number(c.spent_value).toLocaleString()}</b> / سقف: <b>{Number(c.ceiling_amount).toLocaleString()}</b> افغانۍ
                          </span>
                          <span className={`text-xs font-bold ${textColor}`}>{pct}٪</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCeiling(c.id)}
                        disabled={deletingCeiling === c.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition disabled:opacity-40"
                        title="حذف"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                        </svg>
                      </button>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]" dir="rtl">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">لارښوونه</h3>
          <ul className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400 list-none">
            <li>• د باب لیدلو لپاره پرې کلیک وکړئ چې د هغه فصلونه ووینئ.</li>
            <li>• د باب یا فصل د سمون لپاره ✏ تڼۍ فشار ورکړئ.</li>
            <li>• هغه بابونه او فصلونه چې د اجناسو سره تړلي وي نشي حذف کیدلی.</li>
            <li>• د نوي باب کود باید ځانګړی وي.</li>
            <li>• د نوي فصل کود باید د هغه باب دننه ځانګړی وي.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
