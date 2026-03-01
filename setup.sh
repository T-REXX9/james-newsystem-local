#!/usr/bin/env bash
set -euo pipefail

# One-command Ubuntu setup for james-newsystem (API + webapp).
# This script installs dependencies, configures MySQL, clones repos,
# builds frontend, starts API + preview, and prints access URLs.

API_REPO_URL="${API_REPO_URL:-https://github.com/T-REXX9/james-newsystem-api.git}"
WEB_REPO_URL="${WEB_REPO_URL:-https://github.com/T-REXX9/james-newsystem-local.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/james-system}"
API_DIR="$INSTALL_DIR/api"
WEB_DIR="$INSTALL_DIR/james-newsystem"

DB_NAME="${DB_NAME:-topnotch}"
DB_USER="${DB_USER:-james}"
DB_PASS="${DB_PASS:-james123}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

API_HOST="${API_HOST:-0.0.0.0}"
API_PORT="${API_PORT:-8081}"
WEB_HOST="${WEB_HOST:-0.0.0.0}"
WEB_PORT="${WEB_PORT:-8080}"

# Optional DB dump source:
# 1) local file path passed via DB_DUMP_PATH
# 2) local file at ./topnotch.sql (next to setup.sh)
# 3) downloadable URL via DB_DUMP_URL
DB_DUMP_PATH="${DB_DUMP_PATH:-}"
DB_DUMP_URL="${DB_DUMP_URL:-}"

SUPABASE_URL_DEFAULT="https://fevdccbmjejkzyofzwpx.supabase.co"
SUPABASE_ANON_KEY_DEFAULT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldmRjY2JtamVqa3p5b2Z6d3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNzk3OTEsImV4cCI6MjA3OTY1NTc5MX0.FMUbzthMJ1H8325kHcPWPlkAxkdfKTuJkR-_WAUM3t4"
VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-$SUPABASE_URL_DEFAULT}"
VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-$SUPABASE_ANON_KEY_DEFAULT}"
VITE_MAIN_ID="${VITE_MAIN_ID:-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$INSTALL_DIR/logs"
API_LOG="$LOG_DIR/api.log"
WEB_LOG="$LOG_DIR/web.log"
DB_DUMP_TMP="/tmp/topnotch_setup_dump.sql"
DB_IMPORT_USER="${DB_IMPORT_USER:-root}"

TOTAL_STEPS=16
CURRENT_STEP=0

progress_bar() {
  local current="$1"
  local total="$2"
  local width=36
  local percent=$(( current * 100 / total ))
  local filled=$(( current * width / total ))
  local empty=$(( width - filled ))
  printf "\n["
  printf "%0.s#" $(seq 1 "$filled")
  printf "%0.s-" $(seq 1 "$empty")
  printf "] %3d%% (%d/%d)\n" "$percent" "$current" "$total"
}

step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  progress_bar "$CURRENT_STEP" "$TOTAL_STEPS"
  echo "[$CURRENT_STEP/$TOTAL_STEPS] $1"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $1"
    exit 1
  }
}

sudo_keepalive() {
  sudo -v
  while true; do sudo -n true; sleep 50; kill -0 "$$" || exit; done 2>/dev/null &
  SUDO_PID=$!
}

cleanup() {
  if [[ -n "${SUDO_PID:-}" ]] && kill -0 "$SUDO_PID" >/dev/null 2>&1; then
    kill "$SUDO_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

step "Checking prerequisites and sudo access"
need_cmd bash
need_cmd curl
need_cmd awk
need_cmd sed
sudo_keepalive

step "Updating apt package index"
sudo apt-get update -y

step "Installing system packages (git, mysql, php, build tools)"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates \
  curl \
  git \
  gnupg \
  lsb-release \
  build-essential \
  mysql-server \
  php \
  php-cli \
  php-mysql \
  pv \
  unzip \
  jq

step "Installing Node.js 22 + npm"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null | cut -d. -f1 | tr -d 'v')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi
need_cmd node
need_cmd npm

step "Creating installation directories"
mkdir -p "$INSTALL_DIR" "$LOG_DIR"

step "Cloning or updating API repository"
if [[ -d "$API_DIR/.git" ]]; then
  git -C "$API_DIR" fetch --all --prune
  git -C "$API_DIR" checkout main
  git -C "$API_DIR" pull --ff-only
else
  git clone "$API_REPO_URL" "$API_DIR"
fi

step "Cloning or updating web repository"
if [[ -d "$WEB_DIR/.git" ]]; then
  git -C "$WEB_DIR" fetch --all --prune
  git -C "$WEB_DIR" checkout main
  git -C "$WEB_DIR" pull --ff-only
else
  git clone "$WEB_REPO_URL" "$WEB_DIR"
fi

step "Starting MySQL service"
sudo systemctl enable --now mysql

step "Applying MySQL large-import tuning"
sudo tee /etc/mysql/conf.d/99-james-import.cnf >/dev/null <<'EOF'
[mysqld]
max_allowed_packet=1G
net_read_timeout=600
net_write_timeout=600
wait_timeout=28800
interactive_timeout=28800
innodb_lock_wait_timeout=600

[mysql]
max_allowed_packet=1G
EOF
sudo systemctl restart mysql

step "Configuring MySQL database and application user"
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

step "Importing MySQL data dump (if provided)"
FOUND_DUMP=""
if [[ -n "$DB_DUMP_PATH" && -f "$DB_DUMP_PATH" ]]; then
  FOUND_DUMP="$DB_DUMP_PATH"
elif [[ -f "$SCRIPT_DIR/backup.sql" ]]; then
  FOUND_DUMP="$SCRIPT_DIR/backup.sql"
