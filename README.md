<div align="center" dir="rtl">

<img src="Frontend/public/kandahar-university-logo.png" alt="Kandahar University Logo" width="110" height="110" />

# 🎓 د کندهار پوهنتون د عمومي ګدام او تدارکاتو مدیریت سیستم

<a href="https://github.com/cengmansoor-ship-it/WMS-and-procurement-solution-for-Kandahar-University">
  <img alt="Pashto" src="https://img.shields.io/badge/زبان-پښتو-%23f59e0b?style=for-the-badge&labelColor=%23220031"/>
</a>
<img alt="React" src="https://img.shields.io/badge/React-18-%2361dafb?style=for-the-badge&logo=react&labelColor=%23220031"/>
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7-%233178c6?style=for-the-badge&logo=typescript&labelColor=%23220031"/>
<img alt="Node.js" src="https://img.shields.io/badge/Node.js-Express-%23339933?style=for-the-badge&logo=nodedotjs&labelColor=%23220031"/>
<img alt="MySQL" src="https://img.shields.io/badge/MySQL-8-%234479a1?style=for-the-badge&logo=mysql&labelColor=%23220031"/>
<img alt="Tailwind" src="https://img.shields.io/badge/Tailwind_CSS-4-%2306b6d4?style=for-the-badge&logo=tailwindcss&labelColor=%23220031"/>
<img alt="Year" src="https://img.shields.io/badge/۲۰۲۶-Final_Year_Project-%23eab308?style=for-the-badge&labelColor=%23220031"/>
<img alt="Status" src="https://img.shields.io/badge/Status-Production_Ready-%2322c55e?style=for-the-badge&labelColor=%23220031"/>

**Kandahar University — Warehouse Management & Procurement System (WMS)**
*د کندهار پوهنتون د کمپیوټر ساینس پوهنځي — فاینل ایر پروژه ۲۰۲۶*

</div>

---

<div align="center" dir="rtl">

<img src="Frontend/banner.png" alt="Kandahar WMS Banner" width="100%" />

</div>

> ## 📖 لنډیز — *Overview*
>
> د عمومي ګدام او تدارکاتو مدیریت سیستم د کندهار پوهنتون لپاره یو بشپړ **Web-based** سیسټم دی چې د اجناسو موجودۍ، سټاک، غوښتنو، تدارکاتو، ترلاسه کولو، تسلیمۍ، رسمي فورمونو، راپورونو، خبرتیاوو، بودیجې، بېکپ او د کاروونکو د صلاحیتونو (RBAC) بشپړه اداره کوي. سیستم په **پښتو او فارسي** (RTL) انٹرفیس سره جوړ شوی او د پوهنتون د ریښتینو اداري بهیرونو سره سم ډیزاین شوی دی.

**A complete Warehouse Management & Procurement platform for Kandahar University — inventory, stock movement, item requests with a full approval pipeline, procurement (vendor offers & purchase orders), receiving, delivery, official Afghan government forms, 13+ reports, notifications, budget codes, audit logs, soft-delete/recovery, and automatic SQL backups — all in a Pashto/Farsi RTL interface.**

---

## ✨ اصلي ځانګړنې — *Key Features*

<div align="right" dir="rtl">

