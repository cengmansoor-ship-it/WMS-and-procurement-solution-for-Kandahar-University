# Kandahar University WMS - Local Run

## چټک استعمال

```powershell
cd D:\kandahar-wms-fixed-final
npm install
npm run dev
```

Browser کې خلاص کړئ:

```text
http://localhost:5173
```


## Firebase Mode
د اصلي Firebase لپاره:

1. `.env.example` کاپي کړئ
2. نوم یې `.env.local` کړئ
3. خپل Firebase values پکې واچوئ
4. `npm run dev` بیا چلوئ

## مهمې اصلاح شوې برخې

- Login/Logout flow سم شو
- `/dashboard` route اضافه شو
- TailAdmin ecommerce dashboard لرې شو
- WMS dashboard اضافه شو
- Auth د Firebase او Demo دواړو سره کار کوي
- Button submit مشکل حل شو
- Official Forms page اضافه شو
- Extra demo template routes له App څخه لرې شول
- Build test کامیاب شو

## د دفاع لپاره اصلي routes

- `/signin`
- `/dashboard`
- `/inventory/items`
- `/inventory/add`
- `/inventory/stock-in`
- `/inventory/stock-out`
- `/requests`
- `/requests/create`
- `/procurement`
- `/receiving`
- `/official-forms`
- `/reports`
- `/maintenance/final-qa`
