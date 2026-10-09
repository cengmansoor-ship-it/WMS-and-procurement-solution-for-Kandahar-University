import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import jsQR from "jsqr";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Button from "../../components/ui/button/Button";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";
import { QRCodeSVG as QRCode } from "qrcode.react";

interface ScanResult {
  item: any;
  transactions: any[];
  auditLogs: any[];
}

function extractTrackingCode(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code");
    if (code && code.trim()) return code.trim();
  } catch (_) {}
  return trimmed;
}

function tryParseAssignmentQr(raw: string): any | null {
  try {
    const obj = JSON.parse(raw.trim());
    if (obj && (obj.item_code || obj.receiver_name || obj.transaction_id)) return obj;
  } catch (_) {}
  return null;
}

export default function BarcodeScanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);

  const [qrPrintTx, setQrPrintTx] = useState<any | null>(null);
  const [qrPrintCount, setQrPrintCount] = useState(1);
  const [assignmentQrResult, setAssignmentQrResult] = useState<any | null>(null);

  const [searchParams] = useSearchParams();

  const canAccess = profile?.role === ROLES.SUPER_ADMIN || profile?.role === ROLES.ADMIN || profile?.role === ROLES.WAREHOUSE_DIRECTOR;
  const isSuperAdmin = profile?.role === ROLES.SUPER_ADMIN;

  const handleSearch = useCallback(async (rawCode: string) => {
    if (!rawCode?.trim()) return;
    const assignment = tryParseAssignmentQr(rawCode);
    if (assignment) {
      setScanResult(null);
      setError(null);
      setAssignmentQrResult(assignment);
      return;
    }
    const code = extractTrackingCode(rawCode);
    if (!code) return;
    setLoading(true);
    setError(null);
    setScanResult(null);
    setAssignmentQrResult(null);
    try {
      const data = await apiClient.get(`/inventory/barcode/${encodeURIComponent(code)}`);
      setScanResult(data);
    } catch (err: any) {
      setError(err.message?.includes("404") || err.message?.includes("ونه موندل شو")
        ? `جنس ونه موندل شو. کوډ "${code}" د سیستم کې نشته.`
        : `خطا: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("ستاسې براوزر د کیمرې ملاتړ نه کوي.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      setCameraActive(true);
      setScanning(true);
      scanningRef.current = true;
      const tick = () => {
        if (!scanningRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas || !video || video.readyState < video.HAVE_ENOUGH_DATA) {
          animFrameRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (found && found.data) {
            const extracted = extractTrackingCode(found.data);
            stopCamera();
            setManualCode(extracted);
            handleSearch(extracted);
            return;
          }
        }
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setCameraError("د کیمرې اجازه ورکړل شوې نده. مهرباني وکړئ د براوزر ترتیباتو کې اجازه ورکړئ.");
      } else if (err.name === "NotFoundError") {
        setCameraError("کیمره ونه موندل شوه. لاندې ترکینګ کوډ دننه کړئ.");
      } else {
        setCameraError("کیمره پرانیستل ونشول: " + err.message);
      }
    }
  }, [handleSearch, stopCamera]);

  useEffect(() => { return () => { stopCamera(); }; }, [stopCamera]);

  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl && codeFromUrl.trim()) {
      const extracted = extractTrackingCode(codeFromUrl.trim());
      setManualCode(extracted);
      handleSearch(extracted);
    }
  }, [searchParams, handleSearch]);

  const handlePrint = async () => {
    if (!scanResult?.item) return;
    try {
      await apiClient.post(`/inventory/items/${scanResult.item.id}/barcode/print-log`, {});
    } catch (_) {}

    const item = scanResult.item;
    const code = item.tracking_code || item.item_code || "N/A";
    const name = item.name_ps || item.name_fa || "—";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(code)}`;

    const win = window.open("", "_blank", "width=480,height=600,scrollbars=yes");
    if (!win) { window.print(); return; }
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head>
      <meta charset="utf-8"><title>بارکوډ چاپ — ${name}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Segoe UI,Tahoma,sans-serif;background:#fff;color:#111;padding:24px;direction:rtl;text-align:center}
        .header{margin-bottom:16px;border-bottom:2px solid #1a3c6e;padding-bottom:12px}
        .header h2{font-size:15px;color:#1a3c6e}
        .header p{font-size:11px;color:#666;margin-top:2px}
        img{border:2px solid #ddd;padding:8px;border-radius:8px;margin:12px auto;display:block}
        .code{font-family:monospace;font-size:13px;font-weight:700;letter-spacing:1px;margin:8px 0;color:#1a3c6e}
        table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;text-align:right}
        td{padding:6px 10px;border:1px solid #ddd}
        td:first-child{background:#f5f5f5;font-weight:600;width:40%}
        .print-btn{margin-top:20px;padding:10px 28px;background:#1a3c6e;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer}
        .print-btn:hover{background:#2a5cae}
        @media print{.print-btn{display:none}.header{border-color:#000}}
      </style>
    </head><body>
      <div class="header">
        <h2>د کندهار پوهنتون عمومي ګدام</h2>
        <p>Kandahar University Warehouse Management System</p>
      </div>
      <img src="${qrUrl}" width="180" height="180" alt="QR Code" onerror="this.style.display='none'" />
      <div class="code">${code}</div>
      <table>
        <tr><td>د جنس نوم</td><td>${name}</td></tr>
        <tr><td>د جنس کوډ</td><td>${item.item_code || "—"}</td></tr>
        <tr><td>ترکینګ کوډ</td><td>${item.tracking_code || "—"}</td></tr>
        <tr><td>کټګوري</td><td>${item.category_name || "—"}</td></tr>
        <tr><td>اوسنۍ موجودي</td><td>${item.current_stock ?? 0}</td></tr>
        <tr><td>ګدام</td><td>${item.warehouse_name || "—"}</td></tr>
        <tr><td>واحد</td><td>${item.unit_name || "—"}</td></tr>
      </table>
      <button class="print-btn" onclick="window.print()">🖨️ چاپ</button>
    </body></html>`);
    win.document.close();
  };

  const handleRegenerate = async () => {
    if (!scanResult?.item || !isSuperAdmin) return;
    if (!window.confirm("ایا د بارکوډ بیا جوړول غواړئ؟")) return;
    try {
      const res = await apiClient.post(`/inventory/items/${scanResult.item.id}/barcode/regenerate`, {});
      setScanResult(prev => prev ? { ...prev, item: { ...prev.item, tracking_code: res.tracking_code } } : prev);
      alert("بارکوډ بیا جوړ شو: " + res.tracking_code);
    } catch (err: any) {
      alert("خطا: " + err.message);
    }
  };

  const printQrLabels = (payload: any, count: number) => {
    const win = window.open("", "_blank", "width=600,height=800");
    if (!win) return;
    const labels = Array(count).fill(0).map((_, i) => `
      <div style="display:inline-block;text-align:center;border:1px solid #ddd;border-radius:8px;padding:12px;margin:6px;page-break-inside:avoid;">
        <div id="qlabel-${i}"></div>
        <div style="font-family:serif;font-size:11px;margin-top:6px;color:#333;">${payload.item_name || ""}</div>
        <div style="font-family:monospace;font-size:9px;color:#666;">${payload.item_code || ""}</div>
        ${payload.receiver_name ? `<div style="font-family:serif;font-size:9px;color:#888;">ترلاسه کوونکی: ${payload.receiver_name}</div>` : ""}
        ${payload.faculty ? `<div style="font-family:serif;font-size:9px;color:#888;">پوهنځی: ${payload.faculty}</div>` : ""}
        ${payload.date ? `<div style="font-family:serif;font-size:9px;color:#888;">${payload.date}</div>` : ""}
      </div>`).join('');
    const jsonStr = JSON.stringify(payload).replace(/"/g, '\\"');
    win.document.write(`<html><head><title>QR Labels</title>
      <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
      </head><body style="direction:rtl;">
      <div>${labels}</div>
      <script>
        const d = "${jsonStr}";
        for(let i=0;i<${count};i++){
          QRCode.toCanvas(document.createElement('canvas'),d,{width:100},function(err,c){
            if(!err && document.getElementById('qlabel-'+i)) document.getElementById('qlabel-'+i).appendChild(c);
          });
        }
        setTimeout(()=>window.print(),1200);
      </script></body></html>`);
    win.document.close();
  };

  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10 p-8 text-center" dir="rtl">
        <p className="text-red-700 dark:text-red-400 font-semibold text-lg">لاسرسی نشته</p>
        <p className="text-red-600 dark:text-red-300 mt-2 text-sm">تاسې د دې پاڼې لیدلو صلاحیت نه لرئ.</p>
        <Button className="mt-4" onClick={() => navigate("/inventory/items")}>بیرته</Button>
      </div>
    );
  }

  return (
    <>
      <PageMeta title="د بارکوډ سکین | Kandahar University WMS" description="د جنس بارکوډ سکین او معلومات" />
      <Breadcrumb pageTitle="د بارکوډ سکین / اسکن بارکد" />

      <canvas ref={canvasRef} className="hidden" />

      {qrPrintTx && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setQrPrintTx(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full" dir="rtl">
            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3">د QR لیبل چاپ</h3>
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm inline-block">
                <QRCode value={JSON.stringify(qrPrintTx)} size={120} level="M" includeMargin />
              </div>
            </div>
            <div className="mb-4 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              {qrPrintTx.item_name && <p><strong>جنس:</strong> {qrPrintTx.item_name}</p>}
              {qrPrintTx.receiver_name && <p><strong>ترلاسه کوونکی:</strong> {qrPrintTx.receiver_name}</p>}
              {qrPrintTx.faculty && <p><strong>پوهنځی:</strong> {qrPrintTx.faculty}</p>}
              {qrPrintTx.department && <p><strong>ډیپارټمنټ:</strong> {qrPrintTx.department}</p>}
              {qrPrintTx.date && <p><strong>نیټه:</strong> {qrPrintTx.date}</p>}
            </div>
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">د چاپ شمیر:</label>
              <input type="number" value={qrPrintCount} onChange={e => setQrPrintCount(Math.max(1, Number(e.target.value)))}
                min="1" max="50"
                className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-center outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setQrPrintTx(null)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">لغوه</button>
              <button onClick={() => { printQrLabels(qrPrintTx, qrPrintCount); setQrPrintTx(null); }}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-xl py-2.5 text-sm font-bold transition-all">
                🖨️ چاپ ({qrPrintCount})
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90" dir="rtl">
            د بارکوډ / QR کوډ سکین یا لټون
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-right" dir="rtl">
                د ترکینګ کوډ لارو پیل دننه کړئ
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch(manualCode)}
                  placeholder="KDR-WMS-2026-000001"
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  dir="ltr"
                />
                <Button onClick={() => handleSearch(manualCode)} disabled={loading || !manualCode.trim()}>
                  {loading ? "لټون..." : "لټون"}
                </Button>
              </div>
              <p className="text-xs text-gray-400 text-right" dir="rtl">د جنس کوډ، ترکینګ کوډ، یا بارکوډ ولیکئ</p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-right" dir="rtl">
                د کیمرې له لارې سکین
              </label>
              {cameraActive ? (
                <div className="space-y-2">
                  <div className="relative">
                    <video ref={videoRef} autoPlay playsInline muted
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-black" style={{ maxHeight: 220 }} />
                    {scanning && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-40 h-40 border-2 border-primary rounded-lg opacity-70">
                          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400" dir="rtl">📷 QR کوډ د کیمرې مخې ته ونیسئ...</p>
                  <Button variant="outline" onClick={stopCamera} className="w-full">کیمره بنده کړئ</Button>
                </div>
              ) : (
                <Button onClick={startCamera} className="w-full" variant="outline">📷 کیمره پرانیستل</Button>
              )}
              {cameraError && <p className="text-xs text-red-500 text-right" dir="rtl">{cameraError}</p>}
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/10 p-4 text-center" dir="rtl">
            <p className="text-blue-700 dark:text-blue-400 text-sm">لټون کیږي...</p>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10 p-4 text-right" dir="rtl">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {assignmentQrResult && (
          <div className="rounded-2xl border border-purple-200 bg-white dark:border-purple-900/30 dark:bg-white/[0.03] p-5 space-y-3" dir="rtl">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-base font-bold text-purple-700 dark:text-purple-400">✓ د تسلیم QR سکین شو</h3>
              <Button variant="outline" className="text-sm text-purple-600 border-purple-300 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400"
                onClick={() => { setQrPrintTx(assignmentQrResult); setQrPrintCount(1); }}>
                🖨️ چاپ
              </Button>
            </div>
            <table className="w-full text-sm border-collapse">
              <tbody>
                {[
                  { label: "د جنس کوډ", value: assignmentQrResult.item_code },
                  { label: "د جنس نوم", value: assignmentQrResult.item_name },
                  { label: "مقدار", value: assignmentQrResult.quantity != null ? String(assignmentQrResult.quantity) : undefined },
                  { label: "اخیستونکی", value: assignmentQrResult.receiver_name },
                  { label: "د هویت کارت", value: assignmentQrResult.receiver_id_no },
                  { label: "پوهنځی", value: assignmentQrResult.faculty },
                  { label: "برخه", value: assignmentQrResult.department },
                  { label: "FS5 حواله", value: assignmentQrResult.fs5_reference },
                  { label: "د غوښتنې شمیره", value: assignmentQrResult.linked_request_id != null ? String(assignmentQrResult.linked_request_id) : undefined },
                  { label: "د معاملې ID", value: assignmentQrResult.transaction_id != null ? String(assignmentQrResult.transaction_id) : undefined },
                  { label: "نیټه", value: assignmentQrResult.date },
                ].filter(r => r.value).map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-gray-50 dark:bg-white/[0.02]" : ""}>
                    <td className="py-1.5 px-3 font-medium text-gray-500 dark:text-gray-400 w-40">{row.label}</td>
                    <td className="py-1.5 px-3 text-gray-800 dark:text-gray-200">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {scanResult && (
          <div className="space-y-4 print:space-y-4">
            {/* ═══ TABLE 1 — Item Details ═══ */}
            <div className="rounded-2xl border border-green-200 bg-white dark:border-green-900/30 dark:bg-white/[0.03] p-5 print:border print:border-gray-300 print:p-4">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4 print:hidden">
                <h3 className="text-base font-bold text-green-700 dark:text-green-400" dir="rtl">✓ جنس وموندل شو</h3>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handlePrint} variant="outline" className="text-sm">🖨️ د بارکوډ چاپ</Button>
                  {isSuperAdmin && (
                    <Button onClick={handleRegenerate} variant="outline" className="text-sm text-orange-600 border-orange-300 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20">
                      🔄 بارکوډ بیا جوړول
                    </Button>
                  )}
                </div>
              </div>
              <div className="print:block print:text-center print:mb-4 hidden">
                <p className="text-xs font-bold">د کندهار پوهنتون د عمومي ګدام مدیریت سیستم</p>
                <p className="text-xs text-gray-500">Kandahar University WMS</p>
              </div>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                  <div className="p-3 bg-white rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <QRCode value={scanResult.item.tracking_code || scanResult.item.item_code || "N/A"} size={120} level="M" includeMargin />
                  </div>
                  <p className="text-xs font-mono text-gray-600 dark:text-gray-400 text-center font-bold">
                    {scanResult.item.tracking_code || scanResult.item.item_code}
                  </p>
                </div>
                <div className="flex-1 overflow-x-auto" dir="rtl">
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      {[
                        { label: "د جنس نوم", value: scanResult.item.name_ps || scanResult.item.name_fa },
                        { label: "د جنس کوډ", value: scanResult.item.item_code },
                        { label: "ترکینګ کوډ", value: scanResult.item.tracking_code },
                        { label: "کټګوري", value: scanResult.item.category_name },
                        { label: "نوعیت / مشخصات", value: scanResult.item.description },
                        { label: "واحد", value: scanResult.item.unit_name },
                        { label: "ګدام", value: scanResult.item.warehouse_name },
                        {
                          label: "اوسنۍ موجودي",
                          value: String(scanResult.item.current_stock ?? 0),
                          highlight: Number(scanResult.item.current_stock) === 0 ? "red" as const :
                            Number(scanResult.item.current_stock) <= Number(scanResult.item.minimum_stock) ? "orange" as const : "green" as const,
                        },
                        { label: "کمترین حد", value: String(scanResult.item.minimum_stock ?? 0) },
                        {
                          label: "قیمت",
                          value: scanResult.item.unit_price != null ? `${Number(scanResult.item.unit_price).toLocaleString()} ؋` : "—",
                        },
                        {
                          label: "د ثبت نیټه",
                          value: scanResult.item.created_at ? new Date(scanResult.item.created_at).toLocaleDateString("fa-AF") : "—",
                        },
                        { label: "عرضه کوونکی", value: scanResult.item.supplier_source || "—" },
                        {
                          label: "حالت",
                          value: scanResult.item.current_stock === 0 ? "ختم شوی" :
                            scanResult.item.current_stock <= scanResult.item.minimum_stock ? "کمه موجودي" : "فعال",
                          highlight: scanResult.item.current_stock === 0 ? "red" as const :
                            scanResult.item.current_stock <= scanResult.item.minimum_stock ? "orange" as const : "green" as const,
                        },
                        { label: "د چاپ شمیر", value: String(scanResult.item.barcode_print_count ?? 0) },
                      ].map(({ label, value, highlight }) => {
                        const valClass = highlight === "red" ? "text-red-600 dark:text-red-400 font-bold" :
                          highlight === "orange" ? "text-orange-500 dark:text-orange-400 font-bold" :
                          highlight === "green" ? "text-green-600 dark:text-green-400 font-bold" :
                          "text-gray-800 dark:text-white/90";
                        return (
                          <tr key={label} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 pr-3 pl-4 text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap w-36 bg-gray-50/60 dark:bg-gray-800/40 border-l border-gray-100 dark:border-gray-800">
                              {label}
                            </td>
                            <td className={`py-2 px-3 text-sm ${valClass}`}>{value || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ═══ TABLE 2 — Transactions ═══ */}
            {scanResult.transactions.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 print:hidden">
                <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right" dir="rtl">
                  د موجودۍ معاملات ({scanResult.transactions.length})
                </h4>
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-sm" dir="rtl">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                      <tr>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">نوع</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">مقدار</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">عرضه کوونکی</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">سند</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">ترلاسه کوونکی</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">پوهنځی / ډیپارټمنټ</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">پخوانۍ</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">نوې</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">یادښت</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">نیټه</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">QR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanResult.transactions.map((tx: any, i: number) => {
                        let qrPayload: any = null;
                        if (tx.assignment_qr_payload) {
                          try {
                            qrPayload = typeof tx.assignment_qr_payload === "string"
                              ? JSON.parse(tx.assignment_qr_payload)
                              : tx.assignment_qr_payload;
                          } catch (_) {}
                        }
                        return (
                          <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                            <td className="px-3 py-2">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                tx.transaction_type === "IN"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              }`}>
                                {tx.transaction_type === "IN" ? "داخل ▲" : "خارج ▼"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-800 dark:text-white/90 font-semibold">{tx.quantity}</td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{tx.supplier_name || "—"}</td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs font-mono">{tx.document_reference || "—"}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300 text-xs">{tx.receiver_name || "—"}</td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">
                              {[tx.faculty_name, tx.department_name].filter(Boolean).join(" / ") || "—"}
                            </td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{tx.previous_stock}</td>
                            <td className="px-3 py-2 text-gray-800 dark:text-white/90 text-xs">{tx.new_stock}</td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs max-w-[120px] truncate">{tx.notes || "—"}</td>
                            <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">
                              {tx.created_at ? new Date(tx.created_at).toLocaleDateString("fa-AF") : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {qrPayload ? (
                                <button
                                  onClick={() => { setQrPrintTx(qrPayload); setQrPrintCount(1); }}
                                  className="p-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 transition"
                                  title="QR لیبل چاپ">
                                  🖨️
                                </button>
                              ) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ TABLE 3 — Audit Logs ═══ */}
            {scanResult.auditLogs.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 print:hidden">
                <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right" dir="rtl">
                  د فعالیتونو لوګ ({scanResult.auditLogs.length})
                </h4>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-sm" dir="rtl">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">عمل</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">کاروونکی</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">نیټه</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanResult.auditLogs.map((log: any, i: number) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs font-mono">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{log.user_name || log.user_id || "—"}</td>
                          <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">
                            {log.created_at ? new Date(log.created_at).toLocaleDateString("fa-AF") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body > *:not(.print\\:block) { display: none !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </>
  );
}
