#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MYSQL_DATA_DIR="$WORKSPACE_DIR/mysql_data"
MYSQL_SOCK="/tmp/mysql.sock"
MYSQL_PID="/tmp/mysql.pid"
MYSQL_PORT=3306
CURRENT_USER="$(whoami)"

start_mysql() {
  if mysqld --user="$CURRENT_USER" --datadir="$MYSQL_DATA_DIR" \
    --socket="$MYSQL_SOCK" \
    --pid-file="$MYSQL_PID" \
    --port="$MYSQL_PORT" \
    --mysqlx=OFF \
    --daemonize 2>/dev/null; then
    echo "[WMS] MySQL started (daemonize)."
  else
    echo "[WMS] Starting MySQL in background..."
    mysqld --user="$CURRENT_USER" --datadir="$MYSQL_DATA_DIR" \
      --socket="$MYSQL_SOCK" \
      --pid-file="$MYSQL_PID" \
      --port="$MYSQL_PORT" \
      --mysqlx=OFF \
      --log-error="$MYSQL_DATA_DIR/repl.err" \
      2>>"$MYSQL_DATA_DIR/repl.err" &
  fi
}

wait_for_mysql() {
  echo "[WMS] Waiting for MySQL to be ready..."
  for i in $(seq 1 60); do
    if mysql -u root -h 127.0.0.1 -P "$MYSQL_PORT" -e "SELECT 1;" > /dev/null 2>&1; then
      echo "[WMS] MySQL is ready."
      return 0
    fi
    sleep 1
  done
  echo "[WMS] MySQL did not start in time."
  return 1
}

init_db() {
  DB_EXISTS=$(mysql -u root -h 127.0.0.1 -P "$MYSQL_PORT" -e "SHOW DATABASES LIKE 'kandahar_wms_db';" 2>/dev/null | grep -c kandahar_wms_db || echo 0)
  if [ "$DB_EXISTS" -eq 0 ]; then
    echo "[WMS] Initializing database schema..."
    mysql -u root -h 127.0.0.1 -P "$MYSQL_PORT" < "$SCRIPT_DIR/src/database/schema.sql"
    echo "[WMS] Database schema created."
  else
    echo "[WMS] Database already exists, skipping schema init."
  fi
  echo "[WMS] Applying seed data (INSERT IGNORE - safe to re-run)..."
  mysql -u root -h 127.0.0.1 -P "$MYSQL_PORT" < "$SCRIPT_DIR/src/database/seed.sql" 2>/dev/null || true
}

if [ ! -d "$MYSQL_DATA_DIR" ]; then
  echo "[WMS] Initializing MySQL data directory..."
  mkdir -p "$MYSQL_DATA_DIR"
  mysqld --initialize-insecure --user="$CURRENT_USER" --datadir="$MYSQL_DATA_DIR" 2>&1
fi

start_mysql
wait_for_mysql || exit 1
init_db

echo "[WMS] Starting backend API server (production)..."
exec node "$SCRIPT_DIR/dist/server.js"
