import { useState, useEffect } from 'react';
import { useOBSStream, STREAM_CONTROLLER, STREAM_RUNWAY } from '../context/OBSContext';
import { useSpotify } from '../context/SpotifyContext';
import { useTrackAudio } from '../context/TrackAudioContext';
import { useLog } from '../context/LogContext';
import { useLocalMusic } from '../context/LocalMusicContext';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
	return (
		<div className={styles.page}>
			<ControllerOBSSettings />
			<RunwayOBSSettings />
			<SpotifySettings />
			<TrackAudioSettings />
			<YoutubeSettings />
			<LogPanel />
		</div>
	);
}

function ControllerOBSSettings() {
	const { status, errorMsg, config, connect, disconnect } = useOBSStream(STREAM_CONTROLLER);
	const connected = status === 'connected';
	const connecting = status === 'connecting';

	const [host, setHost] = useState(config.host || 'localhost');
	const [port, setPort] = useState(config.port || '4455');
	const [pass, setPass] = useState(config.password || '');
	const [localErr, setLocalErr] = useState('');

	useEffect(() => {
		if (config.host) setHost(config.host);
		if (config.port) setPort(config.port);
	}, [config.host, config.port]);

	async function handleConnect(e) {
		e.preventDefault();
		setLocalErr('');
		try {
			await connect({ host, port, password: pass });
		} catch (err) {
			setLocalErr(err.message || 'Connection failed');
		}
	}

	return (
		<section className="card">
			<div className="card-header">
				<span className="card-title">Controller Views — OBS WebSocket</span>
				<span className={`badge ${connected ? 'green' : status === 'connecting' ? 'amber' : status === 'error' ? 'red' : ''}`}>
					<span className="dot" />
					{connected ? 'Connected' : connecting ? 'Connecting…' : status === 'error' ? 'Error' : 'Disconnected'}
				</span>
			</div>
			<div className="card-body">
				<form className={styles.form} onSubmit={handleConnect}>
					<div className={styles.row3}>
						<div className="input-group">
							<label>Host</label>
							<input className="input" value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost or IP" />
						</div>
						<div className="input-group">
							<label>Port</label>
							<input
								className="input"
								value={port}
								onChange={(e) => setPort(e.target.value)}
								placeholder="4455"
								style={{ width: 90 }}
							/>
						</div>
						<div className="input-group">
							<label>Password</label>
							<input
								className="input"
								type="password"
								value={pass}
								onChange={(e) => setPass(e.target.value)}
								placeholder="optional"
							/>
						</div>
					</div>
					{(localErr || errorMsg) && <p className={styles.error}>{localErr || errorMsg}</p>}
					<div className={styles.actions}>
						<button type="submit" className="btn primary" disabled={connecting}>
							{connecting ? 'Connecting…' : connected ? 'Reconnect' : 'Connect'}
						</button>
						{connected && (
							<button type="button" className="btn" onClick={disconnect}>
								Disconnect
							</button>
						)}
					</div>
				</form>
				<div className={styles.hint}>
					Enable in OBS via <strong>Tools → WebSocket Server Settings</strong>. Default port is 4455. Connection settings are
					saved to the server and restored automatically on next launch.
				</div>
			</div>
		</section>
	);
}

