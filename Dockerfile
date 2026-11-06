FROM ghcr.io/jsdelivr/globalping-probe:latest

ENV GP_ADOPTION_TOKEN="" \
    WEB_USERNAME="admin" \
    WEB_PASSWORD=""

COPY server.cjs /opt/globalping-web/server.cjs
COPY index.html /opt/globalping-web/index.html
COPY start.sh /opt/globalping-web/start.sh

EXPOSE 8080

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/healthz > /dev/null || exit 1

CMD ["/bin/bash", "/opt/globalping-web/start.sh"]
