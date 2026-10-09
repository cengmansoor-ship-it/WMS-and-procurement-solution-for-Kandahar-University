import { useEffect, useState, useMemo } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import SecureDeleteModal from "../../components/common/SecureDeleteModal";
import { useAuth } from "../../context/AuthContext";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

const TYPE_ROUTE: Record<string, string> = {
  item: "/inventory/items",
  items: "/inventory/items",
  request: "/requests",
  requests: "/requests",
  procurement: "/procurement",
  warehouse_request: "/receiving",
  receiving: "/receiving",
};

interface TrashRecord {
  id: number;
  table: string;
  type: string;
  label: string;
  deleted_at: string | null;
  deleted_by_name: string | null;
  delete_reason: string | null;
}

function rowKey(r: TrashRecord) { return `${r.table}-${r.id}`; }

function daysRemaining(deletedAt: string | null): number | null {
  if (!deletedAt) return null;
  const deleted = new Date(deletedAt).getTime();
  const expiry = deleted + 30 * 24 * 60 * 60 * 1000;
  return Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000));
}

function Daysbadge({ deletedAt }: { deletedAt: string | null }) {
  const days = daysRemaining(deletedAt);
  if (days === null) return <span className="text-gray-400 text-xs">—</span>;
  if (days <= 0) return <span className="inline-block rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs px-2 py-0.5 font-semibold">ختم</span>;
  if (days <= 7) return <span className="inline-block rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs px-2 py-0.5 font-semibold">{days} ورځې</span>;
  return <span className="inline-block rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-xs px-2 py-0.5">{days} ورځې</span>;
}

