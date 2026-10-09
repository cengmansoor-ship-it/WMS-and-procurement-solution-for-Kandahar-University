import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { budgetService, BudgetBab, BudgetFasl } from "../../services/budget";

interface LookupItem { id: number; name_ps: string; name_fa: string; }

export default function EditItem() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [stockQty, setStockQty] = useState(0);
  const [stockDirection, setStockDirection] = useState<'IN' | 'OUT'>('IN');
  const [stockAdjusting, setStockAdjusting] = useState(false);
  const [stockError, setStockError] = useState("");
  const [formData, setFormData] = useState({
    name_ps: "",
    name_fa: "",
    description: "",
    category_id: "",
    unit_id: "",
    warehouse_id: "",
    minimum_stock: 0,
    unit_price: 0,
    supplier_source: "",
    bab_id: "",
    fasl_id: "",
  });

  const [categories, setCategories] = useState<LookupItem[]>([]);
  const [units, setUnits] = useState<LookupItem[]>([]);
  const [warehouses, setWarehouses] = useState<LookupItem[]>([]);
  const [babs, setBabs] = useState<BudgetBab[]>([]);
  const [fasls, setFasls] = useState<BudgetFasl[]>([]);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name_ps: "", name_fa: "", description: "" });
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState("");

  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnit, setNewUnit] = useState({ name_ps: "", name_fa: "", symbol: "" });
  const [addUnitLoading, setAddUnitLoading] = useState(false);
  const [addUnitError, setAddUnitError] = useState("");

  const selectCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
  const inputCls = "mb-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

  useEffect(() => {
    Promise.all([
      apiClient.get('/inventory/categories').then(setCategories).catch(() => {}),
      apiClient.get('/inventory/units').then(setUnits).catch(() => {}),
      apiClient.get('/inventory/warehouses').then(setWarehouses).catch(() => {}),
      budgetService.getBabs().then(setBabs).catch(() => setBabs([])),
    ]);
  }, []);

  useEffect(() => {
    if (!id) return;
    setFetching(true);
    apiClient.get(`/inventory/items/${id}`)
      .then((item: any) => {
        setCurrentStock(Number(item.current_stock) ?? null);
        setFormData({
          name_ps: item.name_ps || item.name || "",
          name_fa: item.name_fa || "",
          description: item.description || "",
          category_id: item.category_id ? String(item.category_id) : "",
          unit_id: item.unit_id ? String(item.unit_id) : "",
          warehouse_id: item.warehouse_id ? String(item.warehouse_id) : "",
          minimum_stock: Number(item.minimum_stock) || 0,
          unit_price: Number(item.unit_price) || 0,
          supplier_source: item.supplier_source || "",
          bab_id: item.bab_id ? String(item.bab_id) : "",
          fasl_id: item.fasl_id ? String(item.fasl_id) : "",
        });
        if (item.bab_id) {
          budgetService.getFaslsByBab(Number(item.bab_id)).then(setFasls).catch(() => setFasls([]));
        }
      })
      .catch(() => setError("جنس ونه موندل شو."))
      .finally(() => setFetching(false));
  }, [id]);

  useEffect(() => {
    if (formData.bab_id) {
      budgetService.getFaslsByBab(Number(formData.bab_id)).then(setFasls).catch(() => setFasls([]));
    } else {
      setFasls([]);
    }
  }, [formData.bab_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === "minimum_stock" || name === "unit_price") ? Number(value) : value,
    }));
  };

  const handleAddCategory = async () => {
    setAddCategoryError("");
    if (!newCategory.name_ps || !newCategory.name_fa) {
      setAddCategoryError("د پښتو نوم او د دري نوم اړین دي.");
      return;
    }
    setAddCategoryLoading(true);
    try {
      const created = await apiClient.post('/inventory/categories', newCategory);
      setCategories(prev => [...prev, created].sort((a, b) => (a.name_ps || "").localeCompare(b.name_ps || "")));
      setFormData(prev => ({ ...prev, category_id: String(created.id) }));
      setNewCategory({ name_ps: "", name_fa: "", description: "" });
      setShowAddCategory(false);
    } catch (err: any) {
      setAddCategoryError(err.message || "خطا د کټګوري ثبتولو کې");
    } finally {
      setAddCategoryLoading(false);
    }
  };

  const handleAddUnit = async () => {
    setAddUnitError("");
    if (!newUnit.name_ps || !newUnit.name_fa) {
      setAddUnitError("د پښتو نوم او د دري نوم اړین دي.");
      return;
    }
    setAddUnitLoading(true);
    try {
      const created = await apiClient.post('/inventory/units', newUnit);
      setUnits(prev => [...prev, created].sort((a, b) => (a.name_ps || "").localeCompare(b.name_ps || "")));
      setFormData(prev => ({ ...prev, unit_id: String(created.id) }));
      setNewUnit({ name_ps: "", name_fa: "", symbol: "" });
      setShowAddUnit(false);
    } catch (err: any) {
      setAddUnitError(err.message || "خطا د واحد ثبتولو کې");
    } finally {
      setAddUnitLoading(false);
    }
  };

  const handleStockAdjust = async (type: 'IN' | 'OUT') => {
    if (!id || stockQty <= 0) return;
    setStockAdjusting(true);
    setStockError("");
    try {
      const endpoint = type === 'IN' ? '/inventory/stock-in' : '/inventory/stock-out';
      await apiClient.post(endpoint, { item_id: Number(id), quantity: stockQty, notes: 'د EditItem فورم نه د مقدار تنظیم' });
      setCurrentStock(prev => prev !== null ? (type === 'IN' ? prev + stockQty : prev - stockQty) : prev);
      setStockQty(1);
    } catch (e: any) {
      setStockError(e.message?.includes('insufficient') ? 'موجودي کافي نه ده!' : (e.message || 'خطا'));
    } finally {
      setStockAdjusting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user || !profile) return;
    if (!formData.name_ps || !formData.category_id || !formData.unit_id) {
      alert("مهرباني وکړئ ټول اړین معلومات دننه کړئ.");
      return;
    }
    setLoading(true);
    setStockError("");
    try {
      await apiClient.put(`/inventory/items/${id}`, {
        ...formData,
        category_id: Number(formData.category_id) || null,
        unit_id: Number(formData.unit_id) || null,
        warehouse_id: Number(formData.warehouse_id) || null,
        bab_id: formData.bab_id ? Number(formData.bab_id) : null,
        fasl_id: formData.fasl_id ? Number(formData.fasl_id) : null,
      });
      if (stockQty > 0) {
        await handleStockAdjust(stockDirection);
      }
      navigate("/inventory/items");
    } catch (err: any) {
      alert("خطا د سمولو کې: " + (err.message || "نامعلوم خطا"));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-10 text-center text-gray-500">بارول...</div>;
  if (error) return <div className="p-10 text-center text-red-500">{error}</div>;

  return (
    <>
      <PageMeta title="د جنس سمول | Kandahar University WMS" description="د جنس معلومات سمول" />
      <Breadcrumb pageTitle="د جنس سمول / ویرایش جنس" />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">

          {/* Stock adjustment — same style as other form fields */}
          {currentStock !== null && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1">
                  <Label>مقدار</Label>
                </div>
                <Input
                  type="number"
                  value={stockQty}
                  onChange={e => setStockQty(Math.max(0, Number(e.target.value)))}
                  min="0"
                  placeholder="مقدار دننه کړئ"
                />
                {stockError && <p className="text-xs text-red-500 mt-1">{stockError}</p>}
              </div>
              <div className="flex flex-col justify-end">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">د مقدار تنظیم د ساتل بټن سره یوځای ثبتیږي</p>
                <select
                  value={stockDirection}
                  onChange={e => setStockDirection(e.target.value as 'IN' | 'OUT')}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-800 dark:text-white outline-none focus:border-primary"
                  dir="rtl"
                >
                  <option value="IN">▲ زیاتول (موجودي اضافه)</option>
                  <option value="OUT">▼ کمول (موجودي کمه)</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>د جنس نوم (پښتو) <span className="text-error-500">*</span></Label>
              <Input name="name_ps" value={formData.name_ps} onChange={handleChange} placeholder="د جنس پښتو نوم" required />
            </div>
            <div>
              <Label>نام جنس (دری)</Label>
              <Input name="name_fa" value={formData.name_fa} onChange={handleChange} placeholder="نام جنس به دری" />
            </div>
          </div>

          <div>
            <Label>مشخصات / توضیحات</Label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              placeholder="د جنس مشخصات..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-1" dir="rtl">
                <Label>کټګوري / دسته‌بندی <span className="text-error-500">*</span></Label>
                <button type="button"
                  onClick={() => { setShowAddCategory(v => !v); setAddCategoryError(""); }}
                  className="text-xs text-green-600 hover:underline dark:text-green-400">
                  {showAddCategory ? "✕ بندول" : "+ نوی کټګوري"}
                </button>
              </div>
              {showAddCategory && (
                <div className="mb-2 rounded-lg border border-green-200 bg-white dark:bg-gray-900 dark:border-green-900/40 p-3 space-y-2" dir="rtl">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400">د نوي کټګوري اضافه کول</p>
                  <input placeholder="د پښتو نوم *" value={newCategory.name_ps} onChange={e => setNewCategory(p => ({ ...p, name_ps: e.target.value }))} className={inputCls} dir="rtl" />
                  <input placeholder="نام دری *" value={newCategory.name_fa} onChange={e => setNewCategory(p => ({ ...p, name_fa: e.target.value }))} className={inputCls} dir="rtl" />
                  <input placeholder="توضیحات (اختیاري)" value={newCategory.description} onChange={e => setNewCategory(p => ({ ...p, description: e.target.value }))} className={inputCls} dir="rtl" />
                  {addCategoryError && <p className="text-xs text-red-500">{addCategoryError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={handleAddCategory} disabled={addCategoryLoading}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition">
                      {addCategoryLoading ? "ثبتېږي..." : "✓ ثبتول"}
                    </button>
                    <button type="button" onClick={() => setShowAddCategory(false)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                      لغوه
                    </button>
                  </div>
                </div>
              )}
              <select name="category_id" value={formData.category_id} onChange={handleChange} className={selectCls} required>
                <option value="">-- کټګوري انتخاب کړئ --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name_ps || c.name_fa}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1" dir="rtl">
                <Label>واحد <span className="text-error-500">*</span></Label>
                <button type="button"
                  onClick={() => { setShowAddUnit(v => !v); setAddUnitError(""); }}
                  className="text-xs text-green-600 hover:underline dark:text-green-400">
                  {showAddUnit ? "✕ بندول" : "+ نوی واحد"}
                </button>
              </div>
              {showAddUnit && (
                <div className="mb-2 rounded-lg border border-green-200 bg-white dark:bg-gray-900 dark:border-green-900/40 p-3 space-y-2" dir="rtl">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400">د نوي واحد اضافه کول</p>
                  <input placeholder="د پښتو نوم * (مثلاً: دانه)" value={newUnit.name_ps} onChange={e => setNewUnit(p => ({ ...p, name_ps: e.target.value }))} className={inputCls} dir="rtl" />
                  <input placeholder="نام دری * (مثلاً: عدد)" value={newUnit.name_fa} onChange={e => setNewUnit(p => ({ ...p, name_fa: e.target.value }))} className={inputCls} dir="rtl" />
                  <input placeholder="سمبول (اختیاري، مثلاً: pcs)" value={newUnit.symbol} onChange={e => setNewUnit(p => ({ ...p, symbol: e.target.value }))} className={inputCls} dir="ltr" />
                  {addUnitError && <p className="text-xs text-red-500">{addUnitError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={handleAddUnit} disabled={addUnitLoading}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition">
                      {addUnitLoading ? "ثبتېږي..." : "✓ ثبتول"}
                    </button>
                    <button type="button" onClick={() => setShowAddUnit(false)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                      لغوه
                    </button>
                  </div>
                </div>
              )}
              <select name="unit_id" value={formData.unit_id} onChange={handleChange} className={selectCls} required>
                <option value="">-- واحد انتخاب کړئ --</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>{u.name_ps || u.name_fa}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>ګدام / انبار</Label>
            <select name="warehouse_id" value={formData.warehouse_id} onChange={handleChange} className={selectCls}>
              <option value="">-- ګدام انتخاب کړئ --</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name_ps || w.name_fa}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>کمترین حد / حداقل موجودی</Label>
              <Input type="number" name="minimum_stock" value={formData.minimum_stock} onChange={handleChange} min="0" />
            </div>
            <div>
              <Label>قیمت دانه / قیمت واحد (افغانۍ)</Label>
              <Input type="number" name="unit_price" value={formData.unit_price} onChange={handleChange} min="0" />
            </div>
          </div>

          <div>
            <Label>عرضه کوونکی / تامین‌کننده</Label>
            <Input name="supplier_source" value={formData.supplier_source} onChange={handleChange} placeholder="د عرضه کوونکي نوم" />
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">د بودجې طبقه‌بندي (باب / فصل) — اختیاري</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>باب</Label>
                <select name="bab_id" value={formData.bab_id} onChange={handleChange} className={selectCls}>
                  <option value="">-- باب انتخاب کړئ --</option>
                  {babs.map(b => (
                    <option key={b.id} value={b.id}>{b.bab_code} — {b.name_ps}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>فصل</Label>
                <select name="fasl_id" value={formData.fasl_id} onChange={handleChange} className={selectCls} disabled={!formData.bab_id || fasls.length === 0}>
                  <option value="">-- فصل انتخاب کړئ --</option>
                  {fasls.map(f => (
                    <option key={f.id} value={f.id}>{f.fasl_code} — {f.name_ps}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/inventory/items")}>لغوه کول</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "ساتل کیږي..." : "ساتل / ذخیره"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
