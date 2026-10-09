import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Button from "../../components/ui/button/Button";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { managementService } from "../../services/management";
import { QRCodeSVG as QRCode } from "qrcode.react";

interface InventoryItem {
  id: number;
  item_code: string;
  name_ps: string;
  name_fa: string;
  current_stock: number;
  unit_name?: string;
  category_name?: string;
}

export default function StockOut() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [itemSearch, setItemSearch] = useState("");

  const [faculties, setFaculties] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);

  const [form, setForm] = useState({
    quantity: 1,
    unit_price: 0,
    receiver_name: "",
    receiver_id_no: "",
    faculty_id: "",
    department_id: "",
    person_id: "",
    linked_request_id: "",
    fs5_reference: "",
    academic_level: "",
    source_type: "ورکړه",
    notes: "",
    entry_date: new Date().toISOString().split("T")[0],
    issued_by: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assignedQr, setAssignedQr] = useState<string | null>(null);
  const [qrPrintCount, setQrPrintCount] = useState(1);
  const [showQrDialog, setShowQrDialog] = useState(false);

  const loadItem = useCallback(async (itemId: string) => {
    setFetching(true);
    try {
      const res = await apiClient.get(`/inventory/items/${itemId}`);
      setItem(res.data || res);
    } catch (e) { console.error(e); }
    finally { setFetching(false); }
  }, []);

  const loadItems = useCallback(async () => {
    setFetching(true);
    try {
      const res = await apiClient.get("/inventory/items");
      setItems(res.data || res);
    } catch (e) { console.error(e); }
    finally { setFetching(false); }
  }, []);

  useEffect(() => {
    if (id) { loadItem(id); }
    else { loadItems(); }
    managementService.getFaculties().then(setFaculties).catch(() => {});
  }, [id, loadItem, loadItems]);

  // Pre-fill issued_by from logged-in user
  useEffect(() => {
    if (profile?.name && !form.issued_by) {
      setForm(p => ({ ...p, issued_by: profile.name }));
    }
  }, [profile]);

  useEffect(() => {
    if (!form.faculty_id) { setDepartments([]); setPeople([]); return; }
    managementService.getDepartments()
      .then((data: any[]) => setDepartments((data || []).filter((d: any) => String(d.faculty_id) === form.faculty_id)))
      .catch(() => {});
  }, [form.faculty_id]);

  useEffect(() => {
    if (!form.department_id) { setPeople([]); return; }
    apiClient.get(`/management/people?department_id=${form.department_id}`)
      .then((r: any) => setPeople(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, [form.department_id]);

  const buildQrPayload = () => {
    const faculty = faculties.find((f: any) => String(f.id) === form.faculty_id);
    const dept = departments.find((d: any) => String(d.id) === form.department_id);
    const person = people.find((p: any) => String(p.id) === form.person_id);
    return {
      item_code: item?.item_code,
      item_name: item?.name_ps,
      quantity: form.quantity,
      unit_price: form.unit_price || null,
      total_price: (form.quantity * (form.unit_price || 0)) || null,
      receiver_name: form.receiver_name || (person?.full_name),
      receiver_id_no: form.receiver_id_no || null,
      faculty: faculty?.name_ps || null,
      department: dept?.name_ps || null,
      person: person?.full_name || null,
      academic_level: form.academic_level || null,
      linked_request_id: form.linked_request_id || null,
      fs5_reference: form.fs5_reference || null,
      source: form.source_type,
      date: form.entry_date || new Date().toLocaleDateString("fa-AF"),
      issued_by: form.issued_by || null,
      assignment_id: null as number | null,
      transaction_id: null as number | null,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!id || !item) return;
    if (form.quantity < 1) { setError("مقدار باید له یو زیات وي."); return; }
    if (form.quantity > item.current_stock) { setError(`له موجودۍ زیات مقدار نه شئ ایستلی. موجودي: ${item.current_stock}`); return; }
    setShowQrDialog(true);
  };

  const doStockOut = async () => {
    setShowQrDialog(false);
    if (!id || !item) return;
    setLoading(true);
    try {
      const qrPayload = buildQrPayload();
      const res: any = await apiClient.post("/inventory/stock-out", {
        item_id: Number(id),
        quantity: form.quantity,
        unit_price: form.unit_price || undefined,
        receiver_name: form.receiver_name || undefined,
        receiver_id_no: form.receiver_id_no || undefined,
        faculty_id: form.faculty_id ? Number(form.faculty_id) : undefined,
        department_id: form.department_id ? Number(form.department_id) : undefined,
        person_id: form.person_id ? Number(form.person_id) : undefined,
        linked_request_id: form.linked_request_id ? Number(form.linked_request_id) : undefined,
        fs5_reference: form.fs5_reference || undefined,
        academic_level: form.academic_level || undefined,
        source_type: form.source_type || undefined,
        notes: form.notes || undefined,
        assignment_qr_payload: qrPayload,
      });
      const txId = res?.transaction_id ?? null;
      const finalPayload = { ...qrPayload, transaction_id: txId, assignment_id: txId };
      setAssignedQr(JSON.stringify(finalPayload));
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
      (i.item_code || "").toLowerCase().includes(q) ||
      (i.category_name || "").toLowerCase().includes(q);
  });

  const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
  const labelCls = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";

  if (fetching) return <div className="p-10 text-center text-gray-500" dir="rtl">بارول...</div>;

  if (!id) {
    return (
      <>
        <PageMeta title="د جنس ایستل | Kandahar University WMS" description="له ګودام څخه د جنس ایستل" />
        <Breadcrumb pageTitle="د جنس ایستل / خروج جنس" />
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]" dir="rtl">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">د ایستلو لپاره جنس انتخاب کړئ:</h3>
          <input type="text" value={itemSearch} onChange={e => setItemSearch(e.target.value)}
            placeholder="لټون..." className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map(i => (
              <button key={i.id} onClick={() => navigate(`/inventory/stock-out/${i.id}`)}
                disabled={i.current_stock === 0}
                className="flex flex-col p-4 border rounded-xl hover:border-primary hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors dark:border-gray-700 text-right disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="font-bold text-gray-800 dark:text-white/90">{i.name_ps}</span>
                <span className="text-xs font-mono text-gray-400 mt-0.5">{i.item_code}</span>
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

  if (!item) return <div className="p-10 text-center text-red-500" dir="rtl">جنس ونه موندل شو.</div>;

  if (assignedQr) {
    const printLabels = () => {
      const win = window.open("", "_blank", "width=600,height=800");
      if (!win) return;
      const labels = Array(qrPrintCount).fill(0).map((_, i) => `
        <div style="display:inline-block;text-align:center;border:1px solid #ddd;border-radius:8px;padding:12px;margin:6px;page-break-inside:avoid;">
          <div id="qr-${i}"></div>
          <div style="font-family:serif;font-size:11px;margin-top:6px;color:#333;">${item.name_ps}</div>
          <div style="font-family:monospace;font-size:9px;color:#666;">${item.item_code}</div>
          <div style="font-family:serif;font-size:9px;color:#888;">${new Date().toLocaleDateString("fa-AF")}</div>
        </div>`).join('');
      win.document.write(`<html><head><title>QR Labels</title>
        <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
        </head><body style="direction:rtl;">
        <div>${labels}</div>
        <script>
          const data = ${assignedQr};
          for(let i=0;i<${qrPrintCount};i++){
            QRCode.toCanvas(document.createElement('canvas'),JSON.stringify(data),{width:100},function(err,c){
              if(!err && document.getElementById('qr-'+i)) document.getElementById('qr-'+i).appendChild(c);
            });
          }
          setTimeout(()=>window.print(),1000);
        </script></body></html>`);
      win.document.close();
    };

    return (
      <>
        <PageMeta title="د ایستلو QR | Kandahar University WMS" description="" />
        <Breadcrumb pageTitle="د ایستلو QR / QR تخصیص" />
        <div className="rounded-2xl border border-green-200 bg-white dark:border-green-900/30 dark:bg-white/[0.03] p-6 max-w-lg mx-auto text-center space-y-5" dir="rtl">
          <div className="text-5xl">✅</div>
          <h2 className="text-lg font-bold text-green-700 dark:text-green-400">موجودي بریالیتوب سره کمه شوه!</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">د تخصیص QR کوډ جوړ شو. دا ځانګړی QR د دې ایستلو لپاره دی.</p>

          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm inline-block">
              <QRCode value={assignedQr} size={160} level="M" includeMargin />
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">د چاپ شمیر:</label>
            <input type="number" value={qrPrintCount} onChange={e => setQrPrintCount(Math.max(1, Number(e.target.value)))}
              min="1" max="50"
              className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-center outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
          </div>

          <div className="flex gap-3 justify-center">
            <Button onClick={printLabels} variant="outline">🖨️ چاپ ({qrPrintCount} لیبل)</Button>
            <Button onClick={() => navigate("/inventory/items")}>بیرته ایستل</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title="د جنس ایستل | Kandahar University WMS" description="له ګودام څخه د جنس ایستل" />
      <Breadcrumb pageTitle="د جنس ایستل / خروج جنس از ګدام" />

      {showQrDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowQrDialog(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full" dir="rtl">
            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3">تایید - د جنس ایستل</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              ایا ډاډه یاست چې <span className="font-bold text-gray-800 dark:text-white">{form.quantity}</span> {item.unit_name} <span className="font-bold text-primary">{item.name_ps}</span> له ګدام نه ایستل؟
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowQrDialog(false)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">لغوه</button>
              <button onClick={doStockOut} disabled={loading}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-xl py-2.5 text-sm font-bold transition-all">
                {loading ? "ثبتیږي..." : "تایید"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] max-w-2xl mx-auto" dir="rtl">
        <div className="mb-6 border-b pb-4 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white/90">{item.name_ps}</h2>
          <div className="flex flex-wrap gap-3 mt-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              موجودي: <span className={`font-bold ${item.current_stock === 0 ? 'text-red-500' : 'text-green-600'}`}>{item.current_stock} {item.unit_name}</span>
            </span>
            <span className="text-xs font-mono text-gray-400">{item.item_code}</span>
          </div>
        </div>

        {item.current_stock === 0 && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            ⚠️ دا جنس د ګدام نه ختم شوی دی. ایستل ممکن ندی.
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Date + Issued by */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>د ایستلو نیټه <span className="text-red-500">*</span></label>
              <input type="date" value={form.entry_date}
                onChange={e => setForm(p => ({ ...p, entry_date: e.target.value }))}
                required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>د ایستلو مسئول (شخص)</label>
              <input type="text" value={form.issued_by}
                onChange={e => setForm(p => ({ ...p, issued_by: e.target.value }))}
                placeholder="د مسئول نوم..." className={inputCls} />
            </div>
          </div>

          {/* Qty + Unit Price + Total */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>ایستل کیدونکی مقدار <span className="text-red-500">*</span></label>
              <input type="number" value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))}
                min="1" max={item.current_stock} required className={inputCls} />
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
                {(form.quantity * (form.unit_price || 0)) > 0
                  ? (form.quantity * form.unit_price).toLocaleString("fa-AF")
                  : "—"}
              </div>
            </div>
          </div>

          <div className="border-t pt-4 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">د ترلاسه کوونکي معلومات</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>پوهنځی</label>
                <select value={form.faculty_id} onChange={e => setForm(p => ({ ...p, faculty_id: e.target.value, department_id: "", person_id: "" }))} className={inputCls}>
                  <option value="">پوهنځی غوره کړئ...</option>
                  {faculties.map((f: any) => <option key={f.id} value={f.id}>{f.name_ps}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>ډیپارټمنټ</label>
                <select value={form.department_id} onChange={e => setForm(p => ({ ...p, department_id: e.target.value, person_id: "" }))} className={inputCls} disabled={!form.faculty_id}>
                  <option value="">ډیپارټمنټ غوره کړئ...</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name_ps}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>شخص</label>
                <select value={form.person_id} onChange={e => {
                  const p = people.find((p: any) => String(p.id) === e.target.value);
                  setForm(prev => ({ ...prev, person_id: e.target.value, receiver_name: p?.full_name || prev.receiver_name }));
                }} className={inputCls} disabled={!form.department_id}>
                  <option value="">شخص غوره کړئ...</option>
                  {people.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>د ترلاسه کوونکي نوم</label>
                <input type="text" value={form.receiver_name}
                  onChange={e => setForm(p => ({ ...p, receiver_name: e.target.value }))}
                  placeholder="لاسي ولیکئ..." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>د پیژندنې شمیره</label>
                <input type="text" value={form.receiver_id_no}
                  onChange={e => setForm(p => ({ ...p, receiver_id_no: e.target.value }))}
                  placeholder="د تذکرې / کارمند شمیره" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>تحصیلي کچه</label>
                <input type="text" value={form.academic_level}
                  onChange={e => setForm(p => ({ ...p, academic_level: e.target.value }))}
                  placeholder="مثلاً: ماستر، لیسانس..." className={inputCls} />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">د سند معلومات</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>د غوښتنې شمیره</label>
                <input type="text" value={form.linked_request_id}
                  onChange={e => setForm(p => ({ ...p, linked_request_id: e.target.value }))}
                  placeholder="REQ-XXXXXX" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>FS5 شمیره</label>
                <input type="text" value={form.fs5_reference}
                  onChange={e => setForm(p => ({ ...p, fs5_reference: e.target.value }))}
                  placeholder="د FS5 شمیره" className={inputCls} />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>یادښت</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3} placeholder="اختیاري یادښت..."
              className={inputCls + " resize-none"} />
          </div>

          <div className="flex justify-end gap-4 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/inventory/items")}>لغوه کول</Button>
            <Button type="submit" disabled={loading || item.current_stock === 0}>
              {loading ? "ثبتیږي..." : "ایستل"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