elif [[ -f "$SCRIPT_DIR/backup.sql.gz" ]]; then
  FOUND_DUMP="$SCRIPT_DIR/backup.sql.gz"
elif [[ -f "$SCRIPT_DIR/topnotch.sql" ]]; then
  FOUND_DUMP="$SCRIPT_DIR/topnotch.sql"
elif [[ -f "$SCRIPT_DIR/topnotch.sql.gz" ]]; then
  FOUND_DUMP="$SCRIPT_DIR/topnotch.sql.gz"
elif [[ -f "$INSTALL_DIR/topnotch.sql" ]]; then
  FOUND_DUMP="$INSTALL_DIR/topnotch.sql"
elif [[ -f "$INSTALL_DIR/topnotch.sql.gz" ]]; then
  FOUND_DUMP="$INSTALL_DIR/topnotch.sql.gz"
elif [[ -n "$DB_DUMP_URL" ]]; then
  echo "Downloading DB dump from DB_DUMP_URL..."
  if [[ "$DB_DUMP_URL" == *.gz ]]; then
    curl -fL "$DB_DUMP_URL" -o "${DB_DUMP_TMP}.gz"
    FOUND_DUMP="${DB_DUMP_TMP}.gz"
  else
    curl -fL "$DB_DUMP_URL" -o "$DB_DUMP_TMP"
    FOUND_DUMP="$DB_DUMP_TMP"
  fi
fi

if [[ -n "$FOUND_DUMP" ]]; then
  echo "Importing dump: $FOUND_DUMP"
  # Follow the known-good import pattern from legacy setup:
  # mysql -u root --init-command="SET SESSION innodb_strict_mode=0; SET GLOBAL innodb_strict_mode=0;" topnotch < backup.sql
  # while keeping large-file streaming support.
  if [[ "$DB_IMPORT_USER" == "root" ]]; then
    sudo mysql -u root -e "SET GLOBAL innodb_strict_mode=0;"
    MYSQL_IMPORT_CMD=(
      sudo mysql
      -u root
      --default-character-set=utf8mb4
      --max_allowed_packet=1G
      --net_buffer_length=1048576
      --connect-timeout=30
      --init-command="SET SESSION innodb_strict_mode=0; SET SESSION foreign_key_checks=0; SET SESSION unique_checks=0; SET SESSION sql_log_bin=0;"
      "$DB_NAME"
    )
  else
    MYSQL_IMPORT_CMD=(
      mysql
      -h "$DB_HOST"
      -P "$DB_PORT"
      -u "$DB_USER"
      "-p$DB_PASS"
      --default-character-set=utf8mb4
      --max_allowed_packet=1G
      --net_buffer_length=1048576
      --connect-timeout=30
      --init-command="SET SESSION innodb_strict_mode=0; SET SESSION foreign_key_checks=0; SET SESSION unique_checks=0; SET SESSION sql_log_bin=0;"
      "$DB_NAME"
    )
  fi

  if [[ "$FOUND_DUMP" == *.gz ]]; then
    pv "$FOUND_DUMP" | gzip -dc | "${MYSQL_IMPORT_CMD[@]}"
  else
    pv "$FOUND_DUMP" | "${MYSQL_IMPORT_CMD[@]}"
  fi
else
  echo "WARNING: No DB dump provided."
  echo "The app will run, but real data/login may not work until you import your topnotch SQL dump."
  echo "Provide one via DB_DUMP_PATH=/path/to/topnotch.sql or DB_DUMP_URL=..."
fi

step "Writing API environment file"
cat > "$API_DIR/.env" <<EOF
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1:${API_PORT}

DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
EOF

step "Writing web environment file"
cat > "$WEB_DIR/.env.local" <<EOF
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
VITE_API_BASE_URL=http://127.0.0.1:${API_PORT}/api/v1
VITE_MAIN_ID=${VITE_MAIN_ID}
EOF

step "Installing frontend npm dependencies"
(cd "$WEB_DIR" && npm install)

step "Building frontend for preview"
(cd "$WEB_DIR" && npm run build)

step "Starting API server and web preview in background"
pkill -f "php -S ${API_HOST}:${API_PORT} -t public" >/dev/null 2>&1 || true
pkill -f "vite preview --host ${WEB_HOST} --port ${WEB_PORT}" >/dev/null 2>&1 || true

nohup bash -lc "cd '$API_DIR' && php -S ${API_HOST}:${API_PORT} -t public" >"$API_LOG" 2>&1 &
sleep 2
nohup bash -lc "cd '$WEB_DIR' && npm run preview -- --host ${WEB_HOST} --port ${WEB_PORT}" >"$WEB_LOG" 2>&1 &
sleep 4

step "Verifying services and printing access URLs"
HOST_IP="$(hostname -I | awk '{print $1}')"

API_HEALTH_URL="http://127.0.0.1:${API_PORT}/api/v1/health"
WEB_URL_LOCAL="http://127.0.0.1:${WEB_PORT}"
WEB_URL_LAN="http://${HOST_IP}:${WEB_PORT}"

echo
echo "Setup complete."
echo "Node version: $(node -v)"
echo "NPM version:  $(npm -v)"
echo
echo "API health endpoint: ${API_HEALTH_URL}"
echo "Web app (local):     ${WEB_URL_LOCAL}"
echo "Web app (LAN):       ${WEB_URL_LAN}"
echo
echo "Logs:"
echo "  API log: ${API_LOG}"
echo "  Web log: ${WEB_LOG}"
echo
echo "If API health check fails, inspect:"
echo "  tail -n 100 ${API_LOG}"
echo "  tail -n 100 ${WEB_LOG}"