| 🗂️ برخه | ماډولونه |
|---|---|
| 📊 **عمومي پاڼه / Dashboard** | احیايي شمېرې، ApexCharts ګرافونه، د سټاک کمښت خبرتیاوې، د غوښتنو او تدارکاتو وضعیت |
| 📦 **موجودي / Inventory** | د توکو لیست، اضافه/سمون، سټاک داخلول (Stock-In)، سټاک وتل (Stock-Out)، سټاک راګرځول (Returns)، لیجر (Ledger)، **بارکوډ سکنر**، د چک لیست مدیریت (Import checklist) |
| 🙋 **غوښتنې / Requests** | د توکو غوښتنه، بېرته کتنه (Pre-review) او **کفیل سیسټم**، د غوښتنې کچه (Urgent / Normal / Low)، Tr ‌racking code، بشپړ **تصویب پایپ‌لاین** (Confirmer → تدارکات → ګدام → تسلیمۍ) |
| 🛒 **تدارکات / Procurement** | د تدارکاتو قضیې، د عرضه‌کونکو وړاندیزونه (Vendor Offers)، د ګټونکي ټاکنه، **Purchase Order**، د رسمي فورمونو سره اړیکه |
| 📥 **ترلاسه کول / Receiving** | د PO او غوښتنو سره سم رسید، د رسید راپورونه، ف س ۵ (FS5) |
| 🚚 **تسلیمۍ / Delivery** | د پوهنځیو او کسانو ته تسلیمۍ، د تسلیمۍ فورمه، توکي او کمیتونه |
| 🔎 **تعقیب / Traceability** | له غوښتنې → تدارکاتو → رسید → تسلیمۍ پورې د هر توکي بشپړ لړ – د هر شخص/څانګې لیجر |
| 📝 **رسمي فورمونه / Official Forms** | **۷ رسمي فورمونه** (د پیشنهاد فورمه، مقایسوی فورمه، آمر خریداری، د رسید راپور، ف س ۵، Tender…) په جلا iframe کې |
| 📈 **راپورونه / Reports** | **۱۳+ راپورونه**: موجودي، د سټاک حرکت، غوښتنې، تدارکات، رسید/تسلیمۍ، پوهنځی، څانګه، د کس ګومارنه، کلنۍ اړتیاوې، وړاندوینه (Forecast)، د فعالیت تاریخچه (Audit) او راګرځونه |
| 🔔 **خبرتیاوې / Notifications** | د سټاک کمښت، د غوښتنو نوي حالتونه، د تصویب خبرتیاوې |
| 💰 **بودیجه / Budget** | د بودیجې کوډونه، سقف (Ceilings) او محدودیت‌ونه |
| ⚙️ **تنظیمات / Settings** | د ایمیل/SMS تنظیم، د سیستم تنظیمات، د ورځني غوښتنو محدودیت، د سیسټم روغتیا |
| 🗄️ **بېکپ / Backup** | **اتوماتیک SQL بېکپ هر ۳ ساعته**، ډاونلوډ/بېرته راګرځول، Excel-compatible ایکسپورټ |
| 🗑️ **کثافات / Trash & Recovery** | **سافټ-ډیلیټ** — هیڅ معلومات په دایمي توګه نه ډیلیټیږي؛ بېرته راګرځول کیږي |
| 👥 **کاروونکي / Users & Roles** | **RBAC**، د ۷ دندو/رولونو سیسټم، دودیز رولونه (Custom Roles)، د حساب فعالول |
| 🕵️ **سوپر اډمین / Monitoring** | د سیستم ژوندی څارنه: انالیتیک، موجودي، غوښتنې، تدارکات، رسید |
| 🛡️ **امنیت / Security** | JWT سیشن، Helmet، Rate-Limiting، CORS، **Audit Logs**، د پاسورډ هش (bcrypt) |
| 🖨️ **چاپ** | د ټولو رسمي فورمونو د چاپ لپاره چمتو ډیزاین |

</div>

---

## 🧩 د سیستم ماډولونه — *System Modules*

| ماډول | لار | Module | Route |
|---|---|---|---|
| عمومي پاڼه | `/dashboard` | Dashboard | `/dashboard` |
| موجودي | `/inventory/*` | Inventory | `/inventory/items`, `/stock-in`, `/stock-out`, `/returns`, `/ledger`, `/barcode-scanner`, `/checklist` |
| غوښتنې | `/requests/*` | Requests | `/requests`, `/requests/create`, `/requests/details/:id` |
| تدارکات | `/procurement/*` | Procurement | `/procurement`, `/procurement/details/:id`, `/procurement/offers/:id` |
| ترلاسه کول | `/receiving/*` | Receiving | `/receiving`, `/receiving/details/:id` |
| راپورونه | `/reports/*` | Reports | `/reports` + ۱۲ نور |
| رسمي فورمونه | `/official-forms` | Official Forms | `/official-forms` |
| خبرتیاوې | `/notifications` | Notifications | `/notifications` |
| تعقیب | `/traceability` | Traceability | `/traceability` |
| تنظیمات | `/settings` | Settings | `/settings`, `/user-management`, `/role-management`, `/delegation` |
| څارنه | `/superadmin` | Monitoring | `/superadmin` + ۵ نور |
| ساتنه | `/maintenance/*` | Maintenance | `/trash`, `/recovery-history`, `/backup`, `/health`, `/final-qa` |
| زموږ په اړه | `/about` | About | `/about` |

