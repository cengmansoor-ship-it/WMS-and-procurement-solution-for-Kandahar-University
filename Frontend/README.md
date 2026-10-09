# Kandahar University WMS — Frontend

React 18 + Vite + Tailwind CSS SPA for the **Kandahar University Warehouse Management & Procurement System**.

> See the repository root [`README.md`](../README.md) for full documentation, setup instructions, API reference, and architecture overview.

## Quick Start

```powershell
npm install
copy .env.example .env      # Windows   |   cp .env.example .env  (Linux/Mac)
npm run dev
```

Open `http://localhost:5000`.

## Main Sections

- Dashboard
- Inventory (items, stock in/out, returns, ledger, barcode scanner, checklists)
- Requests
- Procurement
- Receiving
- Reports
- Official Forms
- Notifications
- Traceability
- Settings
- About

## Official Forms

The 7 official government/university forms open from `public/forms/official-forms.html` in isolated iframes so their CSS, JavaScript and print layout stay intact.

## Security Note

Never store GitHub tokens, Firebase private keys or passwords in the frontend. Use a secure backend or server-side token for GitHub backups.