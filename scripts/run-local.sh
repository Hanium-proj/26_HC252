#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -x "$project_root/backend/.venv/bin/python" || ! -f "$project_root/backend/.env" ]]; then
  echo 'backend/.venv and backend/.env are required. See README.md.' >&2
  exit 1
fi
if [[ ! -d "$project_root/frontend/node_modules" ]]; then
  echo 'Run npm ci in frontend/ first.' >&2
  exit 1
fi
backend_port="${BACKEND_PORT:-8000}"
frontend_port="${FRONTEND_PORT:-3001}"
"$project_root/backend/.venv/bin/python" - "$backend_port" "$frontend_port" <<'PY'
import socket,sys
for port in map(int,sys.argv[1:]):
 with socket.socket() as sock:
  try: sock.bind(('127.0.0.1',port))
  except OSError: raise SystemExit(f'Port {port} is already in use; do not start a duplicate server.')
PY
(cd "$project_root/backend" && exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$backend_port" --no-access-log) &
backend_pid=$!
trap 'kill "$backend_pid" 2>/dev/null || true' EXIT INT TERM
cd "$project_root/frontend"
export BACKEND_URL="http://127.0.0.1:$backend_port"
npm run dev -- --port "$frontend_port"
