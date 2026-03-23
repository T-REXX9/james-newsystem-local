#!/usr/bin/env bash
set -euo pipefail

# One-command Ubuntu setup for james-newsystem (API + webapp).
# This script installs dependencies, configures MySQL, clones repos,
# builds frontend, starts API + preview, and prints access URLs.

API_REPO_URL="${API_REPO_URL:-https://github.com/T-REXX9/james-newsystem-api.git}"
WEB_REPO_URL="${WEB_REPO_URL:-https://github.com/T-REXX9/james-newsystem-local.git}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/james-system}"
API_DIR="$INSTALL_DIR/api"
WEB_DIR="$INSTALL_DIR/james-newsystem"

DB_NAME="${DB_NAME:-}"
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
DB_COMPAT_TRANSFORM="${DB_COMPAT_TRANSFORM:-1}"

MODE="${1:-install}"
if [[ "$MODE" == "--help" || "$MODE" == "-h" || "$MODE" == "help" ]]; then
  cat <<'EOF'
Usage:
  ./setup.sh            # full fresh install (default)
  ./setup.sh install    # same as default
  ./setup.sh update     # update api + web repos, rebuild, restart services
  ./setup.sh restart    # restart api + web preview only
EOF
  exit 0
fi

if [[ "$MODE" != "install" && "$MODE" != "update" && "$MODE" != "restart" ]]; then
  echo "ERROR: unknown mode '$MODE'. Use: install | update | restart"
  exit 1
fi

TOTAL_STEPS=16
if [[ "$MODE" == "update" ]]; then
  TOTAL_STEPS=9
elif [[ "$MODE" == "restart" ]]; then
  TOTAL_STEPS=4
fi
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

db_query_scalar() {
  local query="$1"
  local result=""
  if result=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" -Nse "$query" 2>/dev/null); then
    echo "$result"
    return 0
  fi
  if result=$(sudo mysql -Nse "$query" 2>/dev/null); then
    echo "$result"
    return 0
  fi
  return 1
}

