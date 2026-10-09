import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";
import { apiClient } from "../../api/apiClient";
import { getHijriShamsiDate } from "../../utils/dateUtils";
import { useAuth } from "../../context/AuthContext";

interface EligibleReceipt {
  original_transaction_id: number;
  item_id: number;
  item_code: string;
  item_name: string;
  item_name_fa?: string;
  current_stock: number;
  unit_name?: string;
  received_quantity: number;
  returned_quantity: number;
  receipt_remaining: number;
  returnable_quantity: number;
  supplier_name?: string;
  document_reference?: string;
  source_type?: string;
  created_at: string;
}

interface ReturnRecord {
  id: number;
  return_number: string;
  item_code: string;
  item_name: string;
  unit_name?: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  supplier_name?: string;
  returned_to: string;
  return_reference?: string;
  reason: string;
  condition_status?: string;
  returned_by_name?: string;
  created_at: string;
}

interface ReturnSuccess {
  return_number: string;
  item_name: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
}

const parseApiError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const jsonStart = message.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const body = JSON.parse(message.slice(jsonStart));
      if (body?.message) return body.message;
    } catch {
      // The API may return a plain-text error; use the original message below.
    }
  }
  return message || "د واپسي د ثبت پر مهال تخنیکي ستونزه رامنځته شوه.";
};

