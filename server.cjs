'use strict';
const http = require('node:http');
const fs = require('node:fs');
const crypto = require('node:crypto');

const login = fs.readFileSync('/opt/globalping-web/login.html');
const page = fs.readFileSync('/opt/globalping-web/index.html');
const sessions = new Map();
const attempts = new Map();
const digest = value => crypto.createHash('sha256').update(value).digest();
const usernameHash = digest(process.env.WEB_USERNAME);
const passwordHash = digest(process.env.WEB_PASSWORD);

http.createServer((req, res) => {
	res.setHeader('Cache-Control', 'no-store');
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('Referrer-Policy', 'no-referrer');
	res.setHeader('Content-Security-Policy', 'default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; frame-ancestors \'none\'; form-action \'self\'');

	if (req.method === 'GET' && req.url === '/healthz') {
		res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('ok');
		return;
	}

	if (req.method === 'POST' && req.url === '/login') {
		const now = Date.now();
		const client = req.socket.remoteAddress || 'unknown';
		const state = attempts.get(client);

		if (state && state.until > now && state.count >= 10) {
			res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' }).end('Too many attempts. Try again later.');
			return;
		}

		let body = '';
		req.on('data', chunk => {
			body += chunk;

			if (body.length > 4096) req.destroy();
		});
		req.on('end', () => {
			const values = new URLSearchParams(body);
			const validUser = crypto.timingSafeEqual(digest(values.get('username') || ''), usernameHash);
			const validPassword = crypto.timingSafeEqual(digest(values.get('password') || ''), passwordHash);

			if (!validUser || !validPassword) {
				if (attempts.size >= 1000) attempts.clear();
				const current = state && state.until > now ? state : { count: 0, until: now + 60000 };
				current.count++;
				attempts.set(client, current);
				res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' }).end(login);
				return;
			}

			attempts.delete(client);
			for (const [id, expires] of sessions) {
				if (expires <= now) sessions.delete(id);
			}

			if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
			const session = crypto.randomBytes(32).toString('hex');
			sessions.set(session, now + 8 * 60 * 60 * 1000);
			const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
			res.writeHead(303, { Location: '/', 'Set-Cookie': `gp_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure ? '; Secure' : ''}` }).end();
		});
		return;
	}

	if (req.method !== 'GET' || req.url !== '/') {
		res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
		return;
	}

	const cookie = /(?:^|;\s*)gp_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '');
	const expiry = cookie && sessions.get(cookie[1]);

	if (!expiry || expiry <= Date.now()) {
		if (cookie) sessions.delete(cookie[1]);
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(login);
		return;
	}

	res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page);
}).listen(8080, '0.0.0.0');

