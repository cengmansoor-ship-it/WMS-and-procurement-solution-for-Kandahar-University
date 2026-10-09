import React, { useEffect, useState, useCallback } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Button from "../../components/ui/button/Button";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";
import { useNavigate } from "react-router";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";
import SecureDeleteModal from "../../components/common/SecureDeleteModal";

interface ChecklistItem {
  id: number;
  original_id: string;
  category: string;
  item_name: string;
  description: string;
  unit: string;
  estimated_price: number;
  item_code: string;
  is_active: boolean;
  inventory_item_id: number | null;
  current_stock: number | null;
  inv_item_name: string | null;
}

interface InvItem { id: number; name_ps: string; name_fa: string; current_stock: number; }

const emptyForm = { category: "", item_name: "", description: "", unit: "", estimated_price: 0, item_code: "", inventory_item_id: "" };

export default function ChecklistManagement() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [invItems, setInvItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCat, setFilterCat] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ChecklistItem | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isSuperAdmin = profile?.role === ROLES.SUPER_ADMIN || profile?.role === ROLES.WAREHOUSE_DIRECTOR;

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCat) params.append("category", filterCat);
      if (filterSearch) params.append("search", filterSearch);
      if (showInactive) params.append("active_only", "false");
      const res = await apiClient.get(`/checklist?${params.toString()}`);
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterCat, filterSearch, showInactive]);

  useEffect(() => {
    apiClient.get("/checklist/categories").then((r: any) => setCategories(Array.isArray(r) ? r : [])).catch(() => {});
    apiClient.get("/inventory/items").then((r: any) => setInvItems(Array.isArray(r) ? r.map((i: any) => ({ id: i.id, name_ps: i.name_ps || i.name || "", name_fa: i.name_fa || "", current_stock: Number(i.current_stock) || 0 })) : [])).catch(() => {});
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10 p-8 text-center" dir="rtl">
        <p className="text-red-700 dark:text-red-400 font-semibold text-lg">لاسرسی نشته</p>
        <p className="text-red-600 dark:text-red-300 mt-2 text-sm">یوازې سوپر ادمین او د ګدام مدیر دې پاڼې ته لاسرسی لري.</p>
        <Button className="mt-4" onClick={() => navigate("/inventory")}>بیرته</Button>
      </div>
    );
  }

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...emptyForm });
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (item: ChecklistItem) => {
    setEditItem(item);
    setForm({
      category: item.category,
      item_name: item.item_name,
      description: item.description || "",
      unit: item.unit || "",
      estimated_price: item.estimated_price || 0,
      item_code: item.item_code || "",
      inventory_item_id: item.inventory_item_id ? String(item.inventory_item_id) : "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.category.trim() || !form.item_name.trim()) {
      setFormError("کټګوري او د جنس نوم اړین دي.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, inventory_item_id: form.inventory_item_id ? Number(form.inventory_item_id) : null };
      if (editItem) {
        await apiClient.put(`/checklist/${editItem.id}`, payload);
      } else {
        await apiClient.post("/checklist", payload);
      }
      setShowModal(false);
      loadItems();
      apiClient.get("/checklist/categories").then((r: any) => setCategories(Array.isArray(r) ? r : [])).catch(() => {});
    } catch (e: any) {
      setFormError(e.message || "خطا پیښه شوه.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      await apiClient.delete(`/checklist/${id}`);
      setDeleteConfirm(null);
      loadItems();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (item: ChecklistItem) => {
    try {
      await apiClient.put(`/checklist/${item.id}`, { is_active: !item.is_active });
      loadItems();
    } catch (e) { console.error(e); }
  };

  const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
  const catColors: Record<string, string> = {
    "صفایي": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    "فرنیچري": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    "کمپیوټري": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    "دفتري": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    "قرطاسیه": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    "ټونر": "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <>
      <PageMeta title="د اجناسو چکلیسټ | Kandahar University WMS" description="د رسمي اجناسو چکلیسټ مدیریت" />
      <Breadcrumb pageTitle="د اجناسو چکلیسټ / چک‌لیست اجناس" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      {deleteConfirm !== null && (
        <SecureDeleteModal
          title="⚠️ د چکلیسټ جنس حذف کول"
          description="ایا ډاډه یاست؟ دا جنس به د چکلیسټ نه لرې شي."
          currentUserEmail={profile?.email || ""}
          requireReason={true}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={(_reason) => {
            const id = deleteConfirm;
            setDeleteConfirm(null);
            handleDelete(id!);
          }}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" dir="rtl">
            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-4">
              {editItem ? "د جنس سمول" : "نوی جنس اضافه کول"}
            </h3>
            {formError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                {formError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">کټګوري <span className="text-red-500">*</span></label>
                <input list="cat-list" value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  placeholder="کټګوري غوره یا ولیکئ" className={inputCls} />
                <datalist id="cat-list">
                  {categories.map(c => <option key={c} value={c} />)}
                  <option value="صفایي" />
                  <option value="فرنیچري" />
                  <option value="کمپیوټري" />
                  <option value="دفتري" />
                  <option value="قرطاسیه" />
                  <option value="ټونر" />
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">د جنس نوم <span className="text-red-500">*</span></label>
                <input type="text" value={form.item_name}
                  onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))}
                  placeholder="د جنس نوم" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">توضیح / مشخصات</label>
                <input type="text" value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="د جنس توضیح یا مشخصات" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">واحد</label>
                  <input type="text" value={form.unit}
                    onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                    placeholder="عدد / ریمه / بسته..." className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">تخمیني نرخ (؋)</label>
                  <input type="number" value={form.estimated_price}
                    onChange={e => setForm(p => ({ ...p, estimated_price: Number(e.target.value) }))}
                    min="0" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">د جنس کوډ</label>
                <input type="text" value={form.item_code}
                  onChange={e => setForm(p => ({ ...p, item_code: e.target.value }))}
                  placeholder="اتوماتیک جوړ کیږي که خالي پرېږدئ" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  🔗 د ګدام اجناسو سره لینک (اتومات موجودي)
                </label>
                <select
                  value={form.inventory_item_id}
                  onChange={e => setForm(p => ({ ...p, inventory_item_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">-- لینک نشته (اختیاري) --</option>
                  {invItems.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name_ps || i.name_fa} — موجودي: {i.current_stock}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">که لینک وکړئ، اوسنۍ موجودي به اتومات ښکاره شي</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">
                لغوه
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-xl py-2.5 text-sm font-bold transition-all">
                {saving ? "ساتل کیږي..." : (editItem ? "ساتل" : "ثبت / اضافه کول")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5" dir="rtl">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">د رسمي اجناسو چکلیسټ</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {loading ? "بارول..." : `ټول ${items.length} جنسونه`}
              </p>
            </div>
            <Button onClick={openAdd}>+ نوی جنس</Button>
          </div>

          <div className="flex flex-wrap gap-3 mb-4" dir="rtl">
            <input
              type="text"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="لټون د نوم، توضیح، کوډ..."
              className="flex-1 min-w-[180px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
              <option value="">ټولې کټګوري</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
                className="rounded border-gray-300" />
              غیرفعال هم وښایه
            </label>
          </div>

          <div className="overflow-x-auto" dir="rtl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">#</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">د جنس کوډ</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">کټګوري</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">د جنس نوم</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">توضیح</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">واحد</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">تخمیني نرخ</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">اوسنۍ موجودي</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">حالت</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={10} className="py-10 text-center text-gray-400">بارول...</td></tr>
                )}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={10} className="py-10 text-center text-gray-400">هیڅ جنس ونه موندل شو.</td></tr>
                )}
                {items.map((item, idx) => (
                  <tr key={item.id} className={`border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">{item.item_code || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${catColors[item.category] || "bg-gray-100 text-gray-600"}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-gray-800 dark:text-white/90">{item.item_name}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs max-w-xs truncate">{item.description || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 text-xs">{item.unit || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200 font-mono text-xs">
                      {item.estimated_price ? `${Number(item.estimated_price).toLocaleString()} ؋` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {item.inventory_item_id ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          item.current_stock === 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                          item.current_stock !== null && item.current_stock <= 5 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        }`}>
                          {item.current_stock ?? 0}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => handleToggleActive(item)}
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${item.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {item.is_active ? "فعال" : "غیرفعال"}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(item)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="سمول">
                          ✏️
                        </button>
                        <button onClick={() => setDeleteConfirm(item.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="ړنګول">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
