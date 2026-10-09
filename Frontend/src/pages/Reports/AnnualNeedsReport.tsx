import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { calculateAnnualNeeds } from "../../firebase/reports";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

export default function AnnualNeedsReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNeeds();
  }, []);

  const fetchNeeds = async () => {
    setLoading(true);
    const result = await calculateAnnualNeeds();
    setData(result);
    setLoading(false);
  };

  return (
    <>
      <PageMeta title="کلنۍ اړتیاوې | Kandahar University WMS" description="د اجناسو د کلنۍ اړتیاوو تحلیل" />
      <Breadcrumb pageTitle="د کلنۍ اړتیاوو تحلیل / تحلیل نیازمندی سالانه" />
      <div className="flex justify-end mb-2" dir="rtl"><CurrentDateBadge /></div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-6 bg-primary/5 p-4 rounded-xl border border-primary/10">
          <h4 className="text-primary font-bold mb-2">د محاسبې فارمول:</h4>
          <p className="text-xs text-primary/70 leading-relaxed">
            کلنۍ اړتیا = د تیرو ۱۲ میاشتو مجموعي مصرف (OUT transactions). <br />
            د پیرودلو وړاندیز = (کلنۍ اړتیا) - (اوسنۍ موجودي). که پایله منفي وي، وړاندیز صفر دی.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white/90">
                <th className="px-4 py-4 border">د جنس نوم</th>
                <th className="px-4 py-4 border">اوسنۍ موجودي</th>
                <th className="px-4 py-4 border">د ۱۲ میاشتو مصرف</th>
                <th className="px-4 py-4 border">تخمیني اړتیا</th>
                <th className="px-4 py-4 border">خاليګاه (Gap)</th>
                <th className="px-4 py-4 border">د پیرودلو وړاندیز</th>
                <th className="px-4 py-4 border">اړتیا</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 italic">تحلیل کیږي...</td></tr>
              ) : data.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-3 border font-bold">{item.name}</td>
                  <td className="px-4 py-3 border">{item.currentQuantity} {item.unit}</td>
                  <td className="px-4 py-3 border text-blue-600 font-bold">{item.historicalConsumption}</td>
                  <td className="px-4 py-3 border font-bold">{item.annualNeed}</td>
                  <td className="px-4 py-3 border text-red-600 font-bold">{item.gap}</td>
                  <td className="px-4 py-3 border bg-primary/5 text-primary font-black">{item.recommendedPurchase}</td>
                  <td className="px-4 py-3 border">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.priority === 'High' ? 'bg-red-100 text-red-700' : 
                      item.priority === 'Medium' ? 'bg-orange-100 text-orange-700' : 
                      'bg-green-100 text-green-700'
                    }`}>
                      {item.priority === 'High' ? 'لوړه' : item.priority === 'Medium' ? 'متوسطه' : 'کمه'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
