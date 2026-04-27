# CTP Stream Controller

A self-hosted stream control panel for Cross The Pond / VATSIM UK events.  
Controls OBS, Spotify playback, and TrackAudio frequencies from a web browser.

---

## Features

- **OBS WebSocket** — switch scenes (Live / BRB / Starting Soon), toggle overlays (GND / TWR / APP / CTR) with one-active-at-a-time enforcement
- **Spotify** — play/pause, next/prev, fade in/out, volume — via PKCE OAuth (no implicit flow)
- **TrackAudio** — live frequency list with RX indicator, per-station mute, mute-all; sorted CTR → APP → TWR → GND → DEL
- **Auth** — access control via nginx basic auth (configured at the reverse proxy level)
- **Zulu clock** — live UTC time in the status bar

---

## Quick start (local development)

### Requirements

- Node.js v24+
- OBS 28+ (for WebSocket support)
- TrackAudio running on the same network
- A Spotify Developer app (free, takes ~2 minutes)

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm start
```

This runs two processes concurrently:

- **Vite** dev server on `http://127.0.0.1:5173`
- **Express** auth/proxy server on `http://127.0.0.1:3001`

Open `http://127.0.0.1:3001` in your browser.

---

## Configuration

### OBS source and scene names

Edit the constants at the top of `src/pages/OverlaysPage.jsx`:

```js
const OVERLAY_SOURCES = [
	{ key: 'EGGX_CTR', label: 'EGGX', description: 'Shanwick Radio', sourceName: 'EGGX_CTR', scene: 'ES + Overlay' },
	{ key: 'LON_C_CTR', label: 'AC Central', description: 'AC Central', sourceName: 'LON_C_CTR', scene: 'ES + Overlay' },
	{ key: 'EGLL_F_APP', label: 'LL FIN', description: 'Heathrow FIN', sourceName: 'EGLL_F_APP', scene: 'ES + Overlay' },
	{ key: 'EGLL_N_TWR', label: 'LL AIR N', description: 'Heathrow AIR North', sourceName: 'EGLL_N_TWR', scene: 'ES + Overlay' },
	{ key: 'EGLL_S_TWR', label: 'LL AIR S', description: 'Heathrow AIR South', sourceName: 'EGLL_S_TWR', scene: 'ES + Overlay' },
	{ key: 'EGLL_2_GND', label: 'LL GMC 2', description: 'Heathrow GMC 2', sourceName: 'EGLL_2_GND', scene: 'ES + Overlay' },
	{ key: 'EGLL_1_GND', label: 'LL GMC 1', description: 'Heathrow GMC 1', sourceName: 'EGLL_1_GND', scene: 'ES + Overlay' },
];

const QUICK_SCENES = [
	{ label: 'Starting Screen', sceneName: 'Starting Screen', isBrb: false },
	{ label: 'BRB', sceneName: 'Break', isBrb: true },
	{ label: 'Controller View', sceneName: 'ES + Overlay', isBrb: false },
	{ label: 'Ending', sceneName: 'Ending', isBrb: false },
];
```

`sourceName` must match your OBS source name exactly. `scene` is the scene that source lives in.

### OBS WebSocket

- Enable in OBS: **Tools → WebSocket Server Settings → Enable WebSocket server**
- Default port: `4455`
- Enter host + port in the app's Settings page

### TrackAudio

- Default WebSocket: `ws://localhost:49080/ws`
- Enter host + port in the app's Settings page
- Station order: CTR → APP → TWR → GND → DEL (matched by callsign suffix, e.g. `EGLL_APP`)

### Spotify

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Create an app (any name/description)
3. Add your app's URL + `/auth/spotify/callback` as a Redirect URI
    - Local: `http://127.0.0.1:3001/auth/spotify/callback`
    - Domain: `https://ctp.<yourdomain>.com/auth/spotify/callback`
4. Copy the Client ID and paste it in Settings → Spotify
5. Click **Authenticate** — a tab opens for you to approve access, then the app updates automatically

---

## Production deployment (Linux + nginx)

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full instructions.

The short version:

1. Run `npm run build` — outputs to `dist/`
2. Point nginx at the `dist/` folder for static assets and proxy `/auth/*` to `server.js`
3. Run `server.js` as a systemd service
4. Obtain a Let's Encrypt cert via Certbot

---

## Building for production

```bash
npm run build
```

Output goes to `dist/`. When running in production, `server.js` serves the built static files directly rather than proxying to Vite.

---