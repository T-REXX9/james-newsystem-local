#!/usr/bin/env bash
# Feedback loop: does this sales-agent login carry Sales Inquiry Edit unit price?
# Usage: SI_EMAIL=... SI_PASSWORD=... ./scripts/diagnose-si-edit-unit-price.sh
# Exit 0 = green (can edit catalog unit prices). Exit 1 = red (locked).
set -euo pipefail

API_BASE="${VITE_API_BASE_URL:-http://127.0.0.1:8081/api/v1}"
EMAIL="${SI_EMAIL:?Set SI_EMAIL}"
PASSWORD="${SI_PASSWORD:?Set SI_PASSWORD}"

RESP="$(curl -sS -X POST "${API_BASE}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")"

python3 - "$RESP" <<'PY'
import json, sys
payload = json.loads(sys.argv[1])
if not payload.get("ok"):
    print("RED: login failed:", payload.get("error") or payload)
    sys.exit(1)
user = (payload.get("data") or {}).get("user") or {}
ap = user.get("action_permissions") or {}
pages = ap.get("pages") or {}
si = pages.get("Sales Inquiry") or {}
flag = si.get("can_edit_unit_price")
if flag is None:
    flag = (ap.get("global") or {}).get("can_edit_unit_price")
print("email:", user.get("email"))
print("role:", user.get("role_name"))
print("group_id:", user.get("group_id"))
print("Sales Inquiry pages entry:", "yes" if "Sales Inquiry" in pages else "no")
print("can_edit_unit_price:", flag)
if flag is True:
    print("GREEN: session allows catalog unit-price edits on Sales Inquiry")
    sys.exit(0)
print("RED: session does not allow catalog unit-price edits (UI will lock catalog prices)")
sys.exit(1)
PY
