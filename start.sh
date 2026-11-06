#!/bin/bash
set -e
if [ -z "${WEB_USERNAME:-}" ] || [ ${#WEB_PASSWORD} -lt 16 ]; then
  echo 'WEB_USERNAME and a WEB_PASSWORD of at least 16 characters are required.' >&2
  exit 1
fi
node /opt/globalping-web/server.cjs &
exec /bin/bash /entrypoint.sh