---

## 🛠️ تخنیکي سټیک — *Tech Stack*

<div align="center">

| طبقه | ټیکنالوژي |
|---|---|
| 🎨 **فرنټ‌اینډ** | React 18 · TypeScript · Vite 6 · Tailwind CSS 4 · React Router 7 · ApexCharts · FullCalendar · Firebase · QR/Barcode (jsqr, qrcode.react) · jalaali-js (شمسی نېټې) · PWA |
| ⚙️ **بیک‌اینډ** | Node.js · Express 4 · TypeScript · mysql2 · JWT سیشن · Helmet · CORS · Compression · Rate-Limit · bcryptjs · Nodemailer · node-cron |
| 🗄️ **ډیټابیس** | MySQL 8 (utf8mb4 / utf8mb4_unicode_ci) — ۲۳+ جدولونه |
| 🚀 **ځای پر ځای کول** | PM2 · ecosystem.config.cjs · د LAN وایندوز سکریپټونه (scripts/) |

</div>

### 🏗️ د سیسټم معماري — *System Architecture*

```mermaid
flowchart TB
    subgraph Client["فرنټ اینډ — React + Vite + Tailwind (RTL پښتو/فارسي)"]
        UI["🖥️ React UI · Pages & Components"]
        PWA["📱 PWA · Offline / Mobile"]
    end

    subgraph Server["بیک اینډ — Node.js + Express + TypeScript"]
        API["🔌 REST API  /api"]
        AUTH["🔐 Auth · RBAC · JWT Session"]
        SVC["⚙️ Services (Inventory, Requests, Procurement, Reports…)"]
        CRON["⏰ Cron (Auto Backup هر ۳ ساعته)"]
    end

    subgraph Data["ډیټا"]
        DB[("🗄️ MySQL 8 — kandahar_db")]
        FB[("🔥 Firebase — Auth/Firestore (اختیاري)")]
    end

    UI --> API
    PWA --> API
    API --> AUTH
    API --> SVC
    SVC --> DB
    CRON --> DB
    UI -. "اختیاري" .-> FB
```

---

## 📁 د پروژې جوړښت — *Project Structure*

```
KWMS/
├── Backend/                  # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── config/           # DB connection
│   │   ├── controllers/      # Route handlers (21 فایل)
│   │   ├── database/         # schema.sql · seed.sql
│   │   ├── middleware/       # auth, RBAC, API security
│   │   ├── routes/           # 22 API route modules
│   │   ├── security/         # session/JWT tokens
│   │   ├── services/         # business logic (25 فایل)
│   │   ├── utils/
│   │   └── server.ts         # entry point
│   ├── tests/                # security + live API tests
│   ├── scripts/              # seed-admin, reset
│   ├── .env.example
│   └── package.json
│
├── Frontend/                 # React 18 + Vite + Tailwind SPA
│   ├── src/
│   │   ├── api/              # backend API client
│   │   ├── components/       # shared UI components
│   │   ├── constants/        # roles, permissions
│   │   ├── context/          # auth, theme…
│   │   ├── layouts/          # app + reports + settings layouts
│   │   ├── pages/            # ۲۰+ page modules
│   │   ├── services/
│   │   ├── firebase/         # localStore / optional Firebase
│   │   └── App.tsx           # router (protected routes)
│   ├── public/
│   │   ├── forms/            # ۷ رسمي فورمونه (iframe)
│   │   ├── fonts/            # Bahij Zar — پښتو فونټ
│   │   └── team/             # د ټیم انځورونه
│   ├── docs/                 # security notes + screenshots
│   ├── .env.example
│   └── package.json
│
├── DB/                       # database create + restore docs
├── Backup/                   # خودکار SQL بېکپونه (local فقط)
├── scripts/                  # LAN / Windows deployment scripts
└── .gitignore
```

