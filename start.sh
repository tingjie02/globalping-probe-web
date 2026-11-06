#!/bin/bash
set -e
export WEB_USERNAME="${WEB_USERNAME:-admin}"
if [ -z "${WEB_PASSWORD:-}" ]; then
  WEB_PASSWORD="$(node -e "process.stdout.write(require('node:crypto').randomBytes(24).toString('hex'))")"
  export WEB_PASSWORD
  printf 'Generated web login: username=%s password=%s\n' "$WEB_USERNAME" "$WEB_PASSWORD"
fi
if [ ${#WEB_PASSWORD} -lt 16 ]; then
  echo 'WEB_PASSWORD must have at least 16 characters.' >&2
  exit 1
fi
node /opt/globalping-web/server.cjs &
exec /bin/bash /entrypoint.sh
