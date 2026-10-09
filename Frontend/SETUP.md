# د کندهار پوهنتون د ګدام سیستم - د نصب لارښود
# Kandahar University WMS — Setup Guide

## Requirements / اړتیاوې

- Node.js v18 or newer
- MySQL Server 8.0 or newer
- npm (comes with Node.js)

---

## Step 1 — Database Setup / د ډیټابیس جوړول

Open MySQL client:

```bash
mysql -u root -p --default-character-set=utf8mb4
```

Then run the schema and seed files:

```sql
source /full/path/to/backend/src/database/schema.sql;
source /full/path/to/backend/src/database/seed.sql;
```

On Windows (example):
```sql
source C:/Projects/kandahar-wms/backend/src/database/schema.sql;
source C:/Projects/kandahar-wms/backend/src/database/seed.sql;
```

---

## Step 2 — Backend Setup / د بیک اینډ چلول

```bash
cd backend
copy .env.example .env        # Windows
# cp .env.example .env        # Linux/Mac
```

Edit `backend/.env` and set your MySQL password:

```
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_password
DB_NAME=kandahar_wms_db
```

Install and run:

```bash
npm install
npm run dev
```

Backend will be available at: `http://localhost:3001`
Health check: `http://localhost:3001/api/health`

---

## Step 3 — Frontend Setup / د فرنټ اینډ چلول

In the project root:

```bash
copy .env.example .env        # Windows
# cp .env.example .env        # Linux/Mac
```

The `.env` file should contain:

```
VITE_API_BASE_URL=http://localhost:3001/api
```

Install and run:

```bash
npm install
npm run dev
```

Frontend will be available at: `http://localhost:5000`

---

## Step 4 — First Login / لومړنی ننوتل

The system runs in **demo mode** when Firebase is not configured.
Default login credentials (demo mode):

- Email: `admin@kandahar.edu.af`
- Password: `admin123`

---

## API Endpoints Reference

| Module | Base Path |
|--------|-----------|
| Inventory | `/api/inventory` |
| Requests | `/api/requests` |
| Procurement | `/api/procurement` |
| Receiving | `/api/receiving` |
| Delivery | `/api/delivery` |
| Reports | `/api/reports` |
| Lookup (vendors, faculties, etc.) | `/api/lookup` |
| Health | `/api/health` |

---

## Production Build / د پروډکشن جوړول

Frontend:
```bash
npm run build
```

Backend:
```bash
cd backend
npm run build
npm start
```

---

## Troubleshooting / د ستونزو حل

**Backend cannot connect to MySQL:**
- Check that MySQL is running
- Verify DB_PASSWORD in `backend/.env`
- Ensure the database was created: `CREATE DATABASE IF NOT EXISTS kandahar_wms_db`

**Frontend shows blank page:**
- Check that the frontend `.env` has `VITE_API_BASE_URL=http://localhost:3001/api`
- Restart Vite after changing `.env`

**Pashto text shows as boxes:**
- Ensure your MySQL was imported with `--default-character-set=utf8mb4`
- Verify the schema uses `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
