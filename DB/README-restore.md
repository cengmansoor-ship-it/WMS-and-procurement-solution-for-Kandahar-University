# Database Restore

From the project root on Windows:

```bat
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p < DB\mysql-create-database.sql
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p kandahar_db < Backup\latest.sql
```

If MySQL is installed in another folder, use that computer's `mysql.exe` path.

To empty all data but keep tables:

```bat
cd Backend
npm run reset:empty
```

The backend reads `Backend\.env`. For a restored database, set:

```env
DB_NAME=kandahar_db
```
