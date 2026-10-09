import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { createItem } from "../../firebase/inventory";
import { useAuth } from "../../context/AuthContext";
import { budgetService, BudgetBab, BudgetFasl } from "../../services/budget";
import { apiClient } from "../../api/apiClient";
import { QRCodeSVG as QRCode } from "qrcode.react";

type TabMode = "manual" | "bulk";

interface LookupItem { id: number; name_ps: string; name_fa: string; }

interface BulkRow {
  name: string;
  typeOrSpecification: string;
  category: string;
  unit: string;
  warehouse: string;
  initialQuantity: number;
  minimumStock: number;
  bab?: string;
  fasl?: string;
  itemCode?: string;
  unitPrice?: number;
  totalPrice?: number;
  company?: string;
  supplier?: string;
  notes?: string;
}

interface ImportResult {
  imported: number;
  duplicates: number;
  invalid: number;
  generatedCodes: number;
  errors: Array<{ row: number; reason: string }>;
  importedItems: Array<{ id: number; tracking_code: string; name: string }>;
}

const COL_MAP: Record<string, keyof BulkRow> = {
  "* د جنس نوم": "name",
  "* مشخصات": "typeOrSpecification",
  "* کټګوري": "category",
  "* واحد": "unit",
  "* ګدام": "warehouse",
  "* ابتدایي مقدار": "initialQuantity",
  "* کمترین حد": "minimumStock",
  "باب": "bab",
  "فصل": "fasl",
  "د جنس کود": "itemCode",
  "قیمت دانه": "unitPrice",
  "ټول قیمت": "totalPrice",
  "شرکت": "company",
  "عرضه کوونکی": "supplier",
  "یادښت": "notes",
};

const emptyForm = {
  name: "",
  category_id: "",
  unit_id: "",
  warehouse_id: "",
  typeOrSpecification: "",
  initialQuantity: 0,
  minimumStockLevel: 0,
  unitPrice: 0,
  supplierOrSource: "",
  description: "",
  bab_id: "",
  fasl_id: "",
};

