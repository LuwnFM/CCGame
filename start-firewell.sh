#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null || [ "$(node -p "Number(process.versions.node.split('.')[0])")" -lt 24 ]; then
  echo "Нужен Node.js 24 или новее." >&2
  exit 1
fi
mkdir -p data
export FIREWELL_DB="$PWD/data/firewell.sqlite"
export PORT=3000
export FIREWELL_BIND=127.0.0.1
if [ -z "${FIREWELL_ALPHA_PASSWORD:-}" ]; then
  read -r -s -p "Общий пароль допуска к альфе (не менее 10 символов): " FIREWELL_ALPHA_PASSWORD
  echo
  export FIREWELL_ALPHA_PASSWORD
fi
read -r -p "Разрешить вход с телефона в локальной сети? [y/N]: " LAN
if [ "${LAN,,}" = y ]; then export FIREWELL_BIND=0.0.0.0; fi
read -r -p "HTTPS-адрес клиента Vercel (иначе Enter): " FIREWELL_CLIENT_ORIGIN
export FIREWELL_CLIENT_ORIGIN
echo "Сервер и клиент: http://localhost:3000"
exec node --experimental-strip-types src/server.ts