function RunwayOBSSettings() {
	const { status, errorMsg, config, connect, disconnect } = useOBSStream(STREAM_RUNWAY);
	const connected = status === 'connected';
	const connecting = status === 'connecting';

	const [host, setHost] = useState(config.host || 'localhost');
	const [port, setPort] = useState(config.port || '4455');
	const [pass, setPass] = useState(config.password || '');
	const [localErr, setLocalErr] = useState('');

	useEffect(() => {
		if (config.host) setHost(config.host);
		if (config.port) setPort(config.port);
	}, [config.host, config.port]);

	async function handleConnect(e) {
		e.preventDefault();
		setLocalErr('');
		try {
			await connect({ host, port, password: pass });
		} catch (err) {
			setLocalErr(err.message || 'Connection failed');
		}
	}

	return (
		<section className="card">
			<div className="card-header">
				<span className="card-title">Runway Stream — OBS WebSocket</span>
				<span className={`badge ${connected ? 'green' : status === 'connecting' ? 'amber' : status === 'error' ? 'red' : ''}`}>
					<span className="dot" />
					{connected ? 'Connected' : connecting ? 'Connecting…' : status === 'error' ? 'Error' : 'Disconnected'}
				</span>
			</div>
			<div className="card-body">
				<form className={styles.form} onSubmit={handleConnect}>
					<div className={styles.row3}>
						<div className="input-group">
							<label>Host</label>
							<input className="input" value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost or IP" />
						</div>
						<div className="input-group">
							<label>Port</label>
							<input
								className="input"
								value={port}
								onChange={(e) => setPort(e.target.value)}
								placeholder="4455"
								style={{ width: 90 }}
							/>
						</div>
						<div className="input-group">
							<label>Password</label>
							<input
								className="input"
								type="password"
								value={pass}
								onChange={(e) => setPass(e.target.value)}
								placeholder="optional"
							/>
						</div>
					</div>
					{(localErr || errorMsg) && <p className={styles.error}>{localErr || errorMsg}</p>}
					<div className={styles.actions}>
						<button type="submit" className="btn primary" disabled={connecting}>
							{connecting ? 'Connecting…' : connected ? 'Reconnect' : 'Connect'}
						</button>
						{connected && (
							<button type="button" className="btn" onClick={disconnect}>
								Disconnect
							</button>
						)}
					</div>
				</form>
				<div className={styles.hint}>
					Connect to the OBS instance running the Runway camera stream. Settings are saved to the server and restored
					automatically on next launch.
				</div>
			</div>
		</section>
	);
}

function SpotifySettings() {
	const { token, clientId, authError, authStatus, setClientId, authorize, logout } = useSpotify();
	const [localId, setLocalId] = useState(clientId || '');
	const waiting = authStatus === 'waiting';

	useEffect(() => {
		if (clientId) setLocalId(clientId);
	}, [clientId]);

	function handleAuth(e) {
		e.preventDefault();
		fetch('/api/config', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ spotify: { clientId: localId } }),
		}).catch(() => {});
		setClientId(localId);
		authorize(localId);
	}

	return (
		<section className="card">
			<div className="card-header">
				<span className="card-title">Spotify</span>
				<span className={`badge ${token ? 'green' : waiting ? 'amber' : ''}`}>
					<span className="dot" />
					{token ? 'Authenticated' : waiting ? 'Waiting for login…' : 'Not connected'}
				</span>
			</div>
			<div className="card-body">
				{token ? (
					<div className={styles.connectedRow}>
						<p className={styles.connectedMsg}>✓ Spotify authenticated and active.</p>
						<button className="btn danger" onClick={logout}>
							Log out
						</button>
					</div>
				) : (
					<form className={styles.form} onSubmit={handleAuth}>
						<div className="input-group">
							<label>Spotify App Client ID</label>
							<input
								className="input"
								value={localId}
								onChange={(e) => setLocalId(e.target.value)}
								placeholder="Paste your Client ID here"
								style={{ maxWidth: 380 }}
							/>
						</div>
						{authError && <p className={styles.error}>{authError}</p>}
						{waiting && (
							<p className={styles.waiting}>
								⏳ A Spotify login tab has been opened. Complete the login there — this page will update automatically once
								done.
							</p>
						)}
						<div className={styles.actions}>
							<button type="submit" className="btn primary" disabled={!localId || waiting}>
								{waiting ? 'Waiting for login…' : 'Authenticate with Spotify'}
							</button>
						</div>
					</form>
				)}
				<div className={styles.hint}>
					<strong>Scene automation:</strong> Spotify fades out when switching to live/overlay scenes, and fades in when switching
					to Starting Soon, BRB, or Ending.
					<br />
					<br />
					<strong>One-time Spotify setup:</strong>
					<ol className={styles.ol}>
						<li>
							Go to{' '}
							<a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
								developer.spotify.com/dashboard
							</a>
						</li>
						<li>
							Create an app, add <code className={styles.code}>/auth/spotify/callback</code> (on your domain) as a Redirect
							URI
						</li>
						<li>Paste the Client ID above and click Authenticate</li>
						<li>Complete the login on the PC — this page updates automatically</li>
					</ol>
				</div>
			</div>
		</section>
	);
}

