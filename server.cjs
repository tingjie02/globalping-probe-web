'use strict';
const http = require('node:http');
const fs = require('node:fs');

const page = fs.readFileSync('/opt/globalping-web/index.html');

http.createServer((req, res) => {
	res.setHeader('Cache-Control', 'no-store');
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('Referrer-Policy', 'no-referrer');
	res.setHeader('Content-Security-Policy', 'default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; frame-ancestors \'none\'; form-action \'none\'');

	if (req.method === 'GET' && req.url === '/healthz') {
		res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('ok');
		return;
	}

	if (req.method === 'GET' && req.url === '/') {
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page);
		return;
	}

	res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
}).listen(8080, '0.0.0.0');
