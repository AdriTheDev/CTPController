import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useLog } from './LogContext';

const SpotifyContext = createContext(null);
const SCOPES = 'user-read-playback-state user-modify-playback-state';
const FADE_SECS = 3;
const FADE_STEPS = 30;

export function SpotifyProvider({ children }) {
	const { log } = useLog();

	const [clientId, setClientIdState] = useState(() => localStorage.getItem('sp_client_id') || '');
	const [token, setToken] = useState(() => localStorage.getItem('sp_token') || '');
	const [playing, setPlaying] = useState(false);
	const [volume, setVolumeState] = useState(50);
	const [track, setTrack] = useState(null);
	const [fading, setFading] = useState(null);
	const [authError, setAuthError] = useState('');
	const [authStatus, setAuthStatus] = useState('idle'); // idle | waiting | done | error

	const pollRef = useRef(null);
	const fadeRef = useRef(null);
	const authPollRef = useRef(null);
	const volumeRef = useRef(volume);

	useEffect(() => {
		fetch('/api/config')
			.then((r) => r.json())
			.then((cfg) => {
				const cid = cfg.spotify?.clientId;
				if (cid) {
					setClientIdState(cid);
					localStorage.setItem('sp_client_id', cid);
				}
			})
			.catch(() => {});
	}, []);

	const startAuthPolling = useCallback(() => {
		if (authPollRef.current) clearInterval(authPollRef.current);
		setAuthStatus('waiting');

		authPollRef.current = setInterval(async () => {
			try {
				const res = await fetch('/auth/spotify/status');
				const data = await res.json();

				if (data.authenticated && data.accessToken) {
					clearInterval(authPollRef.current);
					localStorage.setItem('sp_token', data.accessToken);
					localStorage.setItem('sp_refresh_token', data.refreshToken || '');
					setToken(data.accessToken);
					setAuthStatus('done');
					setAuthError('');
					log('Spotify: authenticated ✓');
				}
			} catch (e) {
				clearInterval(authPollRef.current);
				setAuthStatus('error');
				setAuthError(`Auth poll failed: ${e.message}`);
			}
		}, 2000);

		setTimeout(
			() => {
				if (authPollRef.current) {
					clearInterval(authPollRef.current);
					setAuthStatus((s) => (s === 'waiting' ? 'idle' : s));
				}
			},
			5 * 60 * 1000,
		);
	}, [log]);

	const authorize = useCallback(
		async (id) => {
			const cid = id || clientId;
			if (!cid) return;
			localStorage.setItem('sp_client_id', cid);
			setClientIdState(cid);
			setAuthError('');

			try {
				const res = await fetch(`/auth/spotify/start?clientId=${encodeURIComponent(cid)}`);
				const rawText = await res.text();

				log(`Spotify: /auth/start → HTTP ${res.status}: ${rawText.slice(0, 150)}`);

				if (!res.ok) {
					throw new Error(`Server returned HTTP ${res.status} — is nginx proxying /auth/ to Express with auth_basic off?`);
				}

				let data;
				try {
					data = JSON.parse(rawText);
				} catch {
					throw new Error(`Not JSON: ${rawText.slice(0, 100)}`);
				}

				if (!data.url) throw new Error(data.error || 'No URL returned from server');

				window.open(data.url, '_blank', 'noopener');
				log('Spotify: auth page opened — complete login on the PC browser tab');
				startAuthPolling();
			} catch (e) {
				setAuthError(e.message);
				log(`Spotify: failed to start auth — ${e.message}`);
			}
		},
		[clientId, startAuthPolling, log],
	);

	const setClientId = useCallback((id) => {
		setClientIdState(id);
		localStorage.setItem('sp_client_id', id);
	}, []);

	const logout = useCallback(async () => {
		clearInterval(pollRef.current);
		clearInterval(fadeRef.current);
		clearInterval(authPollRef.current);
		await fetch('/auth/spotify/logout', { method: 'POST' }).catch(() => {});
		setToken('');
		setTrack(null);
		setPlaying(false);
		setFading(null);
		setAuthStatus('idle');
		localStorage.removeItem('sp_token');
		localStorage.removeItem('sp_refresh_token');
		log('Spotify: logged out');
	}, [log]);

	const doRefresh = useCallback(async () => {
		const rt = localStorage.getItem('sp_refresh_token');
		const cid = localStorage.getItem('sp_client_id');
		if (!rt || !cid) return null;
		try {
			const res = await fetch('/auth/spotify/refresh', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refreshToken: rt, clientId: cid }),
			});
			const data = await res.json();
			if (data.access_token) {
				localStorage.setItem('sp_token', data.access_token);
				if (data.refresh_token) localStorage.setItem('sp_refresh_token', data.refresh_token);
				setToken(data.access_token);
				log('Spotify: token refreshed');
				return data.access_token;
			}
		} catch (e) {
			log(`Spotify refresh failed: ${e.message}`);
		}
		return null;
	}, [log]);

	const api = useCallback(
		async (method, path, body, _retry = true) => {
			const t = localStorage.getItem('sp_token');
			if (!t) return null;
			try {
				const res = await fetch(`https://api.spotify.com/v1${path}`, {
					method,
					headers: {
						Authorization: `Bearer ${t}`,
						'Content-Type': 'application/json',
					},
					body: body ? JSON.stringify(body) : undefined,
				});
				if (res.status === 401 && _retry) {
					const fresh = await doRefresh();
					if (fresh) return api(method, path, body, false);
					setToken('');
					localStorage.removeItem('sp_token');
					log('Spotify: session expired — re-authenticate in Settings');
					return null;
				}
				if (res.status === 204 || res.status === 202) return {};
				if (res.ok) return res.json();
			} catch {}
			return null;
		},
		[doRefresh, log],
	);

	const fetchState = useCallback(async () => {
		const data = await api('GET', '/me/player');
		if (!data || typeof data !== 'object') return;
		setPlaying(!!data.is_playing);
		if (data.device?.volume_percent != null) setVolumeState(data.device.volume_percent);
		if (data.item) {
			setTrack({
				title: data.item.name,
				artist: data.item.artists?.map((a) => a.name).join(', ') || '',
				art: data.item.album?.images?.[0]?.url || null,
				progress: data.progress_ms || 0,
				duration: data.item.duration_ms || 1,
			});
		}
	}, [api]);

	useEffect(() => {
		if (!token) {
			clearInterval(pollRef.current);
			return;
		}
		fetchState();
		pollRef.current = setInterval(fetchState, 3000);
		return () => clearInterval(pollRef.current);
	}, [token, fetchState]);

	const play = useCallback(async () => {
		await api('PUT', '/me/player/play');
		setPlaying(true);
		log('Spotify: play');
	}, [api, log]);
	const pause = useCallback(async () => {
		await api('PUT', '/me/player/pause');
		setPlaying(false);
		log('Spotify: pause');
	}, [api, log]);
	const next = useCallback(async () => {
		await api('POST', '/me/player/next');
		setTimeout(fetchState, 500);
		log('Spotify: next');
	}, [api, fetchState, log]);
	const prev = useCallback(async () => {
		await api('POST', '/me/player/previous');
		setTimeout(fetchState, 500);
		log('Spotify: prev');
	}, [api, fetchState, log]);

	const setVolume = useCallback(
		async (vol) => {
			setVolumeState(vol);
			volumeRef.current = vol;
			await api('PUT', `/me/player/volume?volume_percent=${Math.round(vol)}`);
		},
		[api],
	);

	useEffect(() => {
		volumeRef.current = volume;
	}, [volume]);

	const fadeIn = useCallback(async () => {
		if (fading) return;
		clearInterval(fadeRef.current);
		const target = volumeRef.current;
		let current = 0;
		await api('PUT', `/me/player/volume?volume_percent=0`);
		await api('PUT', '/me/player/play');
		setPlaying(true);
		setFading('in');
		log(`Spotify: fade in (${FADE_SECS}s)`);
		const step = Math.max(target / FADE_STEPS, 1);
		const ms = (FADE_SECS * 1000) / FADE_STEPS;
		fadeRef.current = setInterval(async () => {
			current = Math.min(current + step, target);
			await api('PUT', `/me/player/volume?volume_percent=${Math.round(current)}`);
			if (current >= target) {
				clearInterval(fadeRef.current);
				fadeRef.current = null;
				setFading(null);
			}
		}, ms);
	}, [api, fading, log]);

	const fadeOut = useCallback(async () => {
		if (fading) return;
		clearInterval(fadeRef.current);
		const startVol = volumeRef.current;
		let current = startVol;
		setFading('out');
		log(`Spotify: fade out (${FADE_SECS}s)`);
		const step = Math.max(startVol / FADE_STEPS, 1);
		const ms = (FADE_SECS * 1000) / FADE_STEPS;
		fadeRef.current = setInterval(async () => {
			current = Math.max(current - step, 0);
			await api('PUT', `/me/player/volume?volume_percent=${Math.round(current)}`);
			if (current <= 0) {
				clearInterval(fadeRef.current);
				fadeRef.current = null;
				await api('PUT', '/me/player/pause');
				setPlaying(false);
				setFading(null);
				await api('PUT', `/me/player/volume?volume_percent=${Math.round(startVol)}`);
				volumeRef.current = startVol;
				setVolumeState(startVol);
			}
		}, ms);
	}, [api, fading, log]);

	return (
		<SpotifyContext.Provider
			value={{
				token,
				clientId,
				authError,
				authStatus,
				playing,
				volume,
				track,
				fading,
				setClientId,
				authorize,
				logout,
				play,
				pause,
				next,
				prev,
				setVolume,
				fadeIn,
				fadeOut,
			}}
		>
			{children}
		</SpotifyContext.Provider>
	);
}

export const useSpotify = () => useContext(SpotifyContext);
