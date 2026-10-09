import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useLanguage } from "../context/LanguageContext";

export type OfficialTemplateId =
  | "formTemplate0"
  | "formTemplate1"
  | "formTemplate2"
  | "formTemplate3"
  | "formTemplate4"
  | "formTemplate5"
  | "formTemplate6";

export interface OfficialFormSharedData {
  sourceTemplateId?: string;
  sourceFormName?: string;
  sharedFields?: Record<string, string>;
  itemRows?: Array<{
    serial?: string;
    itemName?: string;
    itemType?: string;
    itemNameType?: string;
    quantity?: string;
    unit?: string;
    unitPrice?: string;
    totalPrice?: string;
  }>;
  grandTotal?: number;
  savedAt?: string;
}

interface OfficialFormViewerProps {
  templateId: OfficialTemplateId;
  requestId?: string;
  allFormsData?: Record<string, OfficialFormSharedData>;
  initialData?: OfficialFormSharedData;
  onSave?: (data: Record<string, unknown>) => void;
  autoSaveOnPrint?: boolean;
  readOnly?: boolean;
  userId?: string;
  onPrint?: (data: Record<string, unknown>) => void;
}

const ZOOM_MIN = 40;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;
const ZOOM_DEFAULT = 100;

const OfficialFormViewer: React.FC<OfficialFormViewerProps> = ({
  templateId,
  requestId,
  allFormsData,
  initialData,
  onSave,
  readOnly = false,
  autoSaveOnPrint = true,
  userId,
  onPrint,
}) => {
  const { pick } = useLanguage();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const pendingSaveCb = useRef<((data: Record<string, unknown>) => void) | null>(null);
  const lastTemplateId = useRef<string>("");
  const lastRequestId = useRef<string>("");
  const lastAllFormsData = useRef<Record<string, OfficialFormSharedData> | undefined>(undefined);

  const logoStorageKey = `ku_form_logo_${userId || "default"}`;

  const injectLogoIntoIframe = useCallback(() => {
    try {
      const outerDoc = iframeRef.current?.contentDocument;
      if (!outerDoc) return;
      const innerIframe = outerDoc.getElementById("formViewer") as HTMLIFrameElement | null;
      if (!innerIframe) return;
      const innerDoc = innerIframe.contentDocument || innerIframe.contentWindow?.document;
      if (!innerDoc) return;
      const logoBox = innerDoc.getElementById("logoBox") as HTMLElement | null;
      if (!logoBox) return;
      if (!innerDoc.getElementById("ku-logo-hide-btn")) {
        const s = innerDoc.createElement("style");
        s.id = "ku-logo-hide-btn";
        s.textContent = "#logoUploadBtn{display:none!important}";
        innerDoc.head?.appendChild(s);
      }
      const saved = logoDataUrl || localStorage.getItem(logoStorageKey);
      if (saved) {
        logoBox.innerHTML = "";
        const img = innerDoc.createElement("img");
        img.src = saved;
        img.alt = "Uploaded Logo";
        img.className = "uploaded-logo";
        img.draggable = false;
        img.style.cssText = "max-width:100%;max-height:100%;display:block;";
        logoBox.appendChild(img);
      } else {
        logoBox.innerHTML = '<span class="logo-placeholder" style="color:#aaa;font-size:11px;">لوګو</span>';
      }
    } catch (_) {}
  }, [logoDataUrl, logoStorageKey]);

  const resizeImageToDataURL = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX = 900;
          let w = img.width, h = img.height;
          if (w > h && w > MAX) { h = Math.round(h * (MAX / w)); w = MAX; }
          else if (h >= w && h > MAX) { w = Math.round(w * (MAX / h)); h = MAX; }
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = c.getContext("2d");
          if (!ctx) { reject(new Error("no ctx")); return; }
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataURL(file);
      setLogoDataUrl(dataUrl);
      localStorage.setItem(logoStorageKey, dataUrl);
      injectLogoIntoIframe();
    } catch (_) {}
    if (e.target) e.target.value = "";
  }, [resizeImageToDataURL, logoStorageKey, injectLogoIntoIframe]);

  const sendMsg = useCallback((msg: Record<string, unknown>) => {
    try {
      iframeRef.current?.contentWindow?.postMessage({ namespace: "KU_FORMS", ...msg }, "*");
    } catch (_) {}
  }, []);

  // ── Apply zoom to the inner #formViewer inside official-forms.html ──────────
  const applyZoom = useCallback((zoomPct: number) => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const viewer = doc.getElementById("formViewer") as HTMLIFrameElement | null;
      if (viewer) {
        viewer.style.zoom = `${zoomPct}%`;
        // Expand wrapper height so the zoomed content isn't clipped
        const card = doc.querySelector(".viewer-card") as HTMLElement | null;
        if (card) {
          if (zoomPct >= 100) {
            card.style.height = "";
            card.style.overflow = "hidden";
          } else {
            card.style.overflow = "hidden";
          }
        }
      }
    } catch (_) {}
  }, []);

  // ── Height chain fix ─────────────────────────────────────────────────────────
  const injectHeightFix = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc?.head) return;
      if (doc.getElementById("ku-wms-height-fix")) return;
      const style = doc.createElement("style");
      style.id = "ku-wms-height-fix";
      style.textContent =
        "html,body,.app-shell{height:100%!important;min-height:0!important;}" +
        ".viewer-wrap{display:flex!important;flex-direction:column!important;height:100%!important;min-height:0!important;overflow:hidden!important;}" +
        ".viewer-card{flex:1!important;min-height:0!important;overflow:hidden!important;}" +
        "#formViewer{width:100%!important;height:100%!important;border:0!important;display:block!important;}";
      doc.head.appendChild(style);
    } catch (_) {}
  }, []);

  // Comparison form only: Enter behaves like Excel and moves to the next
  // editable cell instead of inserting a line break or expanding the cell.
  const injectComparisonEnterNavigation = useCallback(() => {
    try {
      const outerDoc = iframeRef.current?.contentDocument;
      const innerIframe = outerDoc?.getElementById("formViewer") as HTMLIFrameElement | null;
      const innerDoc = innerIframe?.contentDocument || innerIframe?.contentWindow?.document;
      if (!innerDoc || innerDoc.documentElement.dataset.kuComparisonEnterNav === "1") return;

      innerDoc.documentElement.dataset.kuComparisonEnterNav = "1";
      innerDoc.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
        const target = event.target as HTMLElement | null;
        const currentCell = target?.closest?.(".comparison-table td, .comparison-table th") as HTMLTableCellElement | null;
        if (!currentCell || !currentCell.closest(".comparison-page")) return;
        if (target?.matches("textarea, button, select") || target?.closest("textarea, button, select")) return;

        const table = currentCell.closest("table") as HTMLTableElement | null;
        const currentRow = currentCell.parentElement as HTMLTableRowElement | null;
        if (!table || !currentRow || currentRow.cells.length < 10) return;

        // Stop Enter from inserting a new line even when this is the last row.
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const visualColumn = Array.from(currentRow.cells)
          .slice(0, currentCell.cellIndex)
          .reduce((column, cell) => column + Math.max(1, cell.colSpan || 1), 0);
        const rows = Array.from(table.rows);
        const currentRowIndex = rows.indexOf(currentRow);
        let nextCell: HTMLElement | null = null;

        for (let rowIndex = currentRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          // Only navigate through the regular ten-column item rows. This keeps
          // Enter vertical and prevents jumps into totals/remarks/committee rows.
          if (row.cells.length < 10 || row.className) continue;

          let columnCursor = 0;
          for (const cell of Array.from(row.cells)) {
            const span = Math.max(1, cell.colSpan || 1);
            if (visualColumn >= columnCursor && visualColumn < columnCursor + span) {
              const editable = cell.matches("[contenteditable='true']")
                ? cell
                : cell.querySelector<HTMLElement>("[contenteditable='true']");
              if (editable) nextCell = editable;
              break;
            }
            columnCursor += span;
          }
          if (nextCell) break;
        }

        if (!nextCell) return;
        nextCell.focus();
        const selection = innerDoc.getSelection();
        if (selection) {
          const range = innerDoc.createRange();
          range.selectNodeContents(nextCell);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }, true);
    } catch (_) {}
  }, []);

  useLayoutEffect(() => {
    const keysToClean = [
      "proposal_v7_balanced_hard_save",
      "proposal_v7_balanced_hard_backup",
      "proposal_v7_balanced_content",
      "proposal_v7_balanced_ultimate_content",
      "proposal_v7_balanced_word_like_content",
      "proposal_v7_balanced_history_content",
      "proposal_safe_rebuild_v3_content",
      "proposal_integrated_final_v2_content",
      "proposal_hard_save_final_content_v1",
      "proposal_hard_save_final_content_backup_v1",
      "proposal_hard_fixed_content_v3",
      "ku-final-saved-html-formTemplate0",
      "ku_procurement_single_file_formTemplate0_snapshot_v3",
      "procurement_form_proposal",
    ];
    try { keysToClean.forEach((k) => localStorage.removeItem(k)); } catch (_) {}
  }, [requestId]);

  useEffect(() => {
    const saved = localStorage.getItem(logoStorageKey);
    if (saved) setLogoDataUrl(saved);
  }, [logoStorageKey]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as Record<string, unknown>;
      if (!msg || msg.namespace !== "KU_FORMS") return;
      if (msg.type === "DATA_RESPONSE" && pendingSaveCb.current) {
        pendingSaveCb.current(msg.data as Record<string, unknown>);
        pendingSaveCb.current = null;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const setupIframe = useCallback(
    (tid: string, rid: string | undefined) => {
      injectHeightFix();
      sendMsg({ type: "HIDE_TOPBAR" });
      setTimeout(() => applyZoom(zoom), 200);

      if (rid) sendMsg({ type: "SET_REQUEST_SCOPE", requestId: rid });

      sendMsg({ type: "SHOW_FORM", templateId: tid });
      if (tid === "formTemplate2") {
        setTimeout(() => injectComparisonEnterNavigation(), 700);
        setTimeout(() => injectComparisonEnterNavigation(), 1400);
      }

      if (allFormsData && Object.keys(allFormsData).length > 0) {
        setTimeout(() => sendMsg({ type: "INJECT_ALL_FORMS", allData: allFormsData }), 500);
      } else if (initialData && Object.keys(initialData).length > 0) {
        setTimeout(() => sendMsg({ type: "INJECT_DATA", templateId: tid, sharedData: initialData }), 500);
      }

      if (readOnly) {
        setTimeout(() => sendMsg({ type: "SET_READONLY" }), 1000);
      }

      setTimeout(() => injectLogoIntoIframe(), 600);
      setTimeout(() => injectLogoIntoIframe(), 1200);
    },
    [allFormsData, initialData, readOnly, sendMsg, injectHeightFix, applyZoom, zoom, injectLogoIntoIframe, injectComparisonEnterNavigation]
  );

  const handleIframeLoad = useCallback(() => {
    setLoading(false);
    setIframeReady(true);
    const tid = templateId;
    const rid = requestId;
    lastTemplateId.current = tid;
    lastRequestId.current = rid || "";
    lastAllFormsData.current = allFormsData;
    setTimeout(() => setupIframe(tid, rid), 350);
  }, [templateId, requestId, allFormsData, setupIframe]);

  useEffect(() => {
    if (!iframeReady) return;
    const tid = templateId;
    if (tid === lastTemplateId.current) return;
    lastTemplateId.current = tid;
    sendMsg({ type: "SHOW_FORM", templateId: tid });
    if (tid === "formTemplate2") {
      setTimeout(() => injectComparisonEnterNavigation(), 700);
      setTimeout(() => injectComparisonEnterNavigation(), 1400);
    }
    if (initialData && Object.keys(initialData).length > 0) {
      setTimeout(() => sendMsg({ type: "INJECT_DATA", templateId: tid, sharedData: initialData }), 350);
    }
    setTimeout(() => injectLogoIntoIframe(), 600);
    setTimeout(() => injectLogoIntoIframe(), 1200);
  }, [templateId, iframeReady, initialData, sendMsg, injectLogoIntoIframe, injectComparisonEnterNavigation]);

  useEffect(() => {
    if (!iframeReady) return;
    if (allFormsData === lastAllFormsData.current) return;
    lastAllFormsData.current = allFormsData;
    if (!allFormsData || Object.keys(allFormsData).length === 0) return;
    sendMsg({ type: "SHOW_FORM", templateId });
    setTimeout(() => sendMsg({ type: "INJECT_ALL_FORMS", allData: allFormsData }), 500);
  }, [allFormsData, iframeReady, templateId, sendMsg]);

  // Re-apply zoom whenever it changes (after iframe is ready)
  useEffect(() => {
    if (!iframeReady) return;
    applyZoom(zoom);
  }, [zoom, iframeReady, applyZoom]);

  const handleZoomIn = () =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) / ZOOM_STEP) * ZOOM_STEP));
  const handleZoomOut = () =>
    setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) / ZOOM_STEP) * ZOOM_STEP));
  const handleZoomReset = () => setZoom(ZOOM_DEFAULT);

  const handleSave = () => {
    if (!onSave) return;
    pendingSaveCb.current = onSave;
    sendMsg({ type: "GET_DATA", msgId: Date.now().toString() });
    setTimeout(() => {
      if (pendingSaveCb.current) {
        pendingSaveCb.current({});
        pendingSaveCb.current = null;
      }
    }, 4000);
  };

  const handlePrint = () => {
    if (onPrint) {
      if (onSave) {
        pendingSaveCb.current = (data) => {
          onSave(data);
          onPrint(data);
        };
        sendMsg({ type: "GET_DATA", msgId: Date.now().toString() });
        setTimeout(() => {
          if (pendingSaveCb.current) {
            pendingSaveCb.current({});
            pendingSaveCb.current = null;
          }
        }, 4000);
      } else {
        onPrint({});
      }
      return;
    }
    if (autoSaveOnPrint && onSave) handleSave();
    sendMsg({ type: "PRINT" });
  };

  const zoomBarWidth = ((zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100;

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* ── Top toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b bg-gray-50">
        <h3 className="text-sm font-bold text-gray-700">{pick("رسمي فورم", "فورم رسمی")}</h3>

        {/* ── Zoom bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5" dir="ltr">
          {/* Zoom-out */}
          <button
            onClick={handleZoomOut}
            disabled={zoom <= ZOOM_MIN}
            title="کوچنی کول"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 text-base font-bold hover:bg-blue-50 hover:border-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            −
          </button>

          {/* Slider track */}
          <div className="relative flex items-center w-28 sm:w-36 h-7 cursor-pointer group"
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              const raw = ZOOM_MIN + ratio * (ZOOM_MAX - ZOOM_MIN);
              const snapped = Math.round(raw / ZOOM_STEP) * ZOOM_STEP;
              setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, snapped)));
            }}
          >
            {/* Track background */}
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-150"
                style={{ width: `${zoomBarWidth}%` }}
              />
            </div>
            {/* Hidden range input for keyboard/drag support */}
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              aria-label="Zoom"
            />
            {/* Thumb */}
            <div
              className="absolute w-4 h-4 rounded-full bg-white border-2 border-blue-500 shadow-sm transition-all duration-150 pointer-events-none"
              style={{ left: `calc(${zoomBarWidth}% - 8px)` }}
            />
          </div>

          {/* Zoom-in */}
          <button
            onClick={handleZoomIn}
            disabled={zoom >= ZOOM_MAX}
            title="لوی کول"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 text-base font-bold hover:bg-blue-50 hover:border-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            +
          </button>

          {/* Percentage badge — click to reset */}
          <button
            onClick={handleZoomReset}
            title={pick("۱۰۰٪ ته راستول", "بازگشت به ۱۰۰٪")}
            className="min-w-[3.2rem] h-7 px-2 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-blue-50 hover:border-blue-400 transition tabular-nums"
          >
            {zoom}%
          </button>
        </div>

        {/* ── Action buttons ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleLogoUpload}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition"
                title={pick("لوګو پورته کول", "آپلود لوګو")}
              >
                {logoDataUrl ? pick("لوګو بدلول", "تغییر لوګو") : pick("لوګو", "لوګو")}
              </button>
            </>
          )}
          {readOnly && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400">
              🔒 {pick("د لیدلو حالت", "فقط مشاهده")}
            </span>
          )}
          {!readOnly && onSave && (
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition"
            >
              {pick("ذخیره کول", "ذخیره")}
            </button>
          )}
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300 transition"
          >
            {pick("چاپ کول", "چاپ")}
          </button>
        </div>
      </div>

      {/* ── Iframe ──────────────────────────────────────────────────────────── */}
      <div className="relative">
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-white/80 z-10"
            style={{ height: "max(820px, calc(100vh - 160px))" }}
          >
            <span className="text-sm text-gray-500">بارول...</span>
          </div>
        )}
        <iframe
          key={requestId || "no-request"}
          ref={iframeRef}
          src="/forms/official-forms.html?v=si9-2page-v2"
          className="w-full border-0 block"
          style={{ height: "max(820px, calc(100vh - 160px))" }}
          title="Official Form"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
};

export default OfficialFormViewer;
