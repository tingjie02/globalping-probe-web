FROM ghcr.io/jsdelivr/globalping-probe:latest

COPY server.cjs /opt/globalping-web/server.cjs
COPY index.html /opt/globalping-web/index.html
COPY auth.html /opt/globalping-web/auth.html

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3000/healthz > /dev/null || exit 1

CMD ["/bin/bash", "-c", "node /opt/globalping-web/server.cjs & exec /bin/bash /entrypoint.sh"]