validate_stack() {
  local api_health_url="$1"
  local benchmark_url="$2"
  local health_code=""
  local table_count=""
  local account_count=""
  local patient_count=""
  local benchmark_samples=8
  local times=""

  echo
  echo "Post-setup validation:"

  health_code="$(curl -sS -o /tmp/james_api_health.json -w "%{http_code}" "$api_health_url" || true)"
  if [[ "$health_code" != "200" ]]; then
    echo "  [FAIL] API health check failed (${health_code:-no-response})"
    return 1
  fi
  echo "  [OK] API health returned 200"

  table_count="$(db_query_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" || echo "")"
  account_count="$(db_query_scalar "SELECT COUNT(*) FROM \`${DB_NAME}\`.tblaccount;" || echo "")"
  patient_count="$(db_query_scalar "SELECT COUNT(*) FROM \`${DB_NAME}\`.tblpatient;" || echo "")"

  if [[ -z "$table_count" || "$table_count" -eq 0 ]]; then
    echo "  [FAIL] Database '${DB_NAME}' has no tables."
    return 1
  fi
  if [[ -z "$account_count" || "$account_count" -eq 0 ]]; then
    echo "  [FAIL] tblaccount is empty."
    return 1
  fi
  if [[ -z "$patient_count" || "$patient_count" -eq 0 ]]; then
    echo "  [FAIL] tblpatient is empty."
    return 1
  fi
  echo "  [OK] Database rows: tblaccount=${account_count}, tblpatient=${patient_count}"

  for _ in $(seq 1 "$benchmark_samples"); do
    local t=""
    t="$(curl -sS -o /dev/null -w "%{time_total}" "$benchmark_url" || echo "99")"
    times="${times} ${t}"
  done

  local stats=""
  stats="$(echo "$times" | awk '{
    min=$1; max=$1; sum=0;
    for (i=1;i<=NF;i++) {
      v=$i+0;
      sum+=v;
      if (v<min) min=v;
      if (v>max) max=v;
    }
    avg=sum/NF;
    printf "%.4f %.4f %.4f", avg, min, max;
  }')"

  local avg min max
  read -r avg min max <<<"$stats"
  echo "  [OK] API benchmark (${benchmark_samples} runs): avg=${avg}s min=${min}s max=${max}s"

  if awk -v a="$avg" 'BEGIN { exit (a > 2.50) ? 0 : 1 }'; then
    echo "  [FAIL] API benchmark is too slow (avg > 2.50s)."
    return 1
  fi
  if awk -v a="$avg" 'BEGIN { exit (a > 1.20) ? 0 : 1 }'; then
    echo "  [WARN] API is usable but slower than target (avg > 1.20s)."
  else
    echo "  [OK] API speed is within target."
  fi

  return 0
}

write_api_env() {
  local env_example="$API_DIR/.env.example"
  if [[ -f "$env_example" ]]; then
    awk \
      -v app_url="http://127.0.0.1:${API_PORT}" \
      -v db_host="${DB_HOST}" \
      -v db_port="${DB_PORT}" \
      -v db_name="${DB_NAME}" \
      -v db_user="${DB_USER}" \
      -v db_pass="${DB_PASS}" '
      BEGIN {
        overrides["APP_URL"] = app_url;
        overrides["DB_HOST"] = db_host;
        overrides["DB_PORT"] = db_port;
        overrides["DB_NAME"] = db_name;
        overrides["DB_USER"] = db_user;
        overrides["DB_PASS"] = db_pass;
      }
      /^[A-Za-z_][A-Za-z0-9_]*=/ {
        split($0, parts, "=");
        key = parts[1];
        if (key in overrides) {
          print key "=" overrides[key];
          seen[key] = 1;
          next;
        }
      }
      { print }
      END {
        for (key in overrides) {
          if (!(key in seen)) {
            print key "=" overrides[key];
          }
        }
      }
    ' "$env_example" > "$API_DIR/.env"
    return 0
  fi

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
}

write_web_env() {
  cat > "$WEB_DIR/.env.local" <<EOF
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
VITE_API_BASE_URL=http://127.0.0.1:${API_PORT}/api/v1
VITE_MAIN_ID=${VITE_MAIN_ID}
EOF
}

restart_services() {
  pkill -f "php -S ${API_HOST}:${API_PORT} -t public" >/dev/null 2>&1 || true
  pkill -f "vite preview --host ${WEB_HOST} --port ${WEB_PORT}" >/dev/null 2>&1 || true

  nohup bash -lc "cd '$API_DIR' && php -S ${API_HOST}:${API_PORT} -t public" >"$API_LOG" 2>&1 &
  sleep 2
  nohup bash -lc "cd '$WEB_DIR' && npm run preview -- --host ${WEB_HOST} --port ${WEB_PORT}" >"$WEB_LOG" 2>&1 &
  sleep 4
}

print_service_urls() {
  local host_ip
  host_ip="$(hostname -I | awk '{print $1}')"

  echo
  echo "API health endpoint: http://127.0.0.1:${API_PORT}/api/v1/health"
  echo "Web app (local):     http://127.0.0.1:${WEB_PORT}"
  echo "Web app (LAN):       http://${host_ip}:${WEB_PORT}"
  echo
  echo "Logs:"
  echo "  API log: ${API_LOG}"
  echo "  Web log: ${WEB_LOG}"
}

build_auth_repo_url() {
  local url="$1"
  if [[ -z "$GITHUB_TOKEN" ]]; then
    echo "$url"
    return 0
  fi

  if [[ "$url" == https://github.com/* ]]; then
    echo "${url/https:\/\/github.com\//https:\/\/x-access-token:${GITHUB_TOKEN}@github.com\/}"
    return 0
  fi

  echo "$url"
}

read_env_example_value() {
  local env_file="$1"
  local key="$2"

  [[ -f "$env_file" ]] || return 1

  awk -F= -v wanted_key="$key" '
    $1 == wanted_key {
      sub(/^[^=]*=/, "", $0)
      print $0
      exit
    }
  ' "$env_file"
}

git_safe_clone_or_pull() {
  local repo_url="$1"
  local target_dir="$2"
  local repo_label="$3"
  local auth_url
  auth_url="$(build_auth_repo_url "$repo_url")"

  if [[ -d "$target_dir/.git" ]]; then
    GIT_TERMINAL_PROMPT=0 git -C "$target_dir" fetch --all --prune || {
      echo "ERROR: Unable to fetch $repo_label."
      echo "If repo is private, export GITHUB_TOKEN=<token-with-repo-scope> and re-run."
      exit 1
    }
    git -C "$target_dir" checkout main
    GIT_TERMINAL_PROMPT=0 git -C "$target_dir" pull --ff-only || {
      echo "ERROR: Unable to pull latest changes for $repo_label."
      echo "If repo is private, export GITHUB_TOKEN=<token-with-repo-scope> and re-run."
      exit 1
    }
  else
    GIT_TERMINAL_PROMPT=0 git clone "$auth_url" "$target_dir" || {
      echo "ERROR: Unable to clone $repo_label."
      echo "If repo is private, export GITHUB_TOKEN=<token-with-repo-scope> and re-run."
      echo "Example: GITHUB_TOKEN=ghp_xxx ./setup.sh"
      exit 1
    }
  fi
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

if [[ "$MODE" == "restart" ]]; then
  step "Restarting API server and web preview"
  restart_services

  step "Verifying services and printing access URLs"
  API_HEALTH_URL="http://127.0.0.1:${API_PORT}/api/v1/health"
  curl -fsS "$API_HEALTH_URL" >/dev/null

  echo
  echo "Restart complete."
  print_service_urls
  exit 0
fi

step "Cloning or updating API repository"
git_safe_clone_or_pull "$API_REPO_URL" "$API_DIR" "API repository"

step "Cloning or updating web repository"
git_safe_clone_or_pull "$WEB_REPO_URL" "$WEB_DIR" "web repository"

if [[ -z "$DB_NAME" ]]; then
  DB_NAME="$(read_env_example_value "$API_DIR/.env.example" "DB_NAME" || true)"
fi
DB_NAME="${DB_NAME:-topnotch_migrate}"

if [[ "$MODE" == "update" ]]; then
  step "Writing API and web environment files"
  write_api_env
  write_web_env

  step "Installing/updating frontend npm dependencies"
  (cd "$WEB_DIR" && npm install)

  step "Building frontend for preview"
  (cd "$WEB_DIR" && npm run build)

  step "Restarting API server and web preview"
  restart_services

  step "Verifying services and printing access URLs"
  HOST_IP="$(hostname -I | awk '{print $1}')"
  API_HEALTH_URL="http://127.0.0.1:${API_PORT}/api/v1/health"
  WEB_URL_LOCAL="http://127.0.0.1:${WEB_PORT}"
  WEB_URL_LAN="http://${HOST_IP}:${WEB_PORT}"
  BENCHMARK_MAIN_ID="$(db_query_scalar "SELECT CAST(lmain_id AS UNSIGNED) FROM \`${DB_NAME}\`.tblpatient WHERE lmain_id IS NOT NULL AND lmain_id <> '' ORDER BY lid ASC LIMIT 1;" || true)"
  if [[ -z "$BENCHMARK_MAIN_ID" ]]; then
    BENCHMARK_MAIN_ID="$VITE_MAIN_ID"
  fi
  BENCHMARK_URL="http://127.0.0.1:${API_PORT}/api/v1/daily-call-monitoring/excel?main_id=${BENCHMARK_MAIN_ID}&status=all&search="

  validate_stack "$API_HEALTH_URL" "$BENCHMARK_URL"

  echo
  echo "Update complete."
  print_service_urls
  exit 0
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

  transform_sql_stream() {
    # Compatibility transforms for older MySQL/MariaDB engines.
    # 1) MySQL8-style date defaults may fail in MariaDB.
    # 2) MySQL8 collation may not exist in older engines.
    # 3) DEFINER clauses can fail when accounts don't exist.
    sed -E \
      -e 's/DEFAULT[[:space:]]+CURRENT_DATE(\(\))?/DEFAULT NULL/gI' \
      -e 's/ON[[:space:]]+UPDATE[[:space:]]+CURRENT_DATE(\(\))?//gI' \
      -e 's/utf8mb4_0900_ai_ci/utf8mb4_unicode_ci/g' \
      -e 's/DEFINER=`[^`]+`@`[^`]+`//g'
  }

  if [[ "$FOUND_DUMP" == *.gz ]]; then
    if [[ "$DB_COMPAT_TRANSFORM" == "1" ]]; then
      pv "$FOUND_DUMP" | gzip -dc | transform_sql_stream | "${MYSQL_IMPORT_CMD[@]}"
    else
      pv "$FOUND_DUMP" | gzip -dc | "${MYSQL_IMPORT_CMD[@]}"
    fi
  else
    if [[ "$DB_COMPAT_TRANSFORM" == "1" ]]; then
      pv "$FOUND_DUMP" | transform_sql_stream | "${MYSQL_IMPORT_CMD[@]}"
    else
      pv "$FOUND_DUMP" | "${MYSQL_IMPORT_CMD[@]}"
    fi
  fi
else
  echo "WARNING: No DB dump provided."
  echo "The app will run, but real data/login may not work until you import your topnotch SQL dump."
  echo "Provide one via DB_DUMP_PATH=/path/to/topnotch.sql or DB_DUMP_URL=..."
fi

step "Writing API environment file"
write_api_env

step "Writing web environment file"
write_web_env

step "Installing frontend npm dependencies"
(cd "$WEB_DIR" && npm install)

step "Building frontend for preview"
(cd "$WEB_DIR" && npm run build)

step "Starting API server and web preview in background"
restart_services

step "Verifying services and printing access URLs"
HOST_IP="$(hostname -I | awk '{print $1}')"

API_HEALTH_URL="http://127.0.0.1:${API_PORT}/api/v1/health"
WEB_URL_LOCAL="http://127.0.0.1:${WEB_PORT}"
WEB_URL_LAN="http://${HOST_IP}:${WEB_PORT}"
BENCHMARK_MAIN_ID="$(db_query_scalar "SELECT CAST(lmain_id AS UNSIGNED) FROM \`${DB_NAME}\`.tblpatient WHERE lmain_id IS NOT NULL AND lmain_id <> '' ORDER BY lid ASC LIMIT 1;" || true)"
if [[ -z "$BENCHMARK_MAIN_ID" ]]; then
  BENCHMARK_MAIN_ID="$VITE_MAIN_ID"
fi
BENCHMARK_URL="http://127.0.0.1:${API_PORT}/api/v1/daily-call-monitoring/excel?main_id=${BENCHMARK_MAIN_ID}&status=all&search="

validate_stack "$API_HEALTH_URL" "$BENCHMARK_URL"

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
