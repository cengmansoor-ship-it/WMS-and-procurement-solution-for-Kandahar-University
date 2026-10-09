# Firebase Connection Guide

1. Go to the Firebase Console.
2. Open Project Settings.
3. Under **General**, select your Web App.
4. Copy these values from the SDK config:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

5. Create a `.env.local` file in the project root.
6. Add the values in this format:

```env
VITE_FIREBASE_API_KEY=your_apiKey
VITE_FIREBASE_AUTH_DOMAIN=kandahar-university-wms.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kandahar-university-wms
VITE_FIREBASE_STORAGE_BUCKET=kandahar-university-wms.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_senderId
VITE_FIREBASE_APP_ID=your_appId
```

7. Restart the project:

```powershell
npm run dev
```

> Note: never push `.env.local` to GitHub.