import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { getItems, WarehouseItem } from "../../firebase/inventory";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { ROLES } from "../../constants/roles";
import { apiClient } from "../../api/apiClient";
import { QRCodeSVG as QRCode } from "qrcode.react";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

interface PrintItem extends WarehouseItem {
  tracking_code?: string;
}

export default function ItemList() {
  const [items, setItems] = useState<PrintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { pick } = useLanguage();
  const [printItem, setPrintItem] = useState<PrintItem | null>(null);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<string>("");

  const canEdit = profile?.role === ROLES.SUPER_ADMIN || profile?.role === ROLES.ADMIN ||
    profile?.role === ROLES.WAREHOUSE_ENTRY_PERSON || profile?.role === ROLES.WAREHOUSE_DIRECTOR;
  const canStockIn = canEdit || profile?.role === ROLES.WAREHOUSE_ENTRY_PERSON;
  const canStockOut = canEdit || profile?.role === ROLES.WAREHOUSE_DIRECTOR;
  const canScanBarcode = profile?.role === ROLES.SUPER_ADMIN || profile?.role === ROLES.ADMIN || profile?.role === ROLES.WAREHOUSE_DIRECTOR;
  const filterParam = searchParams.get("filter");

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      const data = await getItems();
      const enriched: PrintItem[] = await Promise.all(
        data.map(async (item: WarehouseItem) => {
          try {
            const apiItem = await apiClient.get(`/inventory/items/${item.id}`);
            return { ...item, tracking_code: apiItem?.tracking_code || "" };
          } catch {
            return item;
          }
        })
      );
      setItems(enriched);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false);
    }
  };

  const allCategories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort(), [items]);
  const allUnits = useMemo(() => Array.from(new Set(items.map(i => i.unit).filter(Boolean))).sort(), [items]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (filterParam === "low") list = list.filter(i => i.currentQuantity > 0 && i.currentQuantity <= i.minimumStockLevel);
    else if (filterParam === "out") list = list.filter(i => i.currentQuantity === 0);
    else if (filterParam === "cat" && selectedCat) list = list.filter(i => i.category === selectedCat);
    else if (filterParam === "unit" && selectedUnit) list = list.filter(i => i.unit === selectedUnit);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(item =>
      (item.name || "").toLowerCase().includes(q) ||
      (item.category || "").toLowerCase().includes(q) ||
      (item.unit || "").toLowerCase().includes(q) ||
      (item.typeOrSpecification || "").toLowerCase().includes(q) ||
      (item.supplierOrSource || "").toLowerCase().includes(q) ||
      ((item as any).tracking_code || "").toLowerCase().includes(q) ||
      String(item.currentQuantity).includes(q)
    );
  }, [items, search, filterParam, selectedCat, selectedUnit]);

  const filterLabel = filterParam === "low"
    ? pick("کمه موجودي", "موجودی کم")
    : filterParam === "out"
    ? pick("ختم شوي اجناس", "اجناس تمام‌شده")
    : filterParam === "cat"
    ? pick("د کټګورۍ له مخې", "بر اساس دسته‌بندی")
    : filterParam === "unit"
    ? pick("د واحد له مخې", "بر اساس واحد")
    : null;

  const handlePrintBarcode = async (item: PrintItem) => {
    setPrintItem(item);
    try {
      await apiClient.post(`/inventory/items/${item.id}/barcode/print-log`, {});
    } catch (_) {}

    const code = (item as any).tracking_code || item.id || "N/A";
    const name = item.name || "—";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(code)}`;

    const win = window.open("", "_blank", "width=480,height=600,scrollbars=yes");
    if (!win) return;
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
        @media print{.print-btn{display:none}}
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
        <tr><td>کټګوري</td><td>${item.category || "—"}</td></tr>
        <tr><td>اوسنۍ موجودي</td><td>${item.currentQuantity ?? 0}</td></tr>
        <tr><td>واحد</td><td>${item.unit || "—"}</td></tr>
        <tr><td>ترکینګ کوډ</td><td>${(item as any).tracking_code || "—"}</td></tr>
      </table>
      <button class="print-btn" onclick="window.print()">🖨️ چاپ</button>
    </body></html>`);
    win.document.close();
  };

  return (
    <>
      <PageMeta title={pick("د اجناسو لیست", "لیست اجناس") + " | Kandahar University WMS"} description="" />
      <Breadcrumb pageTitle="د موجودۍ لیست / لیست موجودی" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      {printItem && (
        <div className="hidden print:block fixed inset-0 bg-white z-50 p-8 text-center" dir="rtl">
          <p className="text-xs font-bold mb-1">د کندهار پوهنتون د عمومي ګدام مدیریت سیستم</p>
          <p className="text-xs text-gray-500 mb-3">Kandahar University WMS</p>
          <div className="inline-block p-3 border border-gray-300 rounded-lg">
            <QRCode value={(printItem as any).tracking_code || printItem.id || "N/A"} size={130} level="M" includeMargin />
          </div>
          <div className="mt-2 space-y-0.5">
            <p className="font-bold text-sm">{printItem.name}</p>
            <p className="text-xs text-gray-600">{printItem.category} | {printItem.unit}</p>
            <p className="text-xs text-gray-500">{printItem.typeOrSpecification}</p>
            <p className="font-mono text-xs font-bold mt-1">{(printItem as any).tracking_code}</p>
            <p className="text-xs text-gray-400">{new Date().toLocaleDateString("fa-AF")}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div dir="rtl">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {filterLabel ? filterLabel : pick("ټول اجناس", "تمام اجناس")}
            </h3>
            {filterParam === "low" && (
              <p className="text-xs text-orange-500 mt-0.5">{pick("هغه اجناس چي د کمترینه کچې سره سم دي", "اجناسی که به حداقل موجودی رسیده‌اند")}</p>
            )}
            {filterParam === "out" && (
              <p className="text-xs text-red-500 mt-0.5">{pick("هغه اجناس چي بیخي ختم شوي دي", "اجناسی که کاملاً تمام شده‌اند")}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filterParam && (
              <Link to="/inventory/items" className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition">
                ✕ {pick("فلتر لرې کول", "حذف فیلتر")}
              </Link>
            )}
            {canScanBarcode && (
              <Link to="/inventory/barcode-scanner" className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 transition">
                📷 {pick("د بارکوډ سکین", "اسکن بارکد")}
              </Link>
            )}
            {canEdit && (
              <Link to="/inventory/add" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90">
                <svg className="fill-current" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8.75 3.75C8.75 3.33579 8.41421 3 8 3C7.58579 3 7.25 3.33579 7.25 3.75V7.25H3.75C3.33579 7.25 3 7.58579 3 8C3 8.41421 3.33579 8.75 3.75 8.75H7.25V12.25C7.25 12.6642 7.58579 13 8 13C8.41421 13 8.75 12.6642 8.75 12.25V8.75H12.25C12.6642 8.75 13 8.41421 13 8C13 7.58579 12.6642 7.25 12.25 7.25H8.75V3.75Z" fill="" />
                </svg>
                {pick("جنس اضافه کول", "افزودن جنس")}
              </Link>
            )}
          </div>
        </div>

        {/* Category filter chips */}
        {filterParam === "cat" && !loading && (
          <div className="mb-4" dir="rtl">
            <p className="text-xs text-gray-500 mb-2">{pick("د کټګورۍ غوره کول:", "انتخاب دسته:")}</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCat("")}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${!selectedCat ? "bg-primary text-white border-primary" : "border-gray-300 text-gray-600 hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-400"}`}
              >
                {pick("ټولې", "همه")} ({items.length})
              </button>
              {allCategories.map(cat => {
                const count = items.filter(i => i.category === cat).length;
                return (
                  <button key={cat}
                    onClick={() => setSelectedCat(cat)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${selectedCat === cat ? "bg-primary text-white border-primary" : "border-gray-300 text-gray-600 hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-400"}`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Unit filter chips */}
        {filterParam === "unit" && !loading && (
          <div className="mb-4" dir="rtl">
            <p className="text-xs text-gray-500 mb-2">{pick("د واحد غوره کول:", "انتخاب واحد:")}</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedUnit("")}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${!selectedUnit ? "bg-primary text-white border-primary" : "border-gray-300 text-gray-600 hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-400"}`}
              >
                {pick("ټول", "همه")} ({items.length})
              </button>
              {allUnits.map(unit => {
                const count = items.filter(i => i.unit === unit).length;
                return (
                  <button key={unit}
                    onClick={() => setSelectedUnit(unit)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${selectedUnit === unit ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:border-indigo-500 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-400"}`}
                  >
                    {unit} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="relative">
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={pick("لټون... (نوم، کټګوري، واحد، بارکوډ)", "جستجو...")}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-4 text-sm text-right text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white/90" dir="rtl" />
          </div>
          {search && <p className="mt-1 text-xs text-gray-400 text-right">{filteredItems.length} {pick("پایله", "نتیجه")}</p>}
        </div>

        <div className="max-w-full overflow-x-auto">
          {loading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer h-14 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          ) : (
            <table className="w-full table-auto" dir="rtl">
              <thead>
                <tr className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/60">
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">{pick("د جنس نوم", "نام جنس")}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">{pick("کټګوري", "دسته‌بندی")}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">{pick("نوعیت", "نوع")}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">{pick("موجودي", "موجودی")}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">{pick("واحد", "واحد")}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">{pick("کمترینه کچه", "حداقل")}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-white/80 text-right text-sm">{pick("عملیات", "عملیات")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-500 animate-fade-in">
                    {search ? `"${search}" ${pick("لپاره هیڅ جنس ونه موندل شو.", "برای هیچ جنسی پیدا نشد.")}` : pick("هیڅ جنس ونه موندل شو.", "هیچ جنسی پیدا نشد.")}
                  </td></tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={item.id}
                      className="border-b border-gray-100 table-row-hover dark:border-gray-800 animate-slide-up"
                      style={{ animationDelay: `${Math.min(idx, 15) * 35}ms` }}>
                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 text-right font-semibold">
                        <div>{item.name}</div>
                        {(item as any).tracking_code && (
                          <div className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-0.5">{(item as any).tracking_code}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => {
                            if (item.category) {
                              window.location.href = `/inventory/items?filter=cat`;
                              setSelectedCat(item.category);
                            }
                          }}
                          className="inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/30 dark:hover:text-purple-300 transition-colors cursor-pointer"
                        >
                          {item.category || "-"}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400 text-right text-xs">{item.typeOrSpecification || "-"}</td>
                      <td className="px-4 py-4 text-right font-bold">
                        <span className={`inline-flex items-center gap-1 text-sm font-bold ${
                          item.currentQuantity === 0 ? "text-red-500" :
                          item.currentQuantity <= item.minimumStockLevel ? "text-orange-500" : "text-green-600"
                        }`}>
                          {item.currentQuantity === 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                          {item.currentQuantity > 0 && item.currentQuantity <= item.minimumStockLevel && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
                          {item.currentQuantity}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => {
                            if (item.unit) {
                              window.location.href = `/inventory/items?filter=unit`;
                              setSelectedUnit(item.unit);
                            }
                          }}
                          className="text-gray-600 dark:text-gray-400 text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          {item.unit}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-500 text-right text-sm">{item.minimumStockLevel}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center gap-1.5 justify-end flex-wrap">
                          {canStockIn && (
                            <Link to={`/inventory/stock-in/${item.id}`} className="text-xs px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-500 hover:text-white dark:bg-green-900/30 dark:text-green-400 transition-all font-medium btn-press">
                              {pick("داخلول", "ورودی")}
                            </Link>
                          )}
                          {canStockOut && (
                            <Link to={`/inventory/stock-out/${item.id}`} className="text-xs px-2.5 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-500 hover:text-white dark:bg-red-900/30 dark:text-red-400 transition-all font-medium btn-press">
                              {pick("ایستل", "خروجی")}
                            </Link>
                          )}
                          <Link to={`/inventory/ledger?item=${item.id}`} className="text-xs px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-500 hover:text-white dark:bg-blue-900/30 dark:text-blue-400 transition-all font-medium btn-press">
                            {pick("کهاته", "دفتر کل")}
                          </Link>
                          {(item as any).tracking_code && (
                            <button
                              onClick={() => handlePrintBarcode(item)}
                              className="text-xs px-2.5 py-1 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-500 hover:text-white dark:bg-purple-900/30 dark:text-purple-400 transition-all font-medium btn-press"
                            >
                              🖨️ {pick("بارکوډ", "بارکد")}
                            </button>
                          )}
                          {canEdit && (
                            <Link to={`/inventory/edit/${item.id}`} className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-500 hover:text-white dark:bg-gray-700 dark:text-gray-300 transition-all font-medium btn-press">
                              {pick("سمون", "ویرایش")}
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filteredItems.length > 0 && (
          <p className="mt-3 text-xs text-gray-400 text-right" dir="rtl">
            {filteredItems.length} {pick("جنسونه ښودل کیږي", "جنس نمایش داده می‌شود")}
          </p>
        )}
      </div>
    </>
  );
}