export default function StockReturn() {
  const { profile } = useAuth();
  const [eligible, setEligible] = useState<EligibleReceipt[]>([]);
  const [recent, setRecent] = useState<ReturnRecord[]>([]);
  const [selected, setSelected] = useState<EligibleReceipt | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<ReturnSuccess | null>(null);
  const [form, setForm] = useState({
    quantity: 1,
    returned_to: "",
    return_reference: "",
    reason: "د کیفیت ستونزه",
    condition_status: "QUALITY_REJECTED",
    notes: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [eligibleRows, returnRows] = await Promise.all([
        apiClient.get("/inventory/returns/eligible"),
        apiClient.get("/inventory/returns"),
      ]);
      setEligible(Array.isArray(eligibleRows) ? eligibleRows : []);
      setRecent(Array.isArray(returnRows) ? returnRows.slice(0, 10) : []);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter(row =>
      [
        row.item_name,
        row.item_name_fa,
        row.item_code,
        row.supplier_name,
        row.document_reference,
      ].some(value => String(value || "").toLowerCase().includes(q)),
    );
  }, [eligible, search]);

  const chooseReceipt = (receipt: EligibleReceipt) => {
    setSelected(receipt);
    setSuccess(null);
    setError("");
    setForm({
      quantity: 1,
      returned_to: receipt.supplier_name || "",
      return_reference: receipt.document_reference || "",
      reason: "د کیفیت ستونزه",
      condition_status: "QUALITY_REJECTED",
      notes: "",
    });
  };

  const submitReturn = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (form.quantity < 1 || form.quantity > Number(selected.returnable_quantity)) {
      setError(`مقدار باید د ۱ او ${selected.returnable_quantity} ترمنځ وي.`);
      return;
    }
    if (!form.returned_to.trim()) {
      setError("د جنس واپس اخیستونکی/عرضه کوونکی اړین دی.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await apiClient.post("/inventory/returns", {
        original_transaction_id: selected.original_transaction_id,
        quantity: Number(form.quantity),
        returned_to: form.returned_to.trim(),
        return_reference: form.return_reference.trim() || undefined,
        reason: form.reason,
        condition_status: form.condition_status,
        notes: form.notes.trim() || undefined,
        returned_by_name: profile?.name || undefined,
      });
      setSuccess(result);
      setSelected(null);
      await loadData();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
  const labelCls = "mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300";

  return (
    <>
      <PageMeta title="د اجناسو واپسي | Kandahar University WMS" description="عرضه کوونکي یا سرچینې ته د داخل شویو اجناسو معیاري واپسي" />
      <Breadcrumb pageTitle="د اجناسو واپسي / برگشت اجناس" />
      <div className="mb-3 flex items-center justify-between gap-3" dir="rtl">
        <CurrentDateBadge forceShamsi />
        <Link
          to="/reports/returns"
          className="no-print rounded-lg border border-primary/30 px-3 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-white"
        >
          📊 د واپسي راپور او کهاته
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" dir="rtl">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800" dir="rtl">
          <div className="font-black">✓ واپسي په بریالیتوب ثبت شوه</div>
          <div className="mt-1 text-sm">
            سند: <b dir="ltr">{success.return_number}</b> — {success.item_name}، مقدار {success.quantity}؛
            موجودي {success.previous_stock} ← {success.new_stock}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3" dir="rtl">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] xl:col-span-2">
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-800 dark:text-white">د داخل شویو اجناسو پاتې مقدار</h2>
              <p className="text-xs text-gray-500">یوازې هغه داخل معاملات ښکاري چې لا د واپسي وړ مقدار لري.</p>
            </div>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              className={`${inputCls} max-w-sm`}
              placeholder="جنس، کود، عرضه کوونکی یا سند ولټوئ..."
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="border px-3 py-2">د داخل نېټه (شمسي)</th>
                  <th className="border px-3 py-2">جنس / کود</th>
                  <th className="border px-3 py-2">عرضه کوونکی / سند</th>
                  <th className="border px-3 py-2">داخل</th>
                  <th className="border px-3 py-2">مخکې واپس</th>
                  <th className="border px-3 py-2">اوسنۍ موجودي</th>
                  <th className="border px-3 py-2">د واپسي وړ</th>
                  <th className="no-print border px-3 py-2">عمل</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="border py-10 text-center text-gray-500">بارول...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="border py-10 text-center text-gray-500">د واپسي وړ داخل معامله نشته.</td></tr>
                ) : filtered.map(row => (
                  <tr key={row.original_transaction_id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="border px-3 py-2 text-xs">{getHijriShamsiDate(new Date(row.created_at))}</td>
                    <td className="border px-3 py-2">
                      <b>{row.item_name}</b>
                      <div className="font-mono text-[11px] text-gray-500" dir="ltr">{row.item_code}</div>
                    </td>
                    <td className="border px-3 py-2 text-xs">
                      <div>{row.supplier_name || "—"}</div>
                      <div className="text-gray-500">{row.document_reference || "—"}</div>
                    </td>
                    <td className="border px-3 py-2 text-center">{row.received_quantity} {row.unit_name}</td>
                    <td className="border px-3 py-2 text-center">{row.returned_quantity}</td>
                    <td className="border px-3 py-2 text-center">{row.current_stock}</td>
                    <td className="border px-3 py-2 text-center font-black text-emerald-700">{row.returnable_quantity}</td>
                    <td className="no-print border px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => chooseReceipt(row)}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-black text-white hover:bg-amber-600"
                      >
                        ↩ واپسي
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-1 text-lg font-black text-gray-800 dark:text-white">د واپسي سند</h2>
          <p className="mb-4 text-xs text-gray-500">لومړی له جدول څخه اصلي داخل معامله وټاکئ.</p>
          {!selected ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
              کوم داخل جنس نه دی ټاکل شوی.
            </div>
          ) : (
            <form onSubmit={submitReturn} className="space-y-4">
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <b>{selected.item_name}</b>
                <div className="mt-1 text-xs">د واپسي اعظمي مقدار: {selected.returnable_quantity} {selected.unit_name}</div>
              </div>
              <div>
                <label className={labelCls}>د واپسي مقدار *</label>
                <input
                  type="number"
                  min={1}
                  max={selected.returnable_quantity}
                  required
                  value={form.quantity}
                  onChange={e => setForm(old => ({ ...old, quantity: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>واپس اخیستونکی / عرضه کوونکی *</label>
                <input
                  required
                  value={form.returned_to}
                  onChange={e => setForm(old => ({ ...old, returned_to: e.target.value }))}
                  className={inputCls}
                  placeholder="د شرکت یا شخص بشپړ نوم"
                />
              </div>
              <div>
                <label className={labelCls}>د دلیل ډول *</label>
                <select
                  value={form.condition_status}
                  onChange={e => {
                    const option = e.currentTarget.options[e.currentTarget.selectedIndex];
                    setForm(old => ({
                      ...old,
                      condition_status: e.target.value,
                      reason: option.text,
                    }));
                  }}
                  className={inputCls}
                >
                  <option value="QUALITY_REJECTED">د کیفیت ستونزه</option>
                  <option value="DAMAGED">زیانمن / خراب جنس</option>
                  <option value="WRONG_ITEM">غلط جنس یا مشخصات</option>
                  <option value="EXCESS">اضافي مقدار</option>
                  <option value="CONTRACT_REJECTED">د قرارداد مطابق نه دی</option>
                  <option value="OTHER">نور دلیل</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>د واپسي حواله / مکتوب</label>
                <input
                  value={form.return_reference}
                  onChange={e => setForm(old => ({ ...old, return_reference: e.target.value }))}
                  className={inputCls}
                  placeholder="د مکتوب یا سند شمېره"
                />
              </div>
              <div>
                <label className={labelCls}>تفصیلي یادښت</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(old => ({ ...old, notes: e.target.value }))}
                  className={`${inputCls} resize-none`}
                  placeholder="د واپسي حالت او نور جزئیات..."
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-amber-600 px-4 py-3 font-black text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? "ثبتېږي..." : "↩ واپسي ثبت او موجودي کمه کړئ"}
              </button>
            </form>
          )}
        </aside>
      </div>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]" dir="rtl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-800 dark:text-white">وروستۍ واپسۍ</h2>
          <Link to="/reports/returns" className="no-print text-sm font-bold text-primary">ټول راپور ←</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right text-sm">
            <thead><tr className="bg-gray-100 dark:bg-gray-800">
              <th className="border px-3 py-2">شمسي نېټه</th>
              <th className="border px-3 py-2">سند</th>
              <th className="border px-3 py-2">جنس</th>
              <th className="border px-3 py-2">مقدار</th>
              <th className="border px-3 py-2">واپس اخیستونکی</th>
              <th className="border px-3 py-2">دلیل</th>
            </tr></thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={6} className="border py-8 text-center text-gray-500">تر اوسه واپسي نه ده ثبت شوې.</td></tr>
              ) : recent.map(row => (
                <tr key={row.id}>
                  <td className="border px-3 py-2">{getHijriShamsiDate(new Date(row.created_at))}</td>
                  <td className="border px-3 py-2 font-mono text-xs" dir="ltr">{row.return_number}</td>
                  <td className="border px-3 py-2 font-bold">{row.item_name}</td>
                  <td className="border px-3 py-2">{row.quantity} {row.unit_name}</td>
                  <td className="border px-3 py-2">{row.returned_to}</td>
                  <td className="border px-3 py-2">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
