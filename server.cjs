'use strict';
const http = require('node:http');
const fs = require('node:fs');
const crypto = require('node:crypto');

const page = fs.readFileSync('/opt/globalping-web/index.html');
const expected = crypto.createHash('sha256')
  .update(`${process.env.WEB_USERNAME}:${process.env.WEB_PASSWORD}`).digest();

http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('ok');
    return;
  }
  if (req.url !== '/') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  const header = req.headers.authorization || '';
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
  const supplied = match ? Buffer.from(match[1], 'base64') : Buffer.alloc(0);
  const digest = crypto.createHash('sha256').update(supplied).digest();
  if (!match || !crypto.timingSafeEqual(digest, expected)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Globalping Probe", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' }).end('Authentication required');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page);
}).listen(8080, '0.0.0.0');