---

## 🔐 دندې او صلاحیتونه — *Roles & Permissions (RBAC)*

| دنده / Role | اجازه‌لرونکې برخې / Allowed modules |
|---|---|
| 👑 **سوپر اډمین** Super Admin | هر څه — ټولې برخې، تنظیمات، بېکپ، کثافات، څارنه |
| 🧑‍💼 **اډمین** Admin | موجودي، ټولې غوښتنې، راپورونه، تدارکات ولولئ، ترلاسه کول |
| 🛒 **د تدارکاتو مدیر** Procurement Director | تدارکات — مدیریت او تصویب |
| 🏭 **د ګدام مدیر** Warehouse Director | موجودي (اداره)، ترلاسه کول، سټاک-آوټ، چک لیست |
| 📦 **د ګدام کارکوونکی** Warehouse Entry Person | موجودي، سټاک-این، ترلاسه کول |
| 🙋 **غوښتونکی** Requester | غوښتنې جوړول |
| ✅ **تصویبونکی** Request Confirmer | غوښتنې تصویبول |

---

## 🚀 پیل — *Getting Started*

### اړتیاوې · *Prerequisites*

- **Node.js** ≥ 18
- **MySQL** Server 8.0+
- **npm**

### ۱ — ډیټابیس جوړول · *Database Setup*

```bash
mysql -u root -p --default-character-set=utf8mb4
```

```sql
CREATE DATABASE IF NOT EXISTS kandahar_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
source Backend/src/database/schema.sql;
source Backend/src/database/seed.sql;
```

### ۲ — بیک‌اینډ چلول · *Backend*

```powershell
cd Backend
copy .env.example .env      # Windows   |   cp .env.example .env  (Linux/Mac)
# .env کې خپل MySQL پاسورډ وليکئ
npm install
npm run dev
```

✔ Backend به په `http://localhost:3001` چالان شي — صحت: `http://localhost:3001/api/health`

### ۳ — فرنټ‌اینډ چلول · *Frontend*

```powershell
cd Frontend
copy .env.example .env      # Windows   |   cp .env.example .env  (Linux/Mac)
npm install
npm run dev
```

✔ App به په `http://localhost:5000` پرانیستل شي

> **Firebase (اختیاري):** د اصلي Firebase اتصال لپاره د `Frontend/.env` فایل کې د Firebase Web App معلومات واچوئ. پرته له Firebase څخه سیستم په **Demo Mode** کار کوي.

### 🔑 لومړنی ننوتل · *Default Login (Demo Mode)*

| بریښنالیک · Email | پاسورډ · Password |
|---|---|
| `admin@kandahar.edu.af` | `admin123` |

---

## 🔌 API ماډولونه — *API Modules*

| ماډول | Base Path |
|---|---|
| Authentication | `/api/auth` |
| Users | `/api/users` |
| Inventory | `/api/inventory` |
| Requests | `/api/requests` |
| Procurement | `/api/procurement` |
| Receiving | `/api/receiving` |
| Delivery | `/api/delivery` |
| Reports | `/api/reports` |
| Lookup (faculties, vendors…) | `/api/lookup` |
| Email & Email-Config | `/api/email` · `/api/email-config` |
| SMS | `/api/sms` |
| Traceability | `/api/traceability` |
| Management | `/api/management` |
| Custom Roles | `/api/custom-roles` |
| Budget | `/api/budget` |
| Trash | `/api/trash` |
| Checklist | `/api/checklist` |
| Backup | `/api/backup` |
| Delegations (کفیل) | `/api/delegations` |
| Settings | `/api/settings` |
| Health & Time | `/api/health` · `/api/time/now` |

---

## 📊 راپورونه — *Reports*

<div align="center">

