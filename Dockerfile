FROM node:22.23.4-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json /app/
RUN npm ci --include=dev

COPY src /app/src
COPY config /app/config
COPY @types /app/@types
RUN npm run build

FROM node:22.23.4-bookworm-slim

ARG node_env=production
ENV NODE_ENV=$node_env

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json /app/

RUN apt-get update -y \
    && apt-get install --no-install-recommends -y \
        expect ca-certificates iputils-ping traceroute dnsutils \
        jq tini mtr-tiny curl \
    && apt-get clean \
    && apt-get autoremove -y \
    && npm install --omit=dev --omit=optional \
    && rm -rf /var/lib/apt /var/lib/dpkg /var/lib/cache /var/lib/log \
    && rm -rf /usr/share/icons /var/lib/X11 /var/lib/doc \
    && rm -rf /var/cache/apt /var/cache/debconf \
        /var/cache/fontconfig /var/cache/ldconfig \
    && rm -rf /opt /root/.npm /usr/share/man \
        /usr/lib/arm-linux-gnueabihf/perl-base \
        /usr/include /usr/local/include \
        /usr/local/lib/node_modules/npm/docs \
    && rm -rf /sbin/debugfs /sbin/e2fsck /sbin/ldconfig /usr/bin/perl*

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/config /app/config
COPY bin/entrypoint.sh /entrypoint.sh

# Keep the web page outside /app: the probe's updater can replace /app.
RUN mkdir -p /opt/globalping-web \
    && printf '%s\n' \
      "'use strict';" \
      "const http = require('node:http');" \
      "const page = '<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Globalping Probe</title></head><body><h1>Globalping Probe</h1><p>The web page is running. Check the dashboard for probe status.</p><p><a href=\"https://dash.globalping.io/\">Open Globalping Dashboard</a></p></body></html>';" \
      "http.createServer((req, res) => {" \
      "  if (req.url !== '/' && req.url !== '/healthz') return res.writeHead(404).end();" \
      "  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });" \
      "  res.end(page);" \
      "}).listen(8080, '0.0.0.0');" \
      > /opt/globalping-web/web.cjs

EXPOSE 8080

# Checks the web server only; it does not verify probe connectivity.
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/healthz > /dev/null || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]

CMD ["/bin/bash", "-c", "node /opt/globalping-web/web.cjs & exec /bin/bash /entrypoint.sh"]