function escapeCsvValue(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export default function AddItem() {
  const [tab, setTab] = useState<TabMode>("manual");
  const [formData, setFormData] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<LookupItem[]>([]);
  const [units, setUnits] = useState<LookupItem[]>([]);
  const [warehouses, setWarehouses] = useState<LookupItem[]>([]);
  const [babs, setBabs] = useState<BudgetBab[]>([]);
  const [fasls, setFasls] = useState<BudgetFasl[]>([]);
  const [babSearch, setBabSearch] = useState("");
  const [faslSearch, setFaslSearch] = useState("");

  // Add Bab/Fasl
  const [showAddBab, setShowAddBab] = useState(false);
  const [showAddFasl, setShowAddFasl] = useState(false);
  const [newBab, setNewBab] = useState({ bab_code: "", name_ps: "", name_fa: "", description: "" });
  const [newFasl, setNewFasl] = useState({ fasl_code: "", name_ps: "", name_fa: "", description: "" });
  const [addBabLoading, setAddBabLoading] = useState(false);
  const [addFaslLoading, setAddFaslLoading] = useState(false);
  const [addBabError, setAddBabError] = useState("");
  const [addFaslError, setAddFaslError] = useState("");

  // Edit Bab
  const [editingBab, setEditingBab] = useState<BudgetBab | null>(null);
  const [editBabForm, setEditBabForm] = useState({ bab_code: "", name_ps: "", name_fa: "", description: "" });
  const [editBabLoading, setEditBabLoading] = useState(false);
  const [editBabError, setEditBabError] = useState("");
  const [deleteBabConfirm, setDeleteBabConfirm] = useState<number | null>(null);

  // Edit Fasl
  const [editingFasl, setEditingFasl] = useState<BudgetFasl | null>(null);
  const [editFaslForm, setEditFaslForm] = useState({ fasl_code: "", name_ps: "", name_fa: "", description: "" });
  const [editFaslLoading, setEditFaslLoading] = useState(false);
  const [editFaslError, setEditFaslError] = useState("");
  const [deleteFaslConfirm, setDeleteFaslConfirm] = useState<number | null>(null);

  // Inline Add Category
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name_ps: "", name_fa: "", description: "" });
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState("");

  // Inline Add Unit
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnit, setNewUnit] = useState({ name_ps: "", name_fa: "", symbol: "" });
  const [addUnitLoading, setAddUnitLoading] = useState(false);
  const [addUnitError, setAddUnitError] = useState("");

  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkPreviewReady, setBulkPreviewReady] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [printItems, setPrintItems] = useState<Array<{ id: number; tracking_code: string; name: string }>>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [manualSuccess, setManualSuccess] = useState<{ id: string; tracking_code: string; name: string } | null>(null);

  const loadLookups = () => {
    apiClient.get('/inventory/categories').then(setCategories).catch(() => {});
    apiClient.get('/inventory/units').then(setUnits).catch(() => {});
    apiClient.get('/inventory/warehouses').then(setWarehouses).catch(() => {});
  };

  const loadBabs = () => {
    budgetService.getBabs().then(setBabs).catch(() => setBabs([]));
  };

  useEffect(() => {
    loadLookups();
    loadBabs();
  }, []);

  useEffect(() => {
    if (warehouses.length > 0 && !formData.warehouse_id) {
      setFormData(prev => ({ ...prev, warehouse_id: String(warehouses[0].id) }));
    }
  }, [warehouses]);

  useEffect(() => {
    if (formData.bab_id) {
      budgetService.getFaslsByBab(Number(formData.bab_id)).then(setFasls).catch(() => setFasls([]));
      setFormData(prev => ({ ...prev, fasl_id: "" }));
      setFaslSearch("");
      setEditingFasl(null);
    } else {
      setFasls([]);
    }
  }, [formData.bab_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === "minimumStockLevel" || name === "unitPrice" || name === "initialQuantity")
        ? Number(value)
        : value
    }));
  };

  const filteredBabs = babs.filter(b =>
    !babSearch || b.bab_code.includes(babSearch) || b.name_ps.includes(babSearch) || b.name_fa.includes(babSearch)
  );
  const filteredFasls = fasls.filter(f =>
    !faslSearch || f.fasl_code.includes(faslSearch) || f.name_ps.includes(faslSearch) || f.name_fa.includes(faslSearch)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!formData.name || !formData.category_id || !formData.unit_id) {
      alert("مهرباني وکړئ ټول اړین معلومات دننه کړئ.");
      return;
    }
    if (formData.initialQuantity < 0 || formData.minimumStockLevel < 0 || formData.unitPrice < 0) {
      alert("مقدار نه شي کولی منفي وي.");
      return;
    }
    if (formData.fasl_id && !formData.bab_id) {
      alert("مهرباني وکړئ لومړی باب غوره کړئ.");
      return;
    }
    setLoading(true);
    try {
      const newId = await createItem(formData as any, user.uid, profile.name, profile.role);
      let tracking_code = "";
      try {
        const item = await apiClient.get(`/inventory/items/${newId}`);
        tracking_code = item?.tracking_code || "";
      } catch (_) {}
      setManualSuccess({ id: newId, tracking_code, name: formData.name });
    } catch (error) {
      console.error("Error creating item:", error);
      alert("خطا د جنس په ثبتولو کې: " + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  // ── Add Bab ──────────────────────────────────────────────────────────────────
  const handleAddBab = async () => {
    setAddBabError("");
    if (!newBab.bab_code || !newBab.name_ps || !newBab.name_fa) {
      setAddBabError("کود، د پښتو نوم او د دري نوم اړین دي.");
      return;
    }
    setAddBabLoading(true);
    try {
      const created = await budgetService.createBab(newBab);
      setBabs(prev => [...prev, created].sort((a, b) => a.bab_code.localeCompare(b.bab_code)));
      setFormData(prev => ({ ...prev, bab_id: String(created.id), fasl_id: "" }));
      setNewBab({ bab_code: "", name_ps: "", name_fa: "", description: "" });
      setShowAddBab(false);
    } catch (err: any) {
      setAddBabError(err.message || "خطا د باب ثبتولو کې");
    } finally {
      setAddBabLoading(false);
    }
  };

  // ── Edit Bab ─────────────────────────────────────────────────────────────────
  const handleOpenEditBab = (bab: BudgetBab) => {
    setEditingBab(bab);
    setEditBabForm({ bab_code: bab.bab_code, name_ps: bab.name_ps, name_fa: bab.name_fa, description: bab.description || "" });
    setEditBabError("");
    setShowAddBab(false);
  };

  const handleSaveEditBab = async () => {
    setEditBabError("");
    if (!editBabForm.bab_code || !editBabForm.name_ps || !editBabForm.name_fa) {
      setEditBabError("کود، د پښتو نوم او د دري نوم اړین دي.");
      return;
    }
    setEditBabLoading(true);
    try {
      const updated = await budgetService.updateBab(editingBab!.id, editBabForm);
      setBabs(prev => prev.map(b => b.id === updated.id ? updated : b));
      setEditingBab(null);
    } catch (err: any) {
      setEditBabError(err.message || "خطا د باب ساتلو کې");
    } finally {
      setEditBabLoading(false);
    }
  };

  // ── Delete Bab ───────────────────────────────────────────────────────────────
  const handleDeleteBab = async (id: number) => {
    try {
      await budgetService.deleteBab(id);
      setBabs(prev => prev.filter(b => b.id !== id));
      if (formData.bab_id === String(id)) {
        setFormData(prev => ({ ...prev, bab_id: "", fasl_id: "" }));
        setFasls([]);
      }
      setDeleteBabConfirm(null);
    } catch {
      setDeleteBabConfirm(null);
    }
  };

  // ── Add Fasl ─────────────────────────────────────────────────────────────────
  const handleAddFasl = async () => {
    setAddFaslError("");
    if (!formData.bab_id) {
      setAddFaslError("لومړی باب غوره کړئ.");
      return;
    }
    if (!newFasl.fasl_code || !newFasl.name_ps || !newFasl.name_fa) {
      setAddFaslError("کود، د پښتو نوم او د دري نوم اړین دي.");
      return;
    }
    setAddFaslLoading(true);
    try {
      const created = await budgetService.createFasl({ ...newFasl, bab_id: Number(formData.bab_id) });
      setFasls(prev => [...prev, created].sort((a, b) => a.fasl_code.localeCompare(b.fasl_code)));
      setFormData(prev => ({ ...prev, fasl_id: String(created.id) }));
      setNewFasl({ fasl_code: "", name_ps: "", name_fa: "", description: "" });
      setShowAddFasl(false);
    } catch (err: any) {
      setAddFaslError(err.message || "خطا د فصل ثبتولو کې");
    } finally {
      setAddFaslLoading(false);
    }
  };

  // ── Edit Fasl ────────────────────────────────────────────────────────────────
  const handleOpenEditFasl = (fasl: BudgetFasl) => {
    setEditingFasl(fasl);
    setEditFaslForm({ fasl_code: fasl.fasl_code, name_ps: fasl.name_ps, name_fa: fasl.name_fa, description: fasl.description || "" });
    setEditFaslError("");
    setShowAddFasl(false);
  };

  const handleSaveEditFasl = async () => {
    setEditFaslError("");
    if (!editFaslForm.fasl_code || !editFaslForm.name_ps || !editFaslForm.name_fa) {
      setEditFaslError("کود، د پښتو نوم او د دري نوم اړین دي.");
      return;
    }
    setEditFaslLoading(true);
    try {
      const updated = await budgetService.updateFasl(editingFasl!.id, editFaslForm);
      setFasls(prev => prev.map(f => f.id === updated.id ? updated : f));
      setEditingFasl(null);
    } catch (err: any) {
      setEditFaslError(err.message || "خطا د فصل ساتلو کې");
    } finally {
      setEditFaslLoading(false);
    }
  };

  // ── Delete Fasl ──────────────────────────────────────────────────────────────
  const handleDeleteFasl = async (id: number) => {
    try {
      await budgetService.deleteFasl(id);
      setFasls(prev => prev.filter(f => f.id !== id));
      if (formData.fasl_id === String(id)) {
        setFormData(prev => ({ ...prev, fasl_id: "" }));
      }
      setDeleteFaslConfirm(null);
    } catch {
      setDeleteFaslConfirm(null);
    }
  };

  // ── Add Category ─────────────────────────────────────────────────────────────
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

  // ── Add Unit ─────────────────────────────────────────────────────────────────
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

  const handleExportTemplate = () => {
    const headers = [
      "* د جنس نوم", "* مشخصات", "* کټګوري", "* واحد", "* ګدام",
      "* ابتدایي مقدار", "* کمترین حد",
      "باب", "فصل", "د جنس کود", "قیمت دانه", "ټول قیمت", "شرکت", "عرضه کوونکی", "یادښت"
    ];
    const example = [
      "لپتاپ", "Dell Latitude 5420", "کمپیوټري وسایل", "دانه", "مرکزي ګدام",
      "5", "2",
      "۲۰۱", "۲۰۱۰۱", "ITEM-001", "45000", "225000", "Dell Inc.", "احمدي شرکت", "د دفتر لپاره"
    ];
    const csv = [headers, example]
      .map((row) => row.map((value) => escapeCsvValue(String(value))).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kandahar-wms-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setBulkPreviewReady(false);
    setImportResult(null);
    setBulkRows([]);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = parseCsv(String(evt.target?.result || ""));
        if (raw.length < 2) { setFileError("فایل خالي دی."); return; }
        const headers = (raw[0] as string[]).map(h => String(h).trim());
        const rows: BulkRow[] = [];
        for (let i = 1; i < raw.length; i++) {
          const rowRaw = raw[i] as string[];
          if (rowRaw.every(v => !String(v).trim())) continue;
          const row: any = { name: "", typeOrSpecification: "", category: "", unit: "", warehouse: "", initialQuantity: 0, minimumStock: 0 };
          headers.forEach((h, colIdx) => {
            const key = COL_MAP[h];
            if (key) {
              const val = String(rowRaw[colIdx] ?? "").trim();
              if (key === "initialQuantity" || key === "minimumStock" || key === "unitPrice" || key === "totalPrice") {
                row[key] = Number(val) || 0;
              } else {
                row[key] = val;
              }
            }
          });
          rows.push(row);
        }
        if (rows.length === 0) { setFileError("هیڅ کرښه نشته."); return; }
        setBulkRows(rows);
        setBulkPreviewReady(true);
      } catch (err: any) {
        setFileError("فایل لوستل ونشول: " + err.message);
      }
    };
    reader.readAsText(file, "utf-8");
  };

  // If invoked with ?requestId=..., prefill the bulk import rows from the request's items
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const reqId = qs.get("requestId");
    if (!reqId) return;
    let mounted = true;
    import("../../firebase/requests").then(mod => {
      const getRequestById = (mod as any).getRequestById as (id: string) => Promise<any>;
      getRequestById(reqId).then((request: any) => {
        if (!mounted || !request) return;
        if (request.items && Array.isArray(request.items) && request.items.length > 0) {
          const mapped: BulkRow[] = request.items.map((it: any) => ({
            name: it.name || "",
            typeOrSpecification: it.specifications || "",
            category: "",
            unit: it.unit || "",
            warehouse: warehouses.length > 0 ? (warehouses[0].name_ps || String(warehouses[0].id)) : "",
            initialQuantity: it.quantity || 0,
            minimumStock: 0,
            bab: undefined,
            fasl: undefined,
            itemCode: undefined,
            unitPrice: it.unitPrice || 0,
            totalPrice: it.totalPrice || 0,
            company: "",
            supplier: "",
            notes: request.reason || "",
          }));
          setBulkRows(mapped);
          setTab("bulk");
          setBulkPreviewReady(true);
        }
      }).catch(() => {});
    });
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, warehouses]);

  const handleBulkImport = async () => {
    if (!bulkRows.length) return;
    setBulkImporting(true);
    setImportResult(null);
    try {
      const result = await apiClient.post("/inventory/bulk-import", { rows: bulkRows });
      setImportResult(result);
      if (result.importedItems?.length > 0) setPrintItems(result.importedItems);
      setBulkPreviewReady(false);
    } catch (err: any) {
      setFileError("د وارد کولو خطا: " + err.message);
    } finally {
      setBulkImporting(false);
    }
  };

  const setBulkRowField = (index: number, field: keyof BulkRow, value: any) => {
    setBulkRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value } as BulkRow;
      return copy;
    });
  };

  const selectedBab = babs.find(b => String(b.id) === formData.bab_id);
  const selectedFasl = fasls.find(f => String(f.id) === formData.fasl_id);

  const selectCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
  const inputCls = "mb-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
  const listItemCls = "flex items-center justify-between border-t border-gray-100 dark:border-gray-800 transition-colors";

  return (
    <>
      <PageMeta title="نوی جنس اضافه کول | Kandahar University WMS" description="ګودام ته د نوي جنس زیاتول" />
      <Breadcrumb pageTitle="نوی جنس اضافه کول / اضافه کردن جنس جدید" />

      {/* Delete Bab Confirm */}
      {deleteBabConfirm !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteBabConfirm(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full" dir="rtl">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">⚠️</div>
              <p className="text-gray-800 dark:text-white font-semibold">ایا ډاډه یاست؟ دا باب به ړنګ شي.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteBabConfirm(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">لغوه</button>
              <button onClick={() => handleDeleteBab(deleteBabConfirm)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-bold transition-all">ړنګول</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Fasl Confirm */}
      {deleteFaslConfirm !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteFaslConfirm(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full" dir="rtl">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">⚠️</div>
              <p className="text-gray-800 dark:text-white font-semibold">ایا ډاډه یاست؟ دا فصل به ړنګ شي.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteFaslConfirm(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-2.5 text-sm font-medium">لغوه</button>
              <button onClick={() => handleDeleteFasl(deleteFaslConfirm)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-bold transition-all">ړنګول</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button onClick={() => setTab("manual")}
            className={`pb-3 px-4 text-sm font-semibold transition border-b-2 -mb-px ${tab === "manual" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
            dir="rtl">د لاس له لارې اضافه کول</button>
          <button onClick={() => setTab("bulk")}
            className={`pb-3 px-4 text-sm font-semibold transition border-b-2 -mb-px ${tab === "bulk" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
            dir="rtl">د اکسیل له لارې ډله‌ییز وارد کول</button>
        </div>

        {tab === "manual" && (
          <>
            {manualSuccess ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10 p-5 text-right" dir="rtl">
                  <p className="text-green-700 dark:text-green-400 font-semibold text-base mb-1">✓ جنس "{manualSuccess.name}" ثبت شو!</p>
                  {manualSuccess.tracking_code && (
                    <p className="text-green-600 dark:text-green-300 text-sm">ترکینګ کوډ: <span className="font-mono font-bold">{manualSuccess.tracking_code}</span></p>
                  )}
                </div>
                {manualSuccess.tracking_code && (
                  <div className="flex flex-col items-center gap-3 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300" dir="rtl">د چاپ لپاره QR کوډ</p>
                    <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <QRCode value={manualSuccess.tracking_code} size={130} level="M" includeMargin />
                    </div>
                    <p className="text-xs font-mono font-bold text-gray-600 dark:text-gray-400">{manualSuccess.tracking_code}</p>
                    <div className="flex gap-3">
                      <Button onClick={() => window.print()} variant="outline" className="text-sm">🖨️ د بارکوډ چاپ</Button>
                      <Button onClick={() => setManualSuccess(null)} variant="outline" className="text-sm">+ نوی جنس</Button>
                      <Button onClick={() => navigate("/inventory/items")} className="text-sm">لیست ته ورو</Button>
                    </div>
                  </div>
                )}
                {!manualSuccess.tracking_code && (
                  <div className="flex gap-3 justify-end">
                    <Button onClick={() => navigate("/inventory/items")}>د اجناسو لیست</Button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* ── Bab / Fasl ────────────────────────────────────────── */}
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
                  <div className="flex items-center justify-between mb-3" dir="rtl">
                    <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">د بودجې طبقه‌بندي (باب / فصل)</h3>
                    <span className="text-xs text-blue-500">(اختیاري)</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                    {/* ── Bab Column ── */}
                    <div>
                      <div className="flex items-center justify-between mb-1" dir="rtl">
                        <Label>باب (Bab)</Label>
                        <button type="button"
                          onClick={() => { setShowAddBab(v => !v); setAddBabError(""); setEditingBab(null); }}
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                          {showAddBab ? "✕ بندول" : "+ نوی باب"}
                        </button>
                      </div>

                      {/* Add Bab form */}
                      {showAddBab && (
                        <div className="mb-2 rounded-lg border border-blue-200 bg-white dark:bg-gray-900 dark:border-blue-900/40 p-3 space-y-2" dir="rtl">
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">د نوي باب اضافه کول</p>
                          <input placeholder="کود (مثلاً: 230)" value={newBab.bab_code} onChange={e => setNewBab(p => ({ ...p, bab_code: e.target.value }))} className={inputCls} dir="ltr" />
                          <input placeholder="د پښتو نوم" value={newBab.name_ps} onChange={e => setNewBab(p => ({ ...p, name_ps: e.target.value }))} className={inputCls} dir="rtl" />
                          <input placeholder="نام دری" value={newBab.name_fa} onChange={e => setNewBab(p => ({ ...p, name_fa: e.target.value }))} className={inputCls} dir="rtl" />
                          <input placeholder="توضیحات (اختیاري)" value={newBab.description} onChange={e => setNewBab(p => ({ ...p, description: e.target.value }))} className={inputCls} dir="rtl" />
                          {addBabError && <p className="text-xs text-red-500">{addBabError}</p>}
                          <div className="flex gap-2">
                            <button type="button" onClick={handleAddBab} disabled={addBabLoading}
                              className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
                              {addBabLoading ? "ثبتېږي..." : "✓ ثبتول"}
                            </button>
                            <button type="button" onClick={() => setShowAddBab(false)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                              لغوه
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Edit Bab inline form */}
                      {editingBab && (
                        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/40 p-3 space-y-2" dir="rtl">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">✏️ د باب سمول — {editingBab.bab_code}</p>
                          <input placeholder="کود" value={editBabForm.bab_code} onChange={e => setEditBabForm(p => ({ ...p, bab_code: e.target.value }))} className={inputCls} dir="ltr" />
                          <input placeholder="د پښتو نوم" value={editBabForm.name_ps} onChange={e => setEditBabForm(p => ({ ...p, name_ps: e.target.value }))} className={inputCls} dir="rtl" />
                          <input placeholder="نام دری" value={editBabForm.name_fa} onChange={e => setEditBabForm(p => ({ ...p, name_fa: e.target.value }))} className={inputCls} dir="rtl" />
                          <input placeholder="توضیحات (اختیاري)" value={editBabForm.description} onChange={e => setEditBabForm(p => ({ ...p, description: e.target.value }))} className={inputCls} dir="rtl" />
                          {editBabError && <p className="text-xs text-red-500">{editBabError}</p>}
                          <div className="flex gap-2">
                            <button type="button" onClick={handleSaveEditBab} disabled={editBabLoading}
                              className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition">
                              {editBabLoading ? "ساتل..." : "✓ ساتل"}
                            </button>
                            <button type="button" onClick={() => setEditingBab(null)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                              لغوه
                            </button>
                          </div>
                        </div>
                      )}

                      <input type="text" placeholder="د باب لټون..." value={babSearch} onChange={e => setBabSearch(e.target.value)}
                        className={inputCls} dir="rtl" />

                      {/* Bab custom list with edit/delete */}
                      <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" dir="rtl">
                        <div
                          onClick={() => setFormData(p => ({ ...p, bab_id: "", fasl_id: "" }))}
                          className={`px-3 py-2 text-sm cursor-pointer ${!formData.bab_id ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold" : "text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                          -- باب غوره کړئ --
                        </div>
                        {filteredBabs.map(b => (
                          <div key={b.id} className={`${listItemCls} ${String(b.id) === formData.bab_id ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}>
                            <div className="flex items-center gap-0.5 px-1 shrink-0">
                              <button type="button" onClick={() => setDeleteBabConfirm(b.id)}
                                className="p-1 text-red-400 hover:text-red-600 transition rounded" title="ړنګول">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                              <button type="button" onClick={() => handleOpenEditBab(b)}
                                className="p-1 text-blue-400 hover:text-blue-600 transition rounded" title="سمول">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              </button>
                            </div>
                            <div className="flex-1 text-right px-2 py-2 cursor-pointer text-sm"
                              onClick={() => { setFormData(p => ({ ...p, bab_id: String(b.id), fasl_id: "" })); setEditingBab(null); }}>
                              <span className={String(b.id) === formData.bab_id ? "font-semibold text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-white/80"}>
                                {b.bab_code} - {b.name_ps}
                              </span>
                            </div>
                          </div>
                        ))}
                        {filteredBabs.length === 0 && babSearch && (
                          <p className="text-xs text-gray-400 text-center py-3">پایله ونه موندله</p>
                        )}
                      </div>
                      {selectedBab && <p className="mt-1 text-xs text-blue-700 dark:text-blue-300" dir="rtl">✓ {selectedBab.bab_code} — {selectedBab.name_ps}</p>}
                    </div>

                    {/* ── Fasl Column ── */}
                    <div>
                      <div className="flex items-center justify-between mb-1" dir="rtl">
                        <Label>فصل (Fasl)</Label>
                        {formData.bab_id && (
                          <button type="button" onClick={() => { setShowAddFasl(v => !v); setAddFaslError(""); setEditingFasl(null); }}
                            className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                            {showAddFasl ? "✕ بندول" : "+ نوی فصل"}
                          </button>
                        )}
                      </div>

                      {/* Add Fasl form */}
                      {showAddFasl && formData.bab_id && (
                        <div className="mb-2 rounded-lg border border-blue-200 bg-white dark:bg-gray-900 dark:border-blue-900/40 p-3 space-y-2" dir="rtl">
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                            د نوي فصل اضافه کول — باب: {selectedBab?.bab_code}
                          </p>
                          <input placeholder="کود (مثلاً: 22311)" value={newFasl.fasl_code} onChange={e => setNewFasl(p => ({ ...p, fasl_code: e.target.value }))} className={inputCls} dir="ltr" />
                          <input placeholder="د پښتو نوم" value={newFasl.name_ps} onChange={e => setNewFasl(p => ({ ...p, name_ps: e.target.value }))} className={inputCls} dir="rtl" />
                          <input placeholder="نام دری" value={newFasl.name_fa} onChange={e => setNewFasl(p => ({ ...p, name_fa: e.target.value }))} className={inputCls} dir="rtl" />
                          <input placeholder="توضیحات (اختیاري)" value={newFasl.description} onChange={e => setNewFasl(p => ({ ...p, description: e.target.value }))} className={inputCls} dir="rtl" />
                          {addFaslError && <p className="text-xs text-red-500">{addFaslError}</p>}
                          <div className="flex gap-2">
                            <button type="button" onClick={handleAddFasl} disabled={addFaslLoading}
                              className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
                              {addFaslLoading ? "ثبتېږي..." : "✓ ثبتول"}
                            </button>
                            <button type="button" onClick={() => setShowAddFasl(false)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                              لغوه
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Edit Fasl inline form */}
                      {editingFasl && (
                        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/40 p-3 space-y-2" dir="rtl">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">✏️ د فصل سمول — {editingFasl.fasl_code}</p>
                          <input placeholder="کود" value={editFaslForm.fasl_code} onChange={e => setEditFaslForm(p => ({ ...p, fasl_code: e.target.value }))} className={inputCls} dir="ltr" />
                          <input placeholder="د پښتو نوم" value={editFaslForm.name_ps} onChange={e => setEditFaslForm(p => ({ ...p, name_ps: e.target.value }))} className={inputCls} dir="rtl" />
                          <input placeholder="نام دری" value={editFaslForm.name_fa} onChange={e => setEditFaslForm(p => ({ ...p, name_fa: e.target.value }))} className={inputCls} dir="rtl" />
                          <input placeholder="توضیحات (اختیاري)" value={editFaslForm.description} onChange={e => setEditFaslForm(p => ({ ...p, description: e.target.value }))} className={inputCls} dir="rtl" />
                          {editFaslError && <p className="text-xs text-red-500">{editFaslError}</p>}
                          <div className="flex gap-2">
                            <button type="button" onClick={handleSaveEditFasl} disabled={editFaslLoading}
                              className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition">
                              {editFaslLoading ? "ساتل..." : "✓ ساتل"}
                            </button>
                            <button type="button" onClick={() => setEditingFasl(null)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                              لغوه
                            </button>
                          </div>
                        </div>
                      )}

                      <input type="text" placeholder="د فصل لټون..." value={faslSearch}
                        onChange={e => setFaslSearch(e.target.value)}
                        disabled={!formData.bab_id}
                        className={`${inputCls} disabled:opacity-40`} dir="rtl" />

                      {/* Fasl custom list with edit/delete */}
                      <div className={`max-h-44 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 ${!formData.bab_id ? "opacity-40 pointer-events-none" : ""}`} dir="rtl">
                        <div
                          onClick={() => setFormData(p => ({ ...p, fasl_id: "" }))}
                          className={`px-3 py-2 text-sm cursor-pointer ${!formData.fasl_id ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold" : "text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                          -- فصل غوره کړئ --
                        </div>
                        {filteredFasls.map(f => (
                          <div key={f.id} className={`${listItemCls} ${String(f.id) === formData.fasl_id ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}>
                            <div className="flex items-center gap-0.5 px-1 shrink-0">
                              <button type="button" onClick={() => setDeleteFaslConfirm(f.id)}
                                className="p-1 text-red-400 hover:text-red-600 transition rounded" title="ړنګول">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                              <button type="button" onClick={() => handleOpenEditFasl(f)}
                                className="p-1 text-blue-400 hover:text-blue-600 transition rounded" title="سمول">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              </button>
                            </div>
                            <div className="flex-1 text-right px-2 py-2 cursor-pointer text-sm"
                              onClick={() => { setFormData(p => ({ ...p, fasl_id: String(f.id) })); setEditingFasl(null); }}>
                              <span className={String(f.id) === formData.fasl_id ? "font-semibold text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-white/80"}>
                                {f.fasl_code} - {f.name_ps}
                              </span>
                            </div>
                          </div>
                        ))}
                        {!formData.bab_id && (
                          <p className="text-xs text-gray-400 text-center py-3">لومړی باب غوره کړئ</p>
                        )}
                        {formData.bab_id && filteredFasls.length === 0 && faslSearch && (
                          <p className="text-xs text-gray-400 text-center py-3">پایله ونه موندله</p>
                        )}
                        {formData.bab_id && filteredFasls.length === 0 && !faslSearch && (
                          <p className="text-xs text-gray-400 text-center py-3">د دې باب لپاره فصل نشته</p>
                        )}
                      </div>
                      {selectedFasl && <p className="mt-1 text-xs text-blue-700 dark:text-blue-300" dir="rtl">✓ {selectedFasl.fasl_code} — {selectedFasl.name_ps}</p>}
                    </div>
                  </div>
                </div>

                {/* ── Item Details ───────────────────────────────────────── */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <Label>د جنس نوم / نام جنس <span className="text-error-500">*</span></Label>
                    <Input name="name" value={formData.name} onChange={handleChange} required placeholder="مثلاً: قلم، لپټاپ" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1" dir="rtl">
                      <Label>کټګوري / کتګوری <span className="text-error-500">*</span></Label>
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
                    <select name="category_id" value={formData.category_id} onChange={handleChange} required className={selectCls} dir="rtl">
                      <option value="">-- کټګوري غوره کړئ --</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name_ps}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1" dir="rtl">
                      <Label>واحد / واحد <span className="text-error-500">*</span></Label>
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
                    <select name="unit_id" value={formData.unit_id} onChange={handleChange} required className={selectCls} dir="rtl">
                      <option value="">-- واحد غوره کړئ --</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name_ps}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>ګدام <span className="text-error-500">*</span></Label>
                    <select name="warehouse_id" value={formData.warehouse_id} onChange={handleChange} required className={selectCls} dir="rtl">
                      <option value="">-- ګدام غوره کړئ --</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ps}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>مقدار <span className="text-error-500">*</span></Label>
                    <Input type="number" name="initialQuantity" value={formData.initialQuantity} onChange={handleChange} min="0" required />
                  </div>
                  <div>
                    <Label>کم حد / حداقل موجودی</Label>
                    <Input type="number" name="minimumStockLevel" value={formData.minimumStockLevel} onChange={handleChange} min="0" />
                  </div>
                  <div>
                    <Label>واحد قیمت</Label>
                    <Input type="number" name="unitPrice" value={formData.unitPrice} onChange={handleChange} min="0" />
                  </div>
                  <div>
                    <Label>تهیه کوونکی / منبع</Label>
                    <Input name="supplierOrSource" value={formData.supplierOrSource} onChange={handleChange} placeholder="محلي بازار، مرکزی ذخیره" />
                  </div>
                </div>
                <div>
                  <Label>مشخصات</Label>
                  <Input name="typeOrSpecification" value={formData.typeOrSpecification} onChange={handleChange} placeholder="ماډل، رنګ، اندازه" />
                </div>
                <div>
                  <Label>توضیحات</Label>
                  <textarea name="description" value={formData.description} onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-gray-800 outline-none transition focus:border-primary dark:border-gray-700 dark:text-white/90 text-right" rows={3} />
                </div>
                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" onClick={() => navigate("/inventory/items")}>لغوه کول</Button>
                  <Button type="submit" disabled={loading}>{loading ? "ثبتېږي..." : "ثبتول"}</Button>
                </div>
              </form>
            )}
          </>
        )}

        {tab === "bulk" && (
          <div className="space-y-5" dir="rtl">
            <div className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">لومړی ګام: د CSV فارمټ ښکته کول</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">د فارمټ ښکته کړئ، ډک کړئ، بیا پورته کړئ.</p>
              <Button onClick={handleExportTemplate} variant="outline" className="text-sm">
                ⬇ د CSV فارمټ ښکته کول
              </Button>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">دویم ګام: د CSV فایل پورته کول</h4>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileSelect} className="hidden" />
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="text-sm">
                📂 د CSV فایل غوره کول
              </Button>
              {fileError && <p className="text-xs text-red-500">{fileError}</p>}
            </div>

            {bulkPreviewReady && bulkRows.length > 0 && !importResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">د وارد کولو مخکتنه ({bulkRows.length} کرښه)</h4>
                  <Button onClick={handleBulkImport} disabled={bulkImporting} className="text-sm">
                    {bulkImporting ? "وارد کېږي..." : "✓ وارد کول / ثبت کول"}
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-xs" dir="rtl">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        {["#","نوم","مشخصات","کټګوري","واحد","ګدام","مقدار","کم حد","قیمت"].map(h => (
                          <th key={h} className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row, i) => {
                        const isInvalid = !row.name || !row.typeOrSpecification || !row.category || !row.unit || !row.warehouse;
                        return (
                          <tr key={i} className={`border-t border-gray-100 dark:border-gray-800 ${isInvalid ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                            <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                            <td className={`px-3 py-2 font-medium ${!row.name ? "text-red-500" : "text-gray-800 dark:text-white/90"}`}>
                              <input value={row.name} onChange={e => setBulkRowField(i, 'name', e.target.value)} className="w-44 text-sm px-2 py-1 rounded-lg border" />
                            </td>
                            <td className={`px-3 py-2 ${!row.typeOrSpecification ? "text-red-500" : "text-gray-600"}`}>
                              <input value={row.typeOrSpecification} onChange={e => setBulkRowField(i, 'typeOrSpecification', e.target.value)} className="w-56 text-sm px-2 py-1 rounded-lg border" />
                            </td>
                            <td className={`px-3 py-2 ${!row.category ? "text-red-500" : "text-gray-600"}`}>
                              {categories.length > 0 ? (
                                <select value={row.category} onChange={e => setBulkRowField(i, 'category', e.target.value)} className="text-sm px-2 py-1 rounded-lg border">
                                  <option value="">-- انتخاب کړئ --</option>
                                  {categories.map(c => <option key={c.id} value={c.name_ps || c.name_fa}>{c.name_ps || c.name_fa}</option>)}
                                </select>
                              ) : (
                                <input value={row.category} onChange={e => setBulkRowField(i, 'category', e.target.value)} className="w-36 text-sm px-2 py-1 rounded-lg border" />
                              )}
                            </td>
                            <td className={`px-3 py-2 ${!row.unit ? "text-red-500" : "text-gray-600"}`}>
                              {units.length > 0 ? (
                                <select value={row.unit} onChange={e => setBulkRowField(i, 'unit', e.target.value)} className="text-sm px-2 py-1 rounded-lg border">
                                  <option value="">-- انتخاب کړئ --</option>
                                  {units.map(u => <option key={u.id} value={u.name_ps || u.name_fa}>{u.name_ps || u.name_fa}</option>)}
                                </select>
                              ) : (
                                <input value={row.unit} onChange={e => setBulkRowField(i, 'unit', e.target.value)} className="w-24 text-sm px-2 py-1 rounded-lg border" />
                              )}
                            </td>
                            <td className={`px-3 py-2 ${!row.warehouse ? "text-red-500" : "text-gray-600"}`}>
                              {warehouses.length > 0 ? (
                                <select value={row.warehouse} onChange={e => setBulkRowField(i, 'warehouse', e.target.value)} className="text-sm px-2 py-1 rounded-lg border">
                                  <option value="">-- انتخاب کړئ --</option>
                                  {warehouses.map(w => <option key={w.id} value={w.name_ps || w.name_fa || String(w.id)}>{w.name_ps || w.name_fa || w.id}</option>)}
                                </select>
                              ) : (
                                <input value={row.warehouse} onChange={e => setBulkRowField(i, 'warehouse', e.target.value)} className="w-36 text-sm px-2 py-1 rounded-lg border" />
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              <input type="number" value={row.initialQuantity} onChange={e => setBulkRowField(i, 'initialQuantity', Number(e.target.value))} className="w-20 text-sm px-2 py-1 rounded-lg border" />
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              <input type="number" value={row.minimumStock} onChange={e => setBulkRowField(i, 'minimumStock', Number(e.target.value))} className="w-20 text-sm px-2 py-1 rounded-lg border" />
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              <input type="number" value={row.unitPrice || 0} onChange={e => setBulkRowField(i, 'unitPrice', Number(e.target.value))} className="w-24 text-sm px-2 py-1 rounded-lg border" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importResult && (
              <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10 p-4 space-y-2" dir="rtl">
                <p className="font-semibold text-green-700 dark:text-green-400">
                  ✓ {importResult.imported} جنسونه ثبت شول
                </p>
                {importResult.duplicates > 0 && <p className="text-xs text-orange-600">{importResult.duplicates} تکراري جنسونه</p>}
                {importResult.invalid > 0 && <p className="text-xs text-red-600">{importResult.invalid} ناسم کرښې</p>}
                {importResult.errors.length > 0 && (
                  <div className="text-xs text-red-500 space-y-0.5 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => <p key={i}>کرښه {err.row}: {err.reason}</p>)}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  {printItems.length > 0 && (
                    <Button onClick={() => setShowPrintPreview(true)} variant="outline" className="text-sm">
                      🖨️ بارکوډونه چاپول ({printItems.length})
                    </Button>
                  )}
                  <Button onClick={() => navigate("/inventory/items")} className="text-sm">
                    د اجناسو لیست
                  </Button>
                </div>
              </div>
            )}

            {showPrintPreview && printItems.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <div className="flex items-center justify-between" dir="rtl">
                  <h4 className="text-sm font-semibold">بارکوډ مخکتنه</h4>
                  <button onClick={() => window.print()} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white">چاپول</button>
                </div>
                <div className="flex flex-wrap gap-4 print:gap-2">
                  {printItems.map(item => (
                    <div key={item.id} className="flex flex-col items-center gap-1 p-3 border border-gray-200 rounded-lg text-center">
                      <QRCode value={item.tracking_code} size={90} level="M" includeMargin />
                      <p className="text-xs font-semibold text-gray-800 dark:text-white/90 max-w-[120px] truncate">{item.name}</p>
                      <p className="text-xs font-mono text-gray-500">{item.tracking_code}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
