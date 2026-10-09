import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import Button from "../../components/ui/button/Button";
import { getRequestById, InventoryRequest } from "../../firebase/requests";
import { addVendorOffer, createProcurementCase } from "../../firebase/procurement";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

export default function VendorOffersPage() {
  const { id } = useParams();
  const [request, setRequest] = useState<InventoryRequest | null>(null);
  const [formData, setFormData] = useState({
    vendorName: "",
    vendorPhone: "",
    vendorAddress: "",
    deliveryTime: "",
    warrantyOrNotes: "",
    items: [] as any[]
  });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { pick } = useLanguage();
  const navigate = useNavigate();

  const selCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary dark:bg-gray-800 dark:border-gray-600 dark:text-white/90";
  const readonlyCls = "w-full rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300";

  useEffect(() => {
    if (id) fetchRequest(id);
  }, [id]);

  const fetchRequest = async (requestId: string) => {
    const data = await getRequestById(requestId);
    if (data) {
      setRequest(data);
      setFormData(prev => ({
        ...prev,
        items: data.items.map(item => ({
          itemId: item.itemId,
          itemName: item.name,
          specifications: item.specifications || "",
          quantity: item.quantity,
          unit: item.unit,
          // Vendor prices belong only to this offer. Never prefill them from
          // the original request, because the comparison form must use the
          // values entered in the Prices / Offers section.
          unitPrice: 0,
          totalPrice: 0,
        }))
      }));
    }
  };

  const handlePriceChange = (index: number, price: number) => {
    const newItems = [...formData.items];
    newItems[index].unitPrice = price;
    newItems[index].totalPrice = price * newItems[index].quantity;
    setFormData({ ...formData, items: newItems });
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const newItems = [...formData.items];
    newItems[index].quantity = qty;
    newItems[index].totalPrice = newItems[index].unitPrice * qty;
    setFormData({ ...formData, items: newItems });
  };

  const grandTotal = formData.items.reduce((s, i) => s + (i.totalPrice || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    const normalizedPhone = formData.vendorPhone.replace(/\D/g, "");
    if (!formData.vendorName || formData.items.some(i => i.unitPrice <= 0)) {
      alert(pick("مهرباني وکړئ د شرکت نوم او ټول نرخونه سم ولیکئ.", "لطفاً نام شرکت و تمام قیمت‌ها را وارد کنید."));
      return;
    }
    if (!/^07\d{8}$/.test(normalizedPhone)) {
      alert(pick("د شرکت د اړیکې شمېره حتمي ده او باید د افغانستان ۱۰ عددي شمېره وي، لکه 0701234567.", "شماره تماس شرکت الزامی است و باید یک شماره ۱۰ رقمی افغانستان باشد، مانند 0701234567."));
      return;
    }

    setLoading(true);
    try {
      // Ensure procurement case exists first
      const caseId = await createProcurementCase(id);
      await addVendorOffer({
        ...formData,
        vendorPhone: normalizedPhone,
        requestId: id,
        procurementId: String(caseId)
      }, { uid: user.uid, name: user.displayName || "Procurement Director" });

      alert(pick("نرخ په بریالیتوب سره ثبت شو.", "قیمت با موفقیت ثبت شد."));
      navigate(`/procurement/details/${id}`);
    } catch (error) {
      console.error("Error adding offer:", error);
      alert(pick("د ثبتولو پر مهال تېروتنه وشوه.", "خطایی در ثبت رخ داد."));
    } finally {
      setLoading(false);
    }
  };

  if (!request) return <div className="p-10 text-center text-gray-500">{pick("بارول...", "در حال بارگذاری...")}</div>;

  return (
    <>
      <PageMeta title={pick("د نرخ ثبتول", "ثبت نرخ فروشنده") + " | Kandahar University WMS"} description="" />
      <Breadcrumb pageTitle={pick("د نرخ ثبتول", "ثبت نرخ فروشنده")} />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]" dir="rtl">
        {/* Request summary */}
        <div className="mb-6 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 px-4 py-3">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            {pick("غوښتنه:", "درخواست:")} <span className="font-bold">{request.faculty}</span>
            {request.departmentOrPerson && <> — {request.departmentOrPerson}</>}
            <span className="mr-3 text-blue-400">|</span>
            {pick("غوښتونکی:", "درخواست‌کننده:")} <span className="font-bold">{request.requesterName}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vendor info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                {pick("د شرکت نوم *", "نام شرکت *")}
              </label>
              <input
                type="text"
                value={formData.vendorName}
                onChange={e => setFormData({ ...formData, vendorName: e.target.value })}
                required
                className={selCls}
                placeholder={pick("د شرکت بشپړ نوم...", "نام کامل شرکت...")}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                {pick("د اړیکې شمیره *", "شماره تماس *")}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={formData.vendorPhone}
                onChange={e => setFormData({ ...formData, vendorPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                required
                minLength={10}
                maxLength={10}
                pattern="07[0-9]{8}"
                title={pick("د افغانستان ۱۰ عددي شمېره ولیکئ، لکه 0701234567", "شماره ۱۰ رقمی افغانستان را وارد کنید، مانند 0701234567")}
                className={selCls}
                placeholder="0701234567"
              />
            </div>
          </div>

          {/* Items table */}
          <div className="border-t pt-5 dark:border-gray-700">
            <h4 className="text-sm font-bold text-gray-800 dark:text-white/90 mb-4">
              {pick("د اجناسو نرخونه", "قیمت اجناس")}
              <span className="mr-2 text-xs font-normal text-gray-400">
                ({pick(`${formData.items.length} قلمه`, `${formData.items.length} قلم`)})
              </span>
            </h4>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">#</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">{pick("جنس", "جنس")}</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">{pick("مشخصات / نوع", "مشخصات / نوع")}</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">{pick("مقدار", "مقدار")}</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">{pick("واحد", "واحد")}</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">{pick("في قیمت (افغانۍ) *", "قیمت واحد (افغانی) *")}</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">{pick("مجموعه (افغانۍ)", "مجموع (افغانی)")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {formData.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-3 text-xs text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-3 font-medium text-gray-800 dark:text-white/90 min-w-[140px]">
                        {item.itemName}
                      </td>
                      <td className="px-3 py-3 text-gray-500 dark:text-gray-400 min-w-[160px]">
                        <input
                          type="text"
                          value={item.specifications}
                          onChange={e => {
                            const newItems = [...formData.items];
                            newItems[idx].specifications = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                          className={`${selCls} text-xs`}
                          placeholder={pick("مشخصات...", "مشخصات...")}
                        />
                      </td>
                      <td className="px-3 py-3 min-w-[80px]">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => handleQuantityChange(idx, Number(e.target.value))}
                          min="1"
                          className={`${selCls} text-center`}
                        />
                      </td>
                      <td className="px-3 py-3 min-w-[80px]">
                        <div className={`${readonlyCls} text-center`}>{item.unit || "—"}</div>
                      </td>
                      <td className="px-3 py-3 min-w-[120px]">
                        <input
                          type="number"
                          value={item.unitPrice || ""}
                          onChange={e => handlePriceChange(idx, Number(e.target.value))}
                          min="0"
                          required
                          placeholder="0"
                          className={`${selCls} text-center`}
                        />
                      </td>
                      <td className="px-3 py-3 min-w-[120px]">
                        <div className={`${readonlyCls} text-center font-bold text-primary`}>
                          {item.totalPrice > 0 ? `؋ ${item.totalPrice.toLocaleString()}` : "—"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {grandTotal > 0 && (
                  <tfoot className="border-t-2 border-primary/20 bg-primary/5">
                    <tr>
                      <td colSpan={6} className="px-3 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-300 text-left">
                        {pick("ټولټال مجموعه:", "مجموع کل:")}
                      </td>
                      <td className="px-3 py-2.5 font-black text-primary text-sm">
                        {"\u060B"} {grandTotal.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Delivery & warranty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t dark:border-gray-700">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                {pick("د تسلیمۍ وخت (ورځې)", "مدت تحویل (روز)")}
              </label>
              <input
                type="text"
                value={formData.deliveryTime}
                onChange={e => setFormData({ ...formData, deliveryTime: e.target.value })}
                className={selCls}
                placeholder={pick("مثلاً: ۷ ورځې", "مثلاً: ۷ روز")}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                {pick("توضیحات یا تضمین", "توضیحات یا ضمانت")}
              </label>
              <input
                type="text"
                value={formData.warrantyOrNotes}
                onChange={e => setFormData({ ...formData, warrantyOrNotes: e.target.value })}
                className={selCls}
                placeholder={pick("تضمین، توضیحات...", "ضمانت، توضیحات...")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-5 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(`/procurement/details/${id}`)}>
              {pick("لغوه کول", "لغو")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? pick("ثبتیږي...", "در حال ثبت...") : pick("نرخ ثبتول", "ثبت قیمت")}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
