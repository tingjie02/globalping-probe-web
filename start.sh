#!/bin/bash
set -e
export WEB_USERNAME="${WEB_USERNAME:-admin}"
export WEB_PASSWORD="${WEB_PASSWORD:-ChangeMe123}"
echo 'Web login is ready. Username is configured by WEB_USERNAME; password is configured by WEB_PASSWORD.'
node /opt/globalping-web/server.cjs &
exec /bin/bash /entrypoint.sh
