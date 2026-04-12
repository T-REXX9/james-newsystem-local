#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${ROOT_DIR}/.env.shared"
LEGACY_CONFIG_FILE="${ROOT_DIR}/dev.config.env"

if [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
elif [[ -f "${LEGACY_CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${LEGACY_CONFIG_FILE}"
fi

NEWSYSTEM_HOST="${NEWSYSTEM_HOST:-0.0.0.0}"
NEWSYSTEM_PORT="${NEWSYSTEM_PORT:-8080}"
API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-8081}"
REALTIME_HOST="${REALTIME_HOST:-127.0.0.1}"
REALTIME_PORT="${REALTIME_PORT:-8082}"
API_BASE_URL_OVERRIDE="${API_BASE_URL:-}"
WEB_MODE="${WEB_MODE:-dev}"

API_DIR="${ROOT_DIR}/api"
NEWSYSTEM_DIR="${ROOT_DIR}/james-newsystem"

print_usage() {
  cat <<'EOF'
Usage: ./start-dev.sh [dev|preview] [options]

Modes:
  dev        Start Vite dev server (default)
  preview    Build and start Vite preview server

Options:
  --web-port <port>     Override frontend port
  --api-port <port>     Override API port
  --web-host <host>     Override frontend host
  --api-host <host>     Override API host
  --realtime-port <port> Override realtime socket port
  --realtime-host <host> Override realtime socket host
  -h, --help            Show this help

Examples:
  ./start-dev.sh
  ./start-dev.sh dev --web-port 8080
  ./start-dev.sh preview --web-port 3305
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    dev|preview)
      WEB_MODE="$1"
      shift
      ;;
    --web-port)
      NEWSYSTEM_PORT="${2:-}"
      shift 2
      ;;
    --api-port)
      API_PORT="${2:-}"
      shift 2
      ;;
    --web-host)
      NEWSYSTEM_HOST="${2:-}"
      shift 2
      ;;
    --api-host)
      API_HOST="${2:-}"
      shift 2
      ;;
    --realtime-port)
      REALTIME_PORT="${2:-}"
      shift 2
      ;;
    --realtime-host)
      REALTIME_HOST="${2:-}"
      shift 2
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      print_usage
      exit 1
      ;;
  esac
done

if [[ -n "${API_BASE_URL_OVERRIDE}" ]]; then
  API_BASE_URL="${API_BASE_URL_OVERRIDE}"
else
  API_BASE_URL="http://${API_HOST}:${API_PORT}/api/v1"
fi

kill_port_processes() {
  local port="$1"
  local label="$2"
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti "tcp:${port}" || true)"
  fi

  if [[ -z "${pids}" ]]; then
    return 0
  fi

  echo "Stopping existing ${label} process(es) on port ${port}: ${pids}"
  for pid in ${pids}; do
    kill "${pid}" 2>/dev/null || true
  done

  sleep 1

  local remaining=""
  if command -v lsof >/dev/null 2>&1; then
    remaining="$(lsof -ti "tcp:${port}" || true)"
  fi
  if [[ -n "${remaining}" ]]; then
    echo "Force-killing remaining process(es) on port ${port}: ${remaining}"
    for pid in ${remaining}; do
      kill -9 "${pid}" 2>/dev/null || true
    done
  fi
}

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "${API_PID}" 2>/dev/null; then
    kill "${API_PID}" 2>/dev/null || true
  fi
  if [[ -n "${REALTIME_PID:-}" ]] && kill -0 "${REALTIME_PID}" 2>/dev/null; then
    kill "${REALTIME_PID}" 2>/dev/null || true
  fi
  if [[ -n "${WEB_PID:-}" ]] && kill -0 "${WEB_PID}" 2>/dev/null; then
    kill "${WEB_PID}" 2>/dev/null || true
  fi
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local max_attempts="${3:-30}"
  local attempt=1

  while (( attempt <= max_attempts )); do
    if curl --silent --fail --max-time 2 "${url}" >/dev/null 2>&1; then
      echo "${label} is ready at ${url}"
      return 0
    fi

    sleep 1
    ((attempt+=1))
  done

  echo "Timed out waiting for ${label} at ${url}" >&2
  return 1
}

trap cleanup EXIT INT TERM

kill_port_processes "${NEWSYSTEM_PORT}" "new system"
kill_port_processes "${API_PORT}" "api"
kill_port_processes "${REALTIME_PORT}" "internal chat realtime"

echo "Starting API on http://${API_HOST}:${API_PORT}"
(
  cd "${API_DIR}"
  INTERNAL_CHAT_SOCKET_NOTIFY_URL="http://${REALTIME_HOST}:${REALTIME_PORT}/internal-chat/events" \
  INTERNAL_CHAT_SOCKET_SECRET="${INTERNAL_CHAT_SOCKET_SECRET:-${AUTH_SECRET:-${APP_KEY:-change-me-in-env}}}" \
  PHP_CLI_SERVER_WORKERS="${PHP_CLI_SERVER_WORKERS:-4}" php -S "${API_HOST}:${API_PORT}" -t public
) &
API_PID=$!
wait_for_http "http://${API_HOST}:${API_PORT}/api/v1/health" "API"

echo "Starting Internal Chat Realtime on http://${REALTIME_HOST}:${REALTIME_PORT}"
(
  cd "${NEWSYSTEM_DIR}"
  INTERNAL_CHAT_SOCKET_HOST="${REALTIME_HOST}" \
  INTERNAL_CHAT_SOCKET_PORT="${REALTIME_PORT}" \
  INTERNAL_CHAT_SOCKET_SECRET="${INTERNAL_CHAT_SOCKET_SECRET:-${AUTH_SECRET:-${APP_KEY:-change-me-in-env}}}" \
    npm run realtime
) &
REALTIME_PID=$!
wait_for_http "http://${REALTIME_HOST}:${REALTIME_PORT}/health" "Internal Chat Realtime"

echo "Starting New System (${WEB_MODE}) on http://localhost:${NEWSYSTEM_PORT}/james-newsystem/"
(
  cd "${NEWSYSTEM_DIR}"
  if [[ "${WEB_MODE}" == "preview" ]]; then
    npm run build
    VITE_API_BASE_URL="${API_BASE_URL}" \
      VITE_INTERNAL_CHAT_SOCKET_URL="http://${REALTIME_HOST}:${REALTIME_PORT}" \
      npm run preview -- --host "${NEWSYSTEM_HOST}" --port "${NEWSYSTEM_PORT}"
  else
    VITE_API_BASE_URL="${API_BASE_URL}" \
      VITE_INTERNAL_CHAT_SOCKET_URL="http://${REALTIME_HOST}:${REALTIME_PORT}" \
      npm run dev -- --host "${NEWSYSTEM_HOST}" --port "${NEWSYSTEM_PORT}"
  fi
) &
WEB_PID=$!

echo "API + realtime + frontend (${WEB_MODE}) are running. Press Ctrl+C to stop."
wait "${API_PID}" "${REALTIME_PID}" "${WEB_PID}"
