# Kandahar University Warehouse Management System (WMS)
د کندهار پوهنتون د عمومي ګدام او تدارکاتو مدیریت سیستم

## Overview
A full-stack ERP system for managing university warehouse operations including inventory tracking, procurement, asset requests, and official Afghan government forms.

## Tech Stack
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS 4.0
- **Backend:** Node.js + Express (port 3001)
- **Database:** MySQL 8.0 (auto-initialized via `backend/start.sh`)
- **Auth:** Demo mode via localStorage (no Firebase env vars needed); Firebase Auth if VITE_FIREBASE_* env vars are set

## How to Run
The project runs two parallel workflows:
1. **Start application** — Vite dev server on port 5000 (`npm run dev`)
2. **Backend API** — Express + MySQL on port 3001 (`cd backend && bash start.sh`)

The Vite server proxies `/api/*` requests to the backend at `http://localhost:3001`.

## Demo Mode
Without Firebase env vars, the app runs in demo/localStorage mode with seeded data. Login with any seed user (e.g. `superadmin@ku.edu.af`).

## Full Firebase Mode
Set these env vars to enable live Firebase:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Key Directories
- `/src` — React frontend (pages, components, firebase logic)
- `/backend/src` — Express server, routes, controllers, services
- `/backend/src/database` — MySQL schema and migrations
- `/public/forms` — Official Afghan government forms HTML

## User Preferences
- App is in Pashto/Dari language (RTL support)
- Uses Afghan Shamsi (Solar Hijri) calendar dates
