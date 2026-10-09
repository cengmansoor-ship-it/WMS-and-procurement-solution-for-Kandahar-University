# Latest Fixes Report

## Key Completed Work

- Login/logout flow fixed.
- Project is ready for `npm install` and `npm run dev`.
- Extra templates and ecommerce/demo sections removed from the official UI workflow.
- Main 10 menus created: Dashboard, Inventory, Receiving, Procurement, Requests, Forms, Notifications, Reports, Settings, About.
- Seven official forms open from the main HTML file in isolated iframes.
- The Procurement section is linked to official forms: comparison sheet, comparison form, purchase order.
- The Receiving section is linked to official forms: receipt report, FS5.
- The Requests section works with the proposal form and SU9.
- Request Level appears in requests, forms, reports, pipeline and notifications.
- Local one-year demo data added for inventory, movements, requests, pipeline and forecasting.
- Excel-compatible backup download added.
- Email/notification history and mail-client opening added.
- Firebase connection guide added.
- Bahij Zar font stack applied across the UI.
- Dates use Shamsi/Qamari calendar utilities for a clear UI.
- Public account creation signup route disabled; accounts are created by Super Admin only.
- GitHub tokens are never stored in the frontend.

## Important Limitations

- Auto-creating Firebase Auth seed users from the frontend is not secure; do it via the Firebase Console, Admin SDK, or the backend.
- GitHub backup push is not enabled from the frontend without a secure backend token/OAuth; local backup works.
- Real SMTP email cannot be sent without a backend setup; the current solution opens a mail client and keeps history.

## Verified

- `npm run build` passed.
- Visible AI tool references removed from the active project.
- Old ecommerce/template workflow is not used.

## Run

```powershell
npm install
npm run dev
```

## Firebase Connection

See `README-FIREBASE-CONNECTION.md`.