import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";
import { performHealthCheck } from "../../firebase/maintenance";
import { useAuth } from "../../context/AuthContext";
import CurrentDateBadge from "../../components/common/CurrentDateBadge";

export default function SystemHealth() {
  const [health, setHealth] = useState<any>(null);
  const { profile } = useAuth();

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    const data = await performHealthCheck();
    setHealth(data);
  };

  const statusItems = [
    { label: "د فایربیس پیوستون (Firebase)", value: health?.firebaseConnected ? "وصل دی" : "قطع دی", status: health?.firebaseConnected ? 'success' : 'error' },
    { label: "د سیسټم حالت (System)", value: health?.status || "...", status: health?.status === 'Healthy' ? 'success' : 'error' },
    { label: "د ځواب سرعت (Latency)", value: health?.latency || "...", status: 'neutral' },
    { label: "د فعالیتونو وروستی ریکارډ", value: health?.lastAudit || "...", status: 'neutral' },
    { label: "ستاسو رول (Role)", value: profile?.role || "...", status: 'neutral' },
    { label: "ستاسو حالت (Active)", value: profile?.active ? "فعال" : "غیر فعال", status: profile?.active ? 'success' : 'error' },
  ];

  return (
    <>
      <PageMeta title="د سیسټم روغتیا | Kandahar University WMS" description="د سیسټم روغتیا، سرعت او د پیوستون حالت چک کول." />
      <Breadcrumb pageTitle="د سیسټم روغتیا / صحت سیستم" />

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-8 border-b pb-4 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">د سیسټم د روغتیا معاینه</h3>
            <div className="flex items-center gap-3">
              <CurrentDateBadge />
              <button onClick={checkHealth} className="text-primary text-sm font-bold hover:underline">بیا چک کول 🔄</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {statusItems.map((item, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col gap-1">
                <span className="text-xs text-gray-500">{item.label}</span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800 dark:text-white/90">{item.value}</span>
                  {item.status === 'success' && <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>}
                  {item.status === 'error' && <span className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"></span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col gap-2">
          <h4 className="text-sm font-bold text-blue-700">د سیسټم معلومات:</h4>
          <p className="text-xs text-blue-600 leading-relaxed">
            دا پاڼه یوازې سوپر اډمین ته اجازه ورکوي چې د ډیټابیس پیوستون، سرعت او د کاروونکو رولونه په نښه کړي. په عادي وختونو کې ټول چراغونه باید شنه وي.
          </p>
        </div>
      </div>
    </>
  );
}
