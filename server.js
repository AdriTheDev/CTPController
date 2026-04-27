import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import express from 'express';
import crypto from 'crypto';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getLanIP() {
	for (const iface of Object.values(networkInterfaces()))
		for (const addr of iface) if (addr.family === 'IPv4' && !addr.internal) return addr.address;
	return 'localhost';
}

const HTTP_PORT = 3001;
const SCOPES = 'user-read-playback-state user-modify-playback-state';

const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
	try {
		return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
	} catch {
		return {
			obs: { host: 'localhost', port: '4455', password: '' },
			obs_runway: { host: 'localhost', port: '4455', password: '' },
			trackaudio: { host: 'localhost', port: '49080' },
			spotify: { clientId: '' },
			youtube: { chatUrl: '' },
		};
	}
}

function saveConfig(cfg) {
	fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

let appConfig = loadConfig();

const spotify = {
	verifier: null,
	clientId: null,
	redirectUri: null,
	accessToken: null,
	refreshToken: null,
	pending: false,
};

const mkVerifier = () => crypto.randomBytes(64).toString('base64url');
const mkChallenge = (v) => crypto.createHash('sha256').update(v).digest('base64url');

function getOrigin(req) {
	const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
	const host = req.headers['x-forwarded-host'] || req.headers.host;
	return `${proto}://${host}`;
}

const app = express();
app.use(express.json());
app.set('trust proxy', true);

const isProd = process.env.NODE_ENV === 'production';

app.get('/api/config', (_req, res) => {
	res.json({
		obs: appConfig.obs,
		obs_runway: appConfig.obs_runway,
		trackaudio: appConfig.trackaudio,
		spotify: { clientId: appConfig.spotify?.clientId || '' },
		youtube: appConfig.youtube || { chatUrl: '' },
	});
});

app.post('/api/config', (req, res) => {
	const { obs, obs_runway, trackaudio, spotify, youtube } = req.body;
	if (obs) appConfig.obs = { ...appConfig.obs, ...obs };
	if (obs_runway) appConfig.obs_runway = { ...appConfig.obs_runway, ...obs_runway };
	if (trackaudio) appConfig.trackaudio = { ...appConfig.trackaudio, ...trackaudio };
	if (spotify) appConfig.spotify = { ...appConfig.spotify, ...spotify };
	if (youtube) appConfig.youtube = { ...appConfig.youtube, ...youtube };
	saveConfig(appConfig);
	res.json({ ok: true });
});

app.get('/manifest.json', (_req, res) => {
	res.sendFile(path.join(__dirname, isProd ? 'dist' : 'public', 'manifest.json'));
});
app.get('/sw.js', (_req, res) => {
	res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
	res.setHeader('Service-Worker-Allowed', '/');
	res.sendFile(path.join(__dirname, isProd ? 'dist' : 'public', 'sw.js'));
});
app.get('/icons/:file', (req, res) => {
	const iconDir = path.join(__dirname, isProd ? 'dist' : 'public', 'icons');
	res.sendFile(path.join(iconDir, req.params.file));
});

app.get('/auth/spotify/start', (req, res) => {
	const { clientId } = req.query;
	if (!clientId) return res.status(400).json({ error: 'clientId required' });

	const verifier = mkVerifier();
	const challenge = mkChallenge(verifier);
	const redirectUri = `${getOrigin(req)}/auth/spotify/callback`;

	Object.assign(spotify, {
		verifier,
		clientId,
		redirectUri,
		accessToken: null,
		refreshToken: null,
		pending: true,
	});

	const params = new URLSearchParams({
		client_id: clientId,
		response_type: 'code',
		redirect_uri: redirectUri,
		scope: SCOPES,
		code_challenge_method: 'S256',
		code_challenge: challenge,
	});
	res.json({ url: `https://accounts.spotify.com/authorize?${params}` });
});

app.get('/auth/spotify/callback', async (req, res) => {
	const { code, error } = req.query;
	const html = (title, body, color = '#e8e4f0') =>
		`<html><body style="font-family:sans-serif;padding:40px;background:#0f0e13;color:${color}">
      <h2>${title}</h2><p>${body}</p>
      <script>setTimeout(()=>window.close(),2500)</script>
    </body></html>`;

	if (error) {
		spotify.pending = false;
		return res.send(html('❌ Auth failed', `Spotify returned: ${error}`));
	}
	if (!code || !spotify.verifier || !spotify.clientId || !spotify.redirectUri) {
		spotify.pending = false;
		return res.status(400).send(html('❌ Missing session', 'Start the auth flow again from the app.'));
	}

	try {
		const r = await fetch('https://accounts.spotify.com/api/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				redirect_uri: spotify.redirectUri,
				client_id: spotify.clientId,
				code_verifier: spotify.verifier,
			}),
		});
		const data = await r.json();
		if (data.access_token) {
			spotify.accessToken = data.access_token;
			spotify.refreshToken = data.refresh_token || null;
			spotify.pending = false;
			spotify.verifier = null;
			res.send(html('✓ Spotify authenticated!', 'You can close this tab and return to the app.', '#34d399'));
		} else {
			spotify.pending = false;
			res.send(html('❌ Token error', data.error_description || data.error || 'Unknown error'));
		}
	} catch (e) {
		spotify.pending = false;
		res.status(500).send(html('❌ Server error', e.message));
	}
});

app.get('/auth/spotify/status', (_req, res) => {
	res.json(
		spotify.accessToken
			? {
					authenticated: true,
					accessToken: spotify.accessToken,
					refreshToken: spotify.refreshToken,
				}
			: { authenticated: false, pending: spotify.pending },
	);
});

app.post('/auth/spotify/refresh', async (req, res) => {
	const clientId = req.body.clientId || spotify.clientId;
	const refreshToken = req.body.refreshToken || spotify.refreshToken;
	if (!refreshToken || !clientId) return res.status(400).json({ error: 'Missing fields' });
	try {
		const r = await fetch('https://accounts.spotify.com/api/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				client_id: clientId,
			}),
		});
		const data = await r.json();
		if (data.access_token) {
			spotify.accessToken = data.access_token;
			if (data.refresh_token) spotify.refreshToken = data.refresh_token;
		}
		res.status(r.ok ? 200 : r.status).json(data);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

app.post('/auth/spotify/logout', (_req, res) => {
	Object.assign(spotify, {
		accessToken: null,
		refreshToken: null,
		pending: false,
		verifier: null,
		redirectUri: null,
	});
	res.json({ ok: true });
});

const distDir = path.join(__dirname, 'dist');

if (isProd && fs.existsSync(distDir)) {
	app.use(express.static(distDir));
	app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
} else {
	app.use(
		'/',
		createProxyMiddleware({
			target: 'http://127.0.0.1:5173',
			changeOrigin: true,
			ws: true,
			on: {
				error: (_e, _q, res) => res.status(502).send('Vite dev server not running — run: npm run dev'),
			},
		}),
	);
}

const bindHost = isProd ? '127.0.0.1' : '0.0.0.0';

http.createServer(app).listen(HTTP_PORT, bindHost, () => {
	const mode = isProd ? 'production' : 'development';
	console.log(`\n  CTP Controller v1.2.0 [${mode}]`);
	console.log(`  Listening: http://${bindHost}:${HTTP_PORT}`);
	if (!isProd) {
		console.log(`  Network:   http://${getLanIP()}:${HTTP_PORT}`);
	}
	console.log();
});
