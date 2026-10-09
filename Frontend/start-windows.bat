@echo off
chcp 65001 > nul
title د کندهار پوهنتون WMS - Windows Launcher

echo.
echo ================================================
echo   د کندهار پوهنتون ګدام مدیریت سیستم
echo   Kandahar University WMS - Windows Launcher
echo ================================================
echo.

:: ── د .env فایل نه DB معلومات لوستل ──────────────────────────
set DB_HOST=localhost
set DB_PORT=3306
set DB_USER=root
set DB_PASSWORD=
set DB_NAME=kandahar_wms_db

for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if "%%A"=="DB_HOST"     set DB_HOST=%%B
  if "%%A"=="DB_USER"     set DB_USER=%%B
  if "%%A"=="DB_PASSWORD" set DB_PASSWORD=%%B
  if "%%A"=="DB_NAME"     set DB_NAME=%%B
  if "%%A"=="DB_PORT"     set DB_PORT=%%B
)

:: ── د node_modules چیک ───────────────────────────────────────
echo [1/4] Checking packages...
if not exist "node_modules\" (
  echo Installing frontend packages...
  call npm install
  if errorlevel 1 (
    echo ERROR: Frontend npm install failed!
    echo Please run: npm cache clean --force   then try again.
    pause & exit /b 1
  )
)
if not exist "backend\node_modules\" (
  echo Installing backend packages...
  cd backend && call npm install && cd ..
  if errorlevel 1 (
    echo ERROR: Backend npm install failed!
    echo Please run as Administrator or: npm cache clean --force
    pause & exit /b 1
  )
)
echo    Packages OK

:: ── د MySQL ډیټابیس چیک او جوړول ─────────────────────────────
echo [2/4] Setting up database...
mysql -u %DB_USER% -p%DB_PASSWORD% -h %DB_HOST% -P %DB_PORT% -e "SELECT 1;" > nul 2>&1
if errorlevel 1 (
  echo ERROR: Could not connect to MySQL!
  echo Make sure MySQL is running and password in .env is correct.
  pause & exit /b 1
)

mysql -u %DB_USER% -p%DB_PASSWORD% -h %DB_HOST% -P %DB_PORT% %DB_NAME% -e "SHOW TABLES;" > nul 2>&1
if errorlevel 1 (
  echo Creating database schema...
  mysql -u %DB_USER% -p%DB_PASSWORD% -h %DB_HOST% -P %DB_PORT% < backend\src\database\schema.sql
  echo Applying seed data...
  mysql -u %DB_USER% -p%DB_PASSWORD% -h %DB_HOST% -P %DB_PORT% %DB_NAME% < backend\src\database\seed.sql
  echo    Database ready
) else (
  echo    Database already exists - OK
)

:: ── Backend پیل کول ───────────────────────────────────────────
echo [3/4] Starting Backend API (port 3001)...
start "WMS Backend" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 4 /nobreak > nul

:: ── Frontend پیل کول ──────────────────────────────────────────
echo [4/4] Starting Frontend (port 5000)...
start "WMS Frontend" cmd /k "cd /d %~dp0 && npm run dev"
timeout /t 5 /nobreak > nul

:: ── براوزر خلاصول ─────────────────────────────────────────────
echo.
echo Opening http://localhost:5000 ...
start http://localhost:5000

echo.
echo ================================================
echo   Both servers are starting in separate windows
echo   Frontend: http://localhost:5000
echo   Backend:  http://localhost:3001/api/health
echo ================================================
echo.
echo You can close THIS window. Keep the other two open.
pause
