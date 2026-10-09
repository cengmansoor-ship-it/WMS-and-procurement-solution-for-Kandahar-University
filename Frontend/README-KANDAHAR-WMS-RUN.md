# Kandahar University WMS — Local Run

## Quick Start

```powershell
cd kandahar-wms
npm install
npm run dev
```

Open in browser:

```text
http://localhost:5173
```

## Firebase Mode

To use live Firebase:

1. Copy `.env.example`
2. Rename it to `.env.local`
3. Add your Firebase values
4. Run `npm run dev` again

## Key Fixed & Added Parts

- Login/Logout flow fixed
- `/dashboard` route added
- TailAdmin ecommerce dashboard removed
- WMS dashboard added
- Auth works with both Firebase and Demo modes
- Button submit issue fixed
- Official Forms page added
- Extra demo template routes removed from App
- Build test passed

## Main Routes

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