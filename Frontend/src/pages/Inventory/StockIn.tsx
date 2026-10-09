import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Button from "../../components/ui/button/Button";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";

interface InventoryItem {
  id: number;
  item_code: string;
  name_ps: string;
  name_fa: string;
  current_stock: number;
  unit_name?: string;
  category_name?: string;
}

export default function StockIn() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [itemSearch, setItemSearch] = useState("");

  const [form, setForm] = useState({
    quantity: 1,
    unit_price: 0,
    supplier_name: "",
    document_reference: "",
    source_type: "تدارکات",
    notes: "",
    received_by: "",
    entry_date: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const loadItem = useCallback(async (itemId: string) => {
    setFetching(true);
    try {
      const res = await apiClient.get(`/inventory/items/${itemId}`);
      setItem(res.data || res);
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setFetching(true);
    try {
      const res = await apiClient.get("/inventory/items");
      setItems(res.data || res);
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (id) { loadItem(id); }
    else { loadItems(); }
  }, [id, loadItem, loadItems]);

  // Pre-fill received_by from logged-in user
  useEffect(() => {
    if (profile?.name && !form.received_by) {
      setForm(p => ({ ...p, received_by: profile.name }));
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!id) return;
    if (form.quantity < 1) { setError("مقدار باید له یو زیات وي."); return; }
    setLoading(true);
    try {
      await apiClient.post("/inventory/stock-in", {
        item_id: Number(id),
        quantity: form.quantity,
        unit_price: form.unit_price || undefined,
        supplier_name: form.supplier_name || undefined,
        document_reference: form.document_reference || undefined,
        source_type: form.source_type || undefined,
        notes: [
          form.notes,
          form.received_by ? `ثبت کوونکی: ${form.received_by}` : "",
          form.entry_date ? `د داخلولو نیټه: ${form.entry_date}` : "",
        ].filter(Boolean).join(" | ") || undefined,
      });
      setSuccess(true);
      setTimeout(() => navigate("/inventory/items"), 1500);
    } catch (err: any) {
      setError(err.message || "خطا پیښه شوه.");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(i => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return true;
    return (i.name_ps || "").toLowerCase().includes(q) ||
      (i.name_fa || "").toLowerCase().includes(q) ||
      (i.item_code || "").toLowerCase().includes(q) ||
      (i.category_name || "").toLowerCase().includes(q);
  });

  const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
  const labelCls = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";

  const totalPrice = (form.quantity || 0) * (form.unit_price || 0);

  if (fetching) {
    return <div className="p-10 text-center text-gray-500 dark:text-gray-400" dir="rtl">بارول...</div>;
  }

  if (!id) {
    return (
      <>
        <PageMeta title="جنس انتخاب | Kandahar University WMS" description="د داخلولو لپاره جنس انتخاب کړئ" />
        <Breadcrumb pageTitle="د جنس داخلول / ورود جنس" />
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]" dir="rtl">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">د داخلولو لپاره جنس انتخاب کړئ:</h3>
          <input
            type="text"
            value={itemSearch}
            onChange={e => setItemSearch(e.target.value)}
            placeholder="لټون..."
            className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map(i => (
              <button key={i.id} onClick={() => navigate(`/inventory/stock-in/${i.id}`)}
                className="flex flex-col p-4 border rounded-xl hover:border-primary hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors dark:border-gray-700 text-right">
                <span className="font-bold text-gray-800 dark:text-white/90">{i.name_ps}</span>
                <span className="text-xs text-gray-400 font-mono mt-0.5">{i.item_code}</span>
                <span className={`text-sm mt-1 ${i.current_stock === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                  موجودي: {i.current_stock} {i.unit_name}
                </span>
              </button>
            ))}
          </div>
          {filteredItems.length === 0 && <p className="text-center text-gray-400 py-6">هیڅ جنس ونه موندل شو.</p>}
        </div>
      </>
    );
  }

  if (!item) {
    return <div className="p-10 text-center text-red-500" dir="rtl">جنس ونه موندل شو.</div>;
  }

  return (
    <>
      <PageMeta title="د جنس داخلول | Kandahar University WMS" description="ګودام ته د جنس داخلول" />
      <Breadcrumb pageTitle="د جنس داخلول / ورود جنس به ګدام" />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] max-w-2xl mx-auto" dir="rtl">
        <div className="mb-6 border-b pb-4 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white/90">{item.name_ps}</h2>
          <div className="flex flex-wrap gap-3 mt-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              اوسنۍ موجودي: <span className={`font-bold ${item.current_stock === 0 ? 'text-red-500' : 'text-green-600'}`}>{item.current_stock} {item.unit_name}</span>
            </span>
            <span className="text-xs font-mono text-gray-400">{item.item_code}</span>
          </div>
        </div>

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-green-700 text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
            ✓ موجودي بریالیتوب سره زیاته شوه!
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Quantity + Unit Price + Total */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>داخلېدونکی مقدار <span className="text-red-500">*</span></label>
              <input type="number" value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))}
                min="1" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>قیمت دانه (؋)</label>
              <input type="number" value={form.unit_price || ""}
                onChange={e => setForm(p => ({ ...p, unit_price: Number(e.target.value) }))}
                min="0" placeholder="اختیاري" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>مجموعي قیمت (؋)</label>
              <div className={`${inputCls} bg-gray-50 dark:bg-gray-800 font-bold text-primary cursor-not-allowed`}>
                {totalPrice > 0 ? totalPrice.toLocaleString("fa-AF") : "—"}
              </div>
            </div>
          </div>

          {/* Date + Received by */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>د داخلولو نیټه <span className="text-red-500">*</span></label>
              <input type="date" value={form.entry_date}
                onChange={e => setForm(p => ({ ...p, entry_date: e.target.value }))}
                required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>ثبت کوونکی (شخص) <span className="text-red-500">*</span></label>
              <input type="text" value={form.received_by}
                onChange={e => setForm(p => ({ ...p, received_by: e.target.value }))}
                required placeholder="د ثبت کوونکي نوم..." className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>عرضه کوونکی / شرکت</label>
            <input type="text" value={form.supplier_name}
              onChange={e => setForm(p => ({ ...p, supplier_name: e.target.value }))}
              placeholder="د عرضه کوونکي نوم..." className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>سند / د حواله شمیره</label>
            <input type="text" value={form.document_reference}
              onChange={e => setForm(p => ({ ...p, document_reference: e.target.value }))}
              placeholder="د سند یا حوالې شمیره..." className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>د داخلولو سرچینه</label>
            <select value={form.source_type} onChange={e => setForm(p => ({ ...p, source_type: e.target.value }))} className={inputCls}>
              <option value="تدارکات">تدارکات</option>
              <option value="هدیه / اهدا">هدیه / اهدا</option>
              <option value="لیږدول">لیږدول</option>
              <option value="بیرته راستنیدل">بیرته راستنیدل</option>
              <option value="نور">نور</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>یادښت</label>
            <textarea value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2} placeholder="اختیاري یادښت..."
              className={inputCls + " resize-none"} />
          </div>

          <div className="flex justify-end gap-4 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/inventory/items")}>لغوه کول</Button>
            <Button type="submit" disabled={loading || success}>
              {loading ? "ثبتیږي..." : "د جنس داخلول"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
