import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useLog } from './LogContext';

const TrackAudioContext = createContext(null);

// Callsigns are matched by suffix: _CTR > _APP > _TWR > _GND > _DEL > rest
const POSITION_ORDER = ['CTR', 'APP', 'TWR', 'GND', 'DEL'];

function positionRank(callsign = '') {
	const upper = callsign.toUpperCase();
	const idx = POSITION_ORDER.findIndex((p) => upper.endsWith(`_${p}`) || upper.includes(`_${p}_`));
	return idx === -1 ? POSITION_ORDER.length : idx;
}

function sortedStations(map) {
	return Object.values(map).sort((a, b) => {
		const rankDiff = positionRank(a.callsign) - positionRank(b.callsign);
		if (rankDiff !== 0) return rankDiff;
		return a.frequency - b.frequency;
	});
}

export function TrackAudioProvider({ children }) {
	const { log } = useLog();

	const wsRef = useRef(null);
	const retryRef = useRef(null);
	const stoppedRef = useRef(false);
	const stationsRef = useRef({}); // key: `${callsign}:${frequency}`
	const logRef = useRef(log);
	useEffect(() => {
		logRef.current = log;
	}, [log]);

	const [status, setStatus] = useState('disconnected');
	const [errorMsg, setErrorMsg] = useState('');
	const [stations, setStations] = useState([]);
	const [config, setConfig] = useState({ host: 'localhost', port: '49080' });

	const flush = () => setStations(sortedStations(stationsRef.current));
	const stationKey = (callsign, frequency) => `${callsign}:${frequency}`;

	const onMessage = useRef((raw) => {
		let msg;
		try {
			msg = JSON.parse(raw);
		} catch {
			console.error('Failed to parse WS message:', raw);
			return;
		}
		const { type, value: v } = msg;

		switch (type) {
			case 'kStationStates': {
				const next = {};
				(v?.stations || []).forEach((item) => {
					const s = item.value || item;
					if (!s?.callsign) return;
					if (s.isAvailable === false) return;
					const key = stationKey(s.callsign, s.frequency);
					next[key] = {
						key,
						callsign: s.callsign,
						frequency: s.frequency,
						rx: s.rx ?? false,
						muted: s.isOutputMuted ?? false,
						rxActive: stationsRef.current[key]?.rxActive ?? null, // preserve live rx
					};
				});
				stationsRef.current = next;
				flush();
				break;
			}

			case 'kStationStateUpdate': {
				if (!v?.callsign) {
					console.warn('kStationStateUpdate missing callsign:', v);
					return;
				}
				const key = stationKey(v.callsign, v.frequency);

				if (v.isAvailable === false) {
					if (stationsRef.current[key]) {
						delete stationsRef.current[key];
						logRef.current(`TrackAudio: removed ${v.callsign}`);
						flush();
					} else {
						console.warn(`Station to remove not found: ${v.callsign} (key: ${key})`);
					}
				} else {
					const prev = stationsRef.current[key];
					Object.keys(stationsRef.current).forEach((k) => {
						if (stationsRef.current[k].callsign === v.callsign && k !== key) {
							delete stationsRef.current[k];
						}
					});

					stationsRef.current[key] = {
						key,
						callsign: v.callsign,
						frequency: v.frequency,
						rx: v.rx ?? prev?.rx ?? false,
						muted: v.isOutputMuted ?? prev?.muted ?? false,
						rxActive: prev?.rxActive ?? null,
					};
					flush();
				}
				break;
			}

			case 'kFrequencyRemoved': {
				const freq = v?.frequency;
				if (!freq) {
					console.warn('kFrequencyRemoved missing frequency:', v);
					return;
				}
				const keysToRemove = Object.keys(stationsRef.current).filter((k) => stationsRef.current[k].frequency === freq);
				keysToRemove.forEach((key) => {
					const station = stationsRef.current[key];
					delete stationsRef.current[key];
					logRef.current(`TrackAudio: removed ${station.callsign}`);
				});
				if (keysToRemove.length > 0) {
					flush();
				} else {
					console.warn(`No station found with frequency: ${freq}`);
				}
				break;
			}

			case 'kRxBegin': {
				const freq = v?.pFrequencyHz;
				const cs = v?.callsign;
				if (!freq) {
					console.warn('kRxBegin missing frequency');
					return;
				}
				Object.keys(stationsRef.current).forEach((k) => {
					if (stationsRef.current[k].frequency === freq) {
						stationsRef.current[k] = {
							...stationsRef.current[k],
							rxActive: cs || '???',
						};
					}
				});
				flush();
				break;
			}

			case 'kRxEnd': {
				const freq = v?.pFrequencyHz;
				if (!freq) {
					console.warn('kRxEnd missing frequency');
					return;
				}
				Object.keys(stationsRef.current).forEach((k) => {
					if (stationsRef.current[k].frequency === freq) {
						stationsRef.current[k] = {
							...stationsRef.current[k],
							rxActive: null,
						};
					}
				});
				flush();
				break;
			}

			case 'kVoiceConnectedState': {
				if (v?.connected) {
					wsRef.current?.readyState === WebSocket.OPEN && wsRef.current.send(JSON.stringify({ type: 'kGetStationStates' }));
				} else {
					stationsRef.current = {};
					flush();
				}
				break;
			}

			default:
				break;
		}
	});

	const doConnect = useRef((h, p) => {
		if (retryRef.current) {
			clearTimeout(retryRef.current);
			retryRef.current = null;
		}

		const old = wsRef.current;
		if (old) {
			old.onopen = null;
			old.onmessage = null;
			old.onerror = null;
			old.onclose = null;
			try {
				old.close();
			} catch {}
			wsRef.current = null;
		}

		setStatus('connecting');
		setErrorMsg('');

		let ws;
		try {
			let wsUrl = `ws://${h}:${p}/ws`;
			ws = new WebSocket(wsUrl);
		} catch (e) {
			setStatus('error');
			setErrorMsg(`Invalid address: ws://${h}:${p}/ws`);
			logRef.current(`TrackAudio error: ${e.message}`);
			return;
		}
		wsRef.current = ws;

		ws.onopen = () => {
			if (wsRef.current !== ws) return;
			setStatus('connected');
			setErrorMsg('');
			logRef.current(`TrackAudio connected → ws://${h}:${p}/ws`);
			ws.send(JSON.stringify({ type: 'kGetStationStates' }));
		};

		ws.onmessage = (evt) => {
			if (wsRef.current !== ws) return;
			onMessage.current(evt.data);
		};

		ws.onerror = () => {
			if (wsRef.current !== ws) return;
			setErrorMsg(`Could not reach ws://${h}:${p}/ws — check TrackAudio is running.`);
		};

		ws.onclose = () => {
			if (wsRef.current !== ws) return;
			wsRef.current = null;
			stationsRef.current = {};
			flush();
			setStatus('disconnected');
			if (stoppedRef.current) return;
			logRef.current('TrackAudio disconnected — retrying in 5s');
			retryRef.current = setTimeout(() => {
				if (!stoppedRef.current) doConnect.current(h, p);
			}, 5000);
		};
	});

	useEffect(() => {
		stoppedRef.current = false;
		fetch('/api/config')
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json();
			})
			.then((cfg) => {
				const host = cfg.trackaudio?.host || 'localhost';
				const port = cfg.trackaudio?.port || '49080';
				setConfig({ host, port });
				doConnect.current(host, port);
			})
			.catch((e) => {
				logRef.current(`Config load error: ${e.message} — check nginx proxies /api/ with auth_basic off`);
				doConnect.current('localhost', '49080');
			});
		return () => {
			stoppedRef.current = true;
			if (retryRef.current) clearTimeout(retryRef.current);
			const ws = wsRef.current;
			if (ws) {
				ws.onopen = null;
				ws.onmessage = null;
				ws.onerror = null;
				ws.onclose = null;
				try {
					ws.close();
				} catch {}
				wsRef.current = null;
			}
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const connect = useCallback(
		({ host, port } = {}) => {
			const h = host ?? config.host;
			const p = port ?? config.port;
			setConfig({ host: h, port: p });
			stoppedRef.current = false;
			doConnect.current(h, p);
			fetch('/api/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ trackaudio: { host: h, port: p } }),
			}).catch(() => {});
		},
		[config],
	);

	const disconnect = useCallback(() => {
		stoppedRef.current = true;
		if (retryRef.current) {
			clearTimeout(retryRef.current);
			retryRef.current = null;
		}
		const ws = wsRef.current;
		if (ws) {
			ws.onopen = null;
			ws.onmessage = null;
			ws.onerror = null;
			ws.onclose = null;
			try {
				ws.close();
			} catch {}
			wsRef.current = null;
		}
		stationsRef.current = {};
		setStations([]);
		setStatus('disconnected');
		setErrorMsg('');
		log('TrackAudio disconnected');
	}, [log]);

	const setRx = useCallback(
		(key, rx) => {
			const s = stationsRef.current[key];
			if (!s) return;
			stationsRef.current[key] = { ...s, rx };
			wsRef.current?.readyState === WebSocket.OPEN &&
				wsRef.current.send(
					JSON.stringify({
						type: 'kSetStationState',
						value: { frequency: s.frequency, rx },
					}),
				);
			log(`${s.callsign}: RX ${rx ? 'enabled' : 'disabled'}`);
			flush();
		},
		[log],
	);

	const muteStation = useCallback(
		(key, muted) => {
			const s = stationsRef.current[key];
			if (!s) return;
			stationsRef.current[key] = { ...s, muted };
			wsRef.current?.readyState === WebSocket.OPEN &&
				wsRef.current.send(
					JSON.stringify({
						type: 'kSetStationState',
						value: { frequency: s.frequency, isOutputMuted: 'toggle' },
					}),
				);
			log(`${s.callsign}: ${muted ? 'muted' : 'unmuted'}`);
			flush();
		},
		[log],
	);

	const muteAll = useCallback(
		(muted) => {
			Object.values(stationsRef.current).forEach((s) => {
				stationsRef.current[s.key] = { ...s, muted };
				wsRef.current?.readyState === WebSocket.OPEN &&
					wsRef.current.send(
						JSON.stringify({
							type: 'kSetStationState',
							value: { frequency: s.frequency, isOutputMuted: muted },
						}),
					);
			});
			log(`All stations: ${muted ? 'muted' : 'unmuted'}`);
			flush();
		},
		[log],
	);

	const refresh = useCallback(() => {
		if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'kGetStationStates' }));
	}, []);

	return (
		<TrackAudioContext.Provider
			value={{
				status,
				errorMsg,
				stations,
				config,
				connect,
				disconnect,
				setRx,
				muteStation,
				muteAll,
				refresh,
			}}
		>
			{children}
		</TrackAudioContext.Provider>
	);
}

export const useTrackAudio = () => useContext(TrackAudioContext);
