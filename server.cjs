'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dir = '/data';
const credentialsPath = path.join(dir, 'owner.json');
const authTemplate = fs.readFileSync('/opt/globalping-web/auth.html', 'utf8');
const dashboard = fs.readFileSync('/opt/globalping-web/index.html');
const sessions = new Map();
const attempts = new Map();
fs.mkdirSync(dir, { recursive: true });

function authPage(setup, error = '') {
	return authTemplate
		.replaceAll('{{TITLE}}', setup ? 'Create owner account' : 'Sign in')
		.replaceAll('{{ACTION}}', setup ? '/setup' : '/login')
		.replaceAll('{{BUTTON}}', setup ? 'Create owner account' : 'Sign in')
		.replaceAll('{{ERROR}}', error);
}

function readOwner() {
	try {
		return JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
	} catch (error) {
		if (error.code === 'ENOENT') return null;
		throw error;
	}
}

function sendHtml(res, status, body) {
	res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' }).end(body);
}

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

	if (req.method === 'GET' && req.url === '/') {
		const owner = readOwner();
		const cookie = /(?:^|;\s*)gp_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '');
		const expiry = cookie && sessions.get(cookie[1]);

		if (owner && expiry && expiry > Date.now()) {
			sendHtml(res, 200, dashboard);
		} else {
			if (cookie) sessions.delete(cookie[1]);
			sendHtml(res, 200, authPage(!owner));
		}
		return;
	}

	if (req.method !== 'POST' || (req.url !== '/setup' && req.url !== '/login')) {
		res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
		return;
	}

	const now = Date.now();
	const client = req.socket.remoteAddress || 'unknown';
	const prior = attempts.get(client);

	if (prior && prior.until > now && prior.count >= 10) {
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
		const username = values.get('username') || '';
		const password = values.get('password') || '';
		const owner = readOwner();
		const setup = req.url === '/setup';

		if (setup && !owner && /^[A-Za-z0-9_.-]{1,64}$/.test(username) && password.length >= 12 && password.length <= 256) {
			const salt = crypto.randomBytes(16).toString('hex');
			const hash = crypto.scryptSync(password, salt, 64).toString('hex');

			try {
				fs.writeFileSync(credentialsPath, JSON.stringify({ username, salt, hash }), { flag: 'wx', mode: 0o600 });
				res.writeHead(303, { Location: '/' }).end();
				return;
			} catch (error) {
				if (error.code !== 'EEXIST') throw error;
			}
		}

		if (!setup && owner && username === owner.username && typeof owner.salt === 'string' && /^[a-f0-9]{128}$/.test(owner.hash)) {
			const actual = crypto.scryptSync(password, owner.salt, 64);

			if (crypto.timingSafeEqual(actual, Buffer.from(owner.hash, 'hex'))) {
				attempts.delete(client);
				for (const [id, expires] of sessions) {
					if (expires <= now) sessions.delete(id);
				}

				if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
				const session = crypto.randomBytes(32).toString('hex');
				sessions.set(session, now + 28800000);
				const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
				res.writeHead(303, { Location: '/', 'Set-Cookie': `gp_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure ? '; Secure' : ''}` }).end();
				return;
			}
		}

		if (attempts.size >= 1000) attempts.clear();
		const state = prior && prior.until > now ? prior : { count: 0, until: now + 60000 };
		state.count++;
		attempts.set(client, state);
		sendHtml(res, 400, authPage(!readOwner(), setup ? 'Setup failed. Use a valid username and a password of at least 12 characters.' : 'Incorrect username or password.'));
	});
}).listen(3000, '0.0.0.0');