export default function TrashList() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<TrashRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TrashRecord | null>(null);

  // Bulk selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRestoring, setBulkRestoring] = useState(false);

  useEffect(() => { fetchTrash(); }, []);

  const fetchTrash = async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await fetch("/api/trash");
      const json = await res.json();
      if (json.success) setRecords(json.data || []);
      else throw new Error(json.message);
    } catch (e: any) {
      setMsg({ text: "د ویستنې معلومات ترلاسه نشول: " + e.message, ok: false });
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleRestore = async (r: TrashRecord) => {
    const reason = window.prompt("د بیا راوستلو دلیل ولیکئ:");
    if (!reason) return;
    setActionId(`restore-${r.table}-${r.id}`);
    try {
      const res = await fetch(`/api/trash/${r.table}/${r.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      showMsg("ریکارډ بریالیتوب سره بیا راوستل شو.", true);
      await fetchTrash();
    } catch (e: any) {
      showMsg("د بیا راوستلو پر مهال تېروتنه: " + e.message, false);
    } finally {
      setActionId(null);
    }
  };

  const handlePermanentDelete = async (r: TrashRecord, reason: string) => {
    setActionId(`del-${r.table}-${r.id}`);
    try {
      const res = await fetch(`/api/trash/${r.table}/${r.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      showMsg("ریکارډ تل لپاره حذف شو.", true);
      await fetchTrash();
    } catch (e: any) {
      showMsg("د حذف پر مهال تېروتنه: " + e.message, false);
    } finally {
      setActionId(null);
    }
  };

  // ── Bulk restore ──────────────────────────────────────────────────────────
  const handleBulkRestore = async () => {
    if (selected.size === 0) return;
    const reason = window.prompt(`د ${selected.size} ریکارډونو د بیا راوستلو دلیل ولیکئ:`);
    if (!reason) return;
    setBulkRestoring(true);
    let successCount = 0;
    let failCount = 0;
    for (const key of selected) {
      const [table, idStr] = key.split(/-(.+)/);
      const id = idStr;
      try {
        const res = await fetch(`/api/trash/${table}/${id}/restore`, { method: "POST" });
        const json = await res.json();
        if (json.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setBulkRestoring(false);
    if (failCount === 0) {
      showMsg(`${successCount} ریکارډونه بریالیتوب سره بیا راوستل شول.`, true);
    } else {
      showMsg(`${successCount} بریالي، ${failCount} ناکام.`, failCount > 0 && successCount === 0 ? false : true);
    }
    await fetchTrash();
  };

  const expiringCount = useMemo(() => records.filter(r => { const d = daysRemaining(r.deleted_at); return d !== null && d <= 7 && d > 0; }).length, [records]);
  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach(r => { map[r.type] = (map[r.type] || 0) + 1; });
    return map;
  }, [records]);

  const filtered = useMemo(() => {
    let list = records;
    if (typeFilter) list = list.filter(r => r.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.label.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        (r.deleted_by_name || "").toLowerCase().includes(q) ||
        (r.delete_reason || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [records, search, typeFilter]);

  // Selection helpers
  const allFilteredKeys = useMemo(() => new Set(filtered.map(rowKey)), [filtered]);
  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(rowKey(r)));
  const someSelected = filtered.some(r => selected.has(rowKey(r)));

  const toggleRow = (r: TrashRecord) => {
    setSelected(prev => {
      const next = new Set(prev);
      const k = rowKey(r);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(r => next.delete(rowKey(r)));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(r => next.add(rowKey(r)));
        return next;
      });
    }
  };

  const selectedCount = filtered.filter(r => selected.has(rowKey(r))).length;

  return (
    <>
      <PageMeta title="کثافاتو دانۍ | Kandahar University WMS" description="ټول حذف شوي ریکارډونه" />
      <Breadcrumb pageTitle="کثافاتو دانۍ" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]" dir="rtl">

        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">🗑️ کثافاتو دانۍ</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5">
              د ۳۰ ورځو وروسته تل لپاره حذف کیږي
            </span>
            <button
              onClick={fetchTrash}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition"
            >
              تازه کول
            </button>
          </div>
        </div>

        {/* Stat summary cards */}
        {!loading && records.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div
              onClick={() => setTypeFilter(null)}
              className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${!typeFilter ? "border-primary bg-primary/5" : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.02]"}`}
            >
              <div className="text-2xl mb-1">🗑️</div>
              <div className="text-xl font-black text-gray-800 dark:text-white/90">{records.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">ټول حذف شوي</div>
            </div>
            <div
              onClick={() => setTypeFilter(null)}
              className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${expiringCount > 0 ? "border-orange-200 bg-orange-50 dark:bg-orange-900/10" : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.02]"}`}
            >
              <div className="text-2xl mb-1">⏳</div>
              <div className={`text-xl font-black ${expiringCount > 0 ? "text-orange-600" : "text-gray-800 dark:text-white/90"}`}>{expiringCount}</div>
              <div className="text-xs text-gray-500 mt-0.5">ژر ختمیږي (۷ ورځې)</div>
            </div>
            {Object.entries(typeCounts).slice(0, 2).map(([type, count]) => (
              <div
                key={type}
                onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${typeFilter === type ? "border-primary bg-primary/5" : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.02]"}`}
              >
                <div className="text-2xl mb-1">📄</div>
                <div className="text-xl font-black text-gray-800 dark:text-white/90">{count}</div>
                <div className="text-xs text-gray-500 mt-0.5">{type}</div>
              </div>
            ))}
          </div>
        )}

        {/* Active type filter chip */}
        {typeFilter && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">فلتر:</span>
            <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
              {typeFilter}
              <button onClick={() => setTypeFilter(null)} className="text-primary hover:text-red-500 font-bold ml-1">✕</button>
            </span>
          </div>
        )}

        {msg && (
          <div className={`mb-4 rounded-lg border p-3 text-sm ${msg.ok
            ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
            : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
          }`}>
            {msg.text}
          </div>
        )}

        <div className="mb-4">
          <div className="relative">
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="لټون..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-4 text-sm text-right text-gray-800 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          </div>
          {search && <p className="mt-1 text-xs text-gray-400">{filtered.length} پایله</p>}
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 px-4 py-2.5 gap-3">
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {selectedCount} ریکارډونه غوره شوي
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
              >
                لغوه
              </button>
              <button
                onClick={handleBulkRestore}
                disabled={bulkRestoring}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-1.5 transition"
              >
                {bulkRestoring ? "روان دی..." : `↩ ټول (${selectedCount}) بیا راوستل`}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-right table-auto border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="px-3 py-3 border border-gray-200 dark:border-gray-700 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    className="w-4 h-4 cursor-pointer rounded"
                    title="ټول غوره کول"
                  />
                </th>
                <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-800 dark:text-white/90">ډول</th>
                <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-800 dark:text-white/90">نوم / لیبل</th>
                <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-800 dark:text-white/90">حذف کوونکی</th>
                <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-800 dark:text-white/90">د حذف نیټه</th>
                <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-800 dark:text-white/90">پاتې ورځې</th>
                <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-800 dark:text-white/90">دلیل</th>
                <th className="px-4 py-3 border border-gray-200 dark:border-gray-700 font-medium text-gray-800 dark:text-white/90">عمل</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">بارول...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">
                    {search ? `"${search}" لپاره هیڅ حذف شوی ریکارډ ونه موندل شو.` : "هیڅ حذف شوي معلومات نشته."}
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => {
                  const days = daysRemaining(r.deleted_at);
                  const isExpiring = days !== null && days <= 7;
                  const isSelected = selected.has(rowKey(r));
                  return (
                    <tr key={i}
                      className={`border-b border-gray-100 dark:border-gray-800 transition hover:bg-gray-50 dark:hover:bg-white/[0.02] ${isExpiring ? "bg-orange-50/40 dark:bg-orange-900/10" : ""} ${isSelected ? "bg-emerald-50/60 dark:bg-emerald-900/10" : ""}`}>
                      <td className="px-3 py-3 border border-gray-100 dark:border-gray-800 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(r)}
                          className="w-4 h-4 cursor-pointer rounded"
                        />
                      </td>
                      <td className="px-4 py-3 border border-gray-100 dark:border-gray-800">
                        <span className="inline-block rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">{r.type}</span>
                      </td>
                      <td className="px-4 py-3 border border-gray-100 dark:border-gray-800 font-medium">{r.label}</td>
                      <td className="px-4 py-3 border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-xs">{r.deleted_by_name || "—"}</td>
                      <td className="px-4 py-3 border border-gray-100 dark:border-gray-800 text-xs text-gray-500 whitespace-nowrap">
                        {r.deleted_at ? new Date(r.deleted_at).toLocaleDateString("fa-AF") : "—"}
                      </td>
                      <td className="px-4 py-3 border border-gray-100 dark:border-gray-800 text-center">
                        <Daysbadge deletedAt={r.deleted_at} />
                      </td>
                      <td className="px-4 py-3 border border-gray-100 dark:border-gray-800 text-xs italic text-gray-400 max-w-[160px] truncate">{r.delete_reason || "—"}</td>
                      <td className="px-4 py-3 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleRestore(r)}
                            disabled={actionId === `restore-${r.table}-${r.id}`}
                            className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition"
                          >
                            {actionId === `restore-${r.table}-${r.id}` ? "..." : "↩ بیا راوستل"}
                          </button>
                          <button
                            onClick={() => setPendingDelete(r)}
                            disabled={actionId === `del-${r.table}-${r.id}`}
                            className="flex items-center gap-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition"
                          >
                            {actionId === `del-${r.table}-${r.id}` ? "..." : "🗑 تل حذف"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {records.length > 0 && !loading && (
          <p className="mt-3 text-xs text-gray-400 text-left">
            ټول {records.length} حذف شوي ریکارډونه — د ۳۰ ورځو وروسته تل لپاره حذف کیږي
          </p>
        )}
      </div>

      {pendingDelete && (
        <SecureDeleteModal
          title="⚠️ تل لپاره حذف کول"
          description={`ایا ډاډه یاست چې «${pendingDelete.label}» تل لپاره حذف کړئ؟ دا عمل د بیرته راګرځولو وړ نه دی.`}
          currentUserEmail={profile?.email || ""}
          requireReason={true}
          onCancel={() => setPendingDelete(null)}
          onConfirm={(reason) => {
            const r = pendingDelete;
            setPendingDelete(null);
            handlePermanentDelete(r, reason);
          }}
        />
      )}
    </>
  );
}
