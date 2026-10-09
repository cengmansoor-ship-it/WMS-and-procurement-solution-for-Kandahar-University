# د فایربیس اتصال طریقه

۱. Firebase Console ته لاړ شئ.
۲. Project settings خلاص کړئ.
۳. General برخه کې خپل Web App انتخاب کړئ.
۴. SDK config څخه دا values کاپي کړئ:

- apiKey
- authDomain
- projectId
- storageBucket
- messagingSenderId
- appId

۵. د پروژې په اصلي فولډر کې `.env.local` فایل جوړ کړئ.
۶. دا بڼه پکې واچوئ:

```env
VITE_FIREBASE_API_KEY=ستاسې_apiKey
VITE_FIREBASE_AUTH_DOMAIN=kandahar-university-wms.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kandahar-university-wms
VITE_FIREBASE_STORAGE_BUCKET=kandahar-university-wms.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=ستاسې_senderId
VITE_FIREBASE_APP_ID=ستاسې_appId
```

۷. بیا پروژه بیا چالان کړئ:

```powershell
npm run dev
```

یادونه: `.env.local` هېڅکله GitHub ته مه push کوئ.