| راپور | Description |
|---|---|
| عمومي راپور | Reports Dashboard |
| د موجودۍ راپور | Inventory Report |
| د سټاک د حرکت راپور | Stock Movement Report |
| د غوښتنو راپور | Request Report |
| د تدارکاتو راپور | Procurement Report |
| د رسید او تسلیمۍ راپور | Receiving & Delivery Report |
| د پوهنځیو راپور | Faculty Report |
| د څانګو راپور | Department Report |
| د کس ګومارنې راپور | Person Assignment Report |
| کلنۍ اړتیاوې | Annual Needs Report |
| وړاندوینه | Forecasting Report |
| د فعالیت تاریخچه | Audit Activity Report |
| راګرځونه | Stock Return Report |

</div>

---

## 🔒 امنیت او بېکپ — *Security & Backup*

- 🔐 **JWT سیشن** + **RBAC** — هر رول یوازې خپلو برخو ته لاسرسی لري
- 🛡️ **Helmet**, **Rate Limiting** (د ننوتو ۲۰ هڅې / ۱۰ دقیقې), **CORS** او غوښتنې کنټرول
- 🧾 **Audit Logs** — ټول فعالیتونه د زړو او نویو ارزښتونو سره ثبت کیږي (هېڅکله نه ایډیټیږي)
- 🗑️ **سافټ-ډیلیټ** — هیڅ معلومات په دایمي توګه نه ډیلیټیږي؛ له **کثافاتو (Trash)** بېرته راګرځولی شئ
- 🗄️ **اتوماتیک SQL بېکپ** هر ۳ ساعته (node-cron) + Excel ایکسپورټ
- 👤 **حساب فعالول** — نوي کاروونکي تر سوپر اډمین تصویب وروسته ننوتلای شي
- ⚠️ حساس معلومات (`.env`, `.wms-session-key`, د بېکپ دوتنې) **هېڅکله** له ریپوزیټورۍ سره نه خپریږي

> 📌 لارښوونه: د لومړي ځل لپاره د مخکې-تولید مخکې، `Frontend/firestore.rules` وګورئ او د تولید رولونه تطبیق کړئ.

---

## 📸 سکرین شاټ‌ونه — *Screenshots*

<div align="center">

| عمومي پاڼه · Dashboard | عمومي پاڼه · Dashboard |
|---|---|
| <img src="Frontend/docs/screenshots/dashboard-1.png" width="380" /> | <img src="Frontend/docs/screenshots/dashboard-2.png" width="380" /> |

</div>

---

## 🧪 ازموینه — *Testing*

D ‌بیک‌اینډ کې د امنیتي او ژوندی API ازموینې شاملې دي:

```powershell
cd Backend
npm test                       # build + session-security tests
npm run test:live              # live API tests
```

---

## 👨‍👩‍👦 د پروژې ټیم — *Project Team*

| غړی | دنده |
|---|---|
| 🏆 **عنایت‌الله منصور** — Enayatullah Mansoor | د پروژې مشر او فول‌سټک ډیویلوپر |
| 💻 **فضل‌الرحمن میار** — Fazalrahman Mayar | فرنټ‌اینډ ډیویلوپر |
| ⚙️ **عبدالهادي رحیمي** — Abdulhadi Rahimi | بیک‌اینډ ډیویلوپر |
| 📊 **شمس‌الرحمن مشفق** — Shamsurahman Mushfiq | سیستم تحلیل‌ګر |

## 🎓 اکادمیک نظارت — *Academic Supervision*

> **حکمت‌الله امید** — Hikmatullah Omid
> د کمپیوټر ساینس پوهنځی · د شبکو څانګه
> *د فاینل ایر پروژې اکادمیک نظارت‌کوونکی*

---

## 📜 جواز — *License*

دا پروژه د ښوونیزو او علمي موخو لپاره جوړه شوې ده — **د کندهار پوهنتون د کمپیوټر ساینس پوهنځي، فاینل ایر پروژه ۲۰۲۶**.

فرنټ‌اینډ په TailAdmin ریپو کې ولاړ دی؛ خپل جواز وګورئ: `Frontend/LICENSE.md`.

---

<div align="center" dir="rtl">

**د کندهار پوهنتون** 🎓 · د کمپیوټر ساینس پوهنځی · فاینل ایر پروژه ۲۰۲۶

*Kandahar University · Faculty of Computer Science · Final Year Project 2026*

</div>