function TrackAudioSettings() {
	const { status, errorMsg, config, connect, disconnect } = useTrackAudio();
	const connected = status === 'connected';
	const connecting = status === 'connecting';

	const [host, setHost] = useState(config.host || 'localhost');
	const [port, setPort] = useState(config.port || '49080');

	useEffect(() => {
		if (config.host) setHost(config.host);
		if (config.port) setPort(config.port);
	}, [config.host, config.port]);

	function handleConnect(e) {
		e.preventDefault();
		connect({ host, port });
	}

	return (
		<section className="card">
			<div className="card-header">
				<span className="card-title">TrackAudio</span>
				<span className={`badge ${connected ? 'green' : connecting ? 'amber' : status === 'error' ? 'red' : ''}`}>
					<span className="dot" />
					{connected ? 'Connected' : connecting ? 'Connecting…' : status === 'error' ? 'Error' : 'Disconnected'}
				</span>
			</div>
			<div className="card-body">
				<form className={styles.form} onSubmit={handleConnect}>
					<div className={styles.row2}>
						<div className="input-group">
							<label>Host</label>
							<input
								className="input"
								value={host}
								onChange={(e) => setHost(e.target.value)}
								placeholder="localhost or IP"
								style={{ maxWidth: 380 }}
							/>
						</div>
					</div>
					{errorMsg && <p className={styles.error}>{errorMsg}</p>}
					<div className={styles.actions}>
						<button type="submit" className="btn primary" disabled={connecting}>
							{connecting ? 'Connecting…' : connected ? 'Reconnect' : 'Connect'}
						</button>
						{connected && (
							<button type="button" className="btn" onClick={disconnect}>
								Disconnect
							</button>
						)}
					</div>
				</form>
				<div className={styles.hint}>
					Default port is <code className={styles.code}>49080</code>. Auto-reconnects every 5s on disconnect. Connection settings
					are saved to the server and restored automatically on next launch.
				</div>
			</div>
		</section>
	);
}

function YoutubeSettings() {
	const [url, setUrl] = useState('');
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		fetch('/api/config')
			.then((r) => r.json())
			.then((cfg) => {
				if (cfg.youtube?.chatUrl) setUrl(cfg.youtube.chatUrl);
			})
			.catch(() => {});
	}, []);

	async function handleSave(e) {
		e.preventDefault();
		await fetch('/api/config', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ youtube: { chatUrl: url } }),
		});
		localStorage.setItem('yt_chat_url', url);
		setSaved(true);
		setTimeout(() => setSaved(false), 2000);
	}

	return (
		<section className="card">
			<div className="card-header">
				<span className="card-title">YouTube Live Chat</span>
				{saved && <span className="badge green">Saved</span>}
			</div>
			<div className="card-body">
				<form className={styles.form} onSubmit={handleSave}>
					<div className="input-group">
						<label>YouTube Stream URL</label>
						<input
							className="input"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="https://www.youtube.com/watch?v=..."
							style={{ maxWidth: 480 }}
						/>
					</div>
					<div className={styles.actions}>
						<button type="submit" className="btn primary">
							Save
						</button>
					</div>
				</form>
				<div className={styles.hint}>
					Paste your YouTube stream URL. The live chat will appear in the side panel and on the Preview page. Use a full watch URL
					— it will be converted to an embed automatically.
				</div>
			</div>
		</section>
	);
}

function LogPanel() {
	const { entries } = useLog();

	function fmt(ts) {
		return [ts.getUTCHours(), ts.getUTCMinutes(), ts.getUTCSeconds()].map((n) => String(n).padStart(2, '0')).join(':') + 'Z';
	}

	return (
		<section className="card">
			<div className="card-header">
				<span className="card-title">Event Log</span>
				<span className={styles.logCount}>{entries.length} entries</span>
			</div>
			<div className={styles.logBody}>
				{entries.map((e, i) => (
					<div key={i} className={styles.logEntry}>
						<span className={styles.logTs}>{fmt(e.ts)}</span>
						<span className={styles.logMsg}>{e.msg}</span>
					</div>
				))}
			</div>
		</section>
	);
}
