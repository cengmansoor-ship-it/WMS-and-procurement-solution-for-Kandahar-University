import { useEffect, useRef, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Breadcrumb from "../../components/common/Breadcrumb";

const TEAM = [
  {
    name: "عنایت‌الله منصور",
    nameEn: "Enayatullah Mansoor",
    role: "د پروژې لیډر او فولسټک ډیویلوپر",
    roleEn: "Project Lead & Full Stack Developer",
    photo: "/team/enayatullah.jpeg",
    bio: "د پروژې اصلي مدیر او بشپړ فني مسئول. د فرنټ‌اینډ، بیک‌اینډ، ډیټابیس او سیستم معمارۍ ډیزاین ټول کارونه یې تر سره کړي.",
    skills: ["React", "Node.js", "TypeScript", "MySQL", "Express", "UI/UX"],
    gradient: "from-amber-500 via-orange-500 to-red-500",
    ring: "ring-amber-400",
    badge: "🏆 Lead",
    featured: true,
  },
  {
    name: "فضل‌الرحمن میار",
    nameEn: "Fazalrahman Mayar",
    role: "فرنټ‌اینډ ډیویلوپر",
    roleEn: "Frontend Developer",
    photo: "/team/fazalrahman.jpeg",
    bio: "د کارونکي انٹرفیس ډیزاین او پیاده‌سازي مسئول. د React او Tailwind CSS سره د ښکلي او د کارولو وړ UI جوړولو کې مهارت لري.",
    skills: ["React", "Tailwind CSS", "JavaScript", "HTML/CSS"],
    gradient: "from-blue-500 via-indigo-500 to-purple-600",
    ring: "ring-blue-400",
    badge: "💻 Frontend",
    featured: false,
  },
  {
    name: "عبدالهادي رحیمي",
    nameEn: "Abdulhadi Rahimi",
    role: "بیک‌اینډ ډیویلوپر",
    roleEn: "Backend Developer",
    photo: "/team/abdulhadi.png",
    bio: "د سرور اړخ منطق، API جوړونې او ډیټابیس مدیریت مسئول. د Node.js او MySQL سره د پیاوړي بیک‌اینډ د جوړولو تجربه لري.",
    skills: ["Node.js", "Express", "MySQL", "REST API", "TypeScript"],
    gradient: "from-emerald-500 via-teal-500 to-cyan-600",
    ring: "ring-emerald-400",
    badge: "⚙️ Backend",
    featured: false,
  },
  {
    name: "شمس‌الرحمن مشفق",
    nameEn: "Shamsurahman Mushfiq",
    role: "سیستم تحلیل‌ګر",
    roleEn: "System Analyst",
    photo: "/team/shamsurahman.jpeg",
    bio: "د سیستم اړتیاوو تحلیل، ډاکومینټیشن او د کاري بهیرونو ډیزاین مسئول. د پوهنتون د عملیاتي اړتیاوو د سیستم سره د پیوستولو کې مرسته کوي.",
    skills: ["System Analysis", "Documentation", "Workflow Design", "Testing"],
    gradient: "from-pink-500 via-rose-500 to-red-600",
    ring: "ring-pink-400",
    badge: "📊 Analyst",
    featured: false,
  },
];

const SUPERVISOR = {
  name: "حکمت‌الله امید",
  nameEn: "Hikmatullah Omid",
  faculty: "د کمپیوټر ساینس پوهنځی",
  department: "د شبکو څانګه",
  role: "اکادمیک نظارت‌کوونکی",
  bio: "د کندهار پوهنتون د کمپیوټر ساینس پوهنځي استاد او د دې فاینل ایر پروژې اکادمیک نظارت‌کوونکی. د محصلینو د وده او د سیستم د کیفیت ډاډمن کولو کې مهم رول لوبوي.",
  quote: "دا پروژه د ګدام مدیریت سیستم یوه مدرنه او عملي پلي‌کونه ده او د قوي ټیم کار او تخنیکي مهارتونو انعکاس کوي.",
};

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function FeaturedCard({ member }: { member: typeof TEAM[0] }) {
  const { ref, visible } = useInView();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="col-span-full"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
      }}
    >
      <div
        className={`relative rounded-3xl overflow-hidden bg-gradient-to-br ${member.gradient} p-1 shadow-2xl`}
        style={{
          boxShadow: hovered
            ? "0 30px 80px rgba(0,0,0,0.35)"
            : "0 20px 60px rgba(0,0,0,0.2)",
          transition: "box-shadow 0.4s ease, transform 0.4s ease",
          transform: hovered ? "scale(1.01)" : "scale(1)",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="rounded-[22px] bg-white dark:bg-gray-900 overflow-hidden">
          <div className={`h-2 bg-gradient-to-r ${member.gradient}`} />
          <div className="flex flex-col md:flex-row items-center gap-8 p-8 md:p-12">
            {/* Photo */}
            <div className="relative shrink-0">
              <div
                className={`absolute inset-0 rounded-full bg-gradient-to-br ${member.gradient} blur-xl opacity-40`}
                style={{ transform: "scale(1.3)" }}
              />
              <div className={`relative w-44 h-44 md:w-56 md:h-56 rounded-full ring-4 ${member.ring} ring-offset-4 ring-offset-white dark:ring-offset-gray-900 overflow-hidden shadow-2xl`}>
                <img
                  src={member.photo}
                  alt={member.nameEn}
                  loading="lazy"
                  className="w-full h-full object-cover object-top"
                  style={{
                    transition: "transform 0.5s ease",
                    transform: hovered ? "scale(1.06)" : "scale(1)",
                  }}
                />
              </div>
              <div
                className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${member.gradient} shadow-lg whitespace-nowrap`}
              >
                {member.badge}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-right" dir="rtl">
              <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{member.role}</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">
                {member.name}
              </h2>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 font-medium tracking-wide">{member.nameEn}</p>
              <p className="mt-4 text-gray-600 dark:text-gray-300 leading-8 text-base max-w-xl">{member.bio}</p>
              <div className="mt-5 flex flex-wrap gap-2 justify-center md:justify-end">
                {member.skills.map((s) => (
                  <span
                    key={s}
                    className={`px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${member.gradient} shadow-sm`}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberCard({ member, delay }: { member: typeof TEAM[0]; delay: number }) {
  const { ref, visible } = useInView();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(50px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      <div
        className="relative rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 h-full flex flex-col"
        style={{
          boxShadow: hovered
            ? "0 24px 64px rgba(0,0,0,0.18)"
            : "0 8px 32px rgba(0,0,0,0.07)",
          transform: hovered ? "translateY(-6px)" : "translateY(0)",
          transition: "box-shadow 0.4s ease, transform 0.4s ease",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Top gradient bar */}
        <div className={`h-1.5 bg-gradient-to-r ${member.gradient}`} />

        {/* Photo section */}
        <div className={`relative py-8 bg-gradient-to-b ${member.gradient} bg-opacity-5`}
          style={{ background: `linear-gradient(to bottom, rgba(0,0,0,0.03), white)` }}>
          <div className="flex justify-center">
            <div className="relative">
              <div
                className={`absolute inset-0 rounded-full bg-gradient-to-br ${member.gradient} blur-lg opacity-30`}
                style={{ transform: "scale(1.25)" }}
              />
              <div className={`relative w-28 h-28 rounded-full ring-[3px] ${member.ring} ring-offset-2 ring-offset-white dark:ring-offset-gray-900 overflow-hidden shadow-xl`}>
                <img
                  src={member.photo}
                  alt={member.nameEn}
                  loading="lazy"
                  className="w-full h-full object-cover object-top"
                  style={{
                    transition: "transform 0.5s ease",
                    transform: hovered ? "scale(1.08)" : "scale(1)",
                  }}
                />
              </div>
              <div
                className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${member.gradient} shadow whitespace-nowrap`}
              >
                {member.badge}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1 text-right" dir="rtl">
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">{member.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">{member.nameEn}</p>
          <div className={`mt-2 inline-flex self-end px-3 py-0.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${member.gradient}`}>
            {member.role}
          </div>
          <p className="mt-3 text-gray-500 dark:text-gray-400 text-sm leading-7 flex-1">{member.bio}</p>
          <div className="mt-4 flex flex-wrap gap-1.5 justify-end">
            {member.skills.map((s) => (
              <span
                key={s}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SupervisorCard() {
  const { ref, visible } = useInView();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="col-span-full"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: "opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s",
      }}
    >
      <div
        className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-1 shadow-2xl"
        style={{
          transform: hovered ? "scale(1.01)" : "scale(1)",
          transition: "transform 0.4s ease, box-shadow 0.4s ease",
          boxShadow: hovered ? "0 30px 80px rgba(0,0,0,0.4)" : "0 20px 60px rgba(0,0,0,0.25)",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="rounded-[22px] bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400" />
          <div className="p-8 md:p-12" dir="rtl">
            <div className="flex flex-col md:flex-row items-start gap-8">
              {/* Icon Avatar */}
              <div className="shrink-0 flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-xl text-4xl">
                👨‍🏫
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                    🎓 اکادمیک نظارت‌کوونکی
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/60 border border-white/10">
                    {SUPERVISOR.faculty}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/60 border border-white/10">
                    {SUPERVISOR.department}
                  </span>
                </div>

                <h2 className="text-3xl font-extrabold text-white">{SUPERVISOR.name}</h2>
                <p className="text-sm text-white/40 mt-0.5 font-medium">{SUPERVISOR.nameEn}</p>

                <p className="mt-4 text-white/70 leading-8 text-sm">{SUPERVISOR.bio}</p>

                {/* Quote */}
                <div className="mt-6 relative rounded-2xl bg-white/5 border border-yellow-400/20 p-5">
                  <div className="absolute -top-3 right-5 text-4xl text-yellow-400/60 leading-none select-none">"</div>
                  <p className="text-white/80 leading-8 text-sm italic pt-2">{SUPERVISOR.quote}</p>
                  <div className="absolute -bottom-3 left-5 text-4xl text-yellow-400/60 leading-none select-none rotate-180">"</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  const { ref, visible } = useInView(0.05);

  return (
    <div
      ref={ref}
      className="relative rounded-3xl overflow-hidden mb-10"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: "opacity 0.9s ease, transform 0.9s ease",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-brand-950 via-brand-900 to-indigo-900" />
      {/* Animated background orbs */}
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-brand-600/20 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-purple-600/10 blur-2xl -translate-x-1/2 -translate-y-1/2" />

      <div className="relative px-8 py-14 md:py-20 text-center" dir="rtl">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white/70 text-sm mb-6">
          <span>🎓</span>
          <span>د کندهار پوهنتون — فاینل ایر پروژه ۲۰۲۶</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">
          د عمومي ګدام او تدارکاتو{" "}
          <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
            مدیریت سیستم
          </span>
        </h1>
        <p className="mt-5 text-white/60 max-w-2xl mx-auto leading-8 text-base">
          دا سیستم د کندهار پوهنتون لپاره د اجناسو موجودۍ، تدارکاتو، غوښتنو، رسید، تسلیمۍ او راپورونو بشپړ اداره کولو لپاره جوړ شوی دی.
        </p>

        {/* Stats */}
        <div className="mt-10 flex flex-wrap justify-center gap-6 md:gap-10">
          {[
            { label: "د ټیم غړي", value: "۴+" },
            { label: "د سیستم ماژولونه", value: "۱۰+" },
            { label: "د پروژې کال", value: "۲۰۲۶" },
            { label: "د پوهنځي", value: "CS" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-extrabold text-white">{stat.value}</div>
              <div className="text-xs text-white/50 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AboutPage() {
  const [leader, ...rest] = TEAM;

  return (
    <>
      <PageMeta title="زموږ په اړه" description="د پروژې او ټیم معلومات" />
      <Breadcrumb pageTitle="زموږ نمونه يې" />


      <div className="space-y-10" dir="rtl">
        {/* Hero */}
        <HeroSection />

        {/* Team Heading */}
        <div className="text-center" dir="rtl">
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">د پروژې ټیم</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">هغه کسان چې دا سیستم یې جوړ کړی</p>
        </div>

        {/* Featured Leader Card */}
        <div className="grid grid-cols-1 gap-8">
          <FeaturedCard member={leader} />
        </div>

        {/* Rest of team */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rest.map((m, i) => (
            <MemberCard key={m.nameEn} member={m} delay={i * 120} />
          ))}
        </div>

        {/* Supervisor divider */}
        <div className="flex items-center gap-4 pt-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
          <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 px-4">اکادمیک نظارت‌کوونکی</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
        </div>

        {/* Supervisor */}
        <div className="grid grid-cols-1 gap-8">
          <SupervisorCard />
        </div>

        {/* Footer note */}
        <div className="text-center pb-4">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            © ۲۰۲۶ · د کندهار پوهنتون د کمپیوټر ساینس پوهنځي · فاینل ایر پروژه
          </p>
        </div>
      </div>
    </>
  );
}
