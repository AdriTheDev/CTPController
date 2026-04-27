import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import OBSWebSocket from 'obs-websocket-js';
import { useLog } from './LogContext';

const OBSContext = createContext(null);

export const LIVE_SCENES = ['Main', 'ES + Overlay', 'Runway'];
export const HOLDING_SCENES = ['Starting Soon', 'BRB', 'Ending'];

export const STREAM_CONTROLLER = 'controller';
export const STREAM_RUNWAY = 'runway';

function makeConnection() {
	return {
		obs: null,
		status: 'disconnected', // disconnected | connecting | connected | error
		errorMsg: '',
		currentScene: '',
		previewScene: '',
		scenes: [],
		sourceStates: {},
		streamActive: false,
		studioMode: false,
		config: { host: 'localhost', port: '4455', password: '' },
	};
}

export function OBSProvider({ children }) {
	const { log } = useLog();

	const connRef = useRef({
		[STREAM_CONTROLLER]: makeConnection(),
		[STREAM_RUNWAY]: makeConnection(),
	});

	const [connections, setConnections] = useState({
		[STREAM_CONTROLLER]: makeConnection(),
		[STREAM_RUNWAY]: makeConnection(),
	});

	const sceneCallbacks = useRef({
		[STREAM_CONTROLLER]: [],
		[STREAM_RUNWAY]: [],
	});

	function flush(streamId) {
		const c = connRef.current[streamId];
		setConnections((prev) => ({
			...prev,
			[streamId]: {
				obs: c.obs,
				status: c.status,
				errorMsg: c.errorMsg,
				currentScene: c.currentScene,
				previewScene: c.previewScene,
				scenes: [...c.scenes],
				sourceStates: { ...c.sourceStates },
				streamActive: c.streamActive,
				studioMode: c.studioMode,
				config: { ...c.config },
			},
		}));
	}

	const connect = useCallback(
		async (streamId, { host, port, password } = {}) => {
			const c = connRef.current[streamId];
			if (c.obs) {
				try {
					c.obs.disconnect();
				} catch {}
			}

			const obs = new OBSWebSocket();
			c.obs = obs;
			c.status = 'connecting';
			c.errorMsg = '';
			flush(streamId);

			try {
				await obs.connect(`ws://${host}:${port}`, password);
				c.status = 'connected';
				c.config = { host, port, password: password || '' };
				log(`OBS [${streamId}] connected → ${host}:${port}`);

				const configKey = streamId === STREAM_RUNWAY ? 'obs_runway' : 'obs';
				await fetch('/api/config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						[configKey]: { host, port, password: password || '' },
					}),
				}).catch(() => {});

				const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene');
				c.currentScene = currentProgramSceneName;

				const { scenes: sl } = await obs.call('GetSceneList');
				c.scenes = sl.map((s) => s.sceneName).reverse();

				const { outputActive } = await obs.call('GetStreamStatus');
				c.streamActive = outputActive;

				try {
					const { studioModeEnabled } = await obs.call('GetStudioModeEnabled');
					c.studioMode = studioModeEnabled;
					if (studioModeEnabled) {
						const { currentPreviewSceneName } = await obs.call('GetCurrentPreviewScene');
						c.previewScene = currentPreviewSceneName || '';
					}
				} catch {}

				flush(streamId);

				obs.on('CurrentProgramSceneChanged', ({ sceneName }) => {
					c.currentScene = sceneName;
					log(`OBS [${streamId}] scene → ${sceneName}`);
					sceneCallbacks.current[streamId]?.forEach((cb) => cb(sceneName));
					flush(streamId);
				});
				obs.on('CurrentPreviewSceneChanged', ({ sceneName }) => {
					c.previewScene = sceneName;
					flush(streamId);
				});
				obs.on('StudioModeStateChanged', ({ studioModeEnabled }) => {
					c.studioMode = studioModeEnabled;
					if (!studioModeEnabled) c.previewScene = '';
					flush(streamId);
				});
				obs.on('SceneItemEnableStateChanged', ({ sourceName, sceneItemEnabled }) => {
					c.sourceStates[sourceName] = sceneItemEnabled;
					flush(streamId);
				});
				obs.on('StreamStateChanged', ({ outputActive }) => {
					c.streamActive = outputActive;
					flush(streamId);
				});
				obs.on('ConnectionClosed', () => {
					c.status = 'disconnected';
					log(`OBS [${streamId}] connection closed`);
					flush(streamId);
				});
			} catch (e) {
				c.status = 'error';
				c.errorMsg = e.message || 'Connection failed';
				log(`OBS [${streamId}] error: ${e.message}`);
				flush(streamId);
				throw e;
			}
		},
		[log],
	);

	useEffect(() => {
		fetch('/api/config')
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json();
			})
			.then((cfg) => {
				const ctl = cfg.obs || {};
				const rwy = cfg.obs_runway || {};
				if (ctl.host && ctl.port) {
					connRef.current[STREAM_CONTROLLER].config = ctl;
					connect(STREAM_CONTROLLER, ctl).catch(() => {});
				}
				if (rwy.host && rwy.port) {
					connRef.current[STREAM_RUNWAY].config = rwy;
					connect(STREAM_RUNWAY, rwy).catch(() => {});
				}
			})
			.catch((e) => log(`OBS config load error: ${e.message}`));
	}, []); // eslint-disable-line

	const disconnect = useCallback(
		(streamId) => {
			const c = connRef.current[streamId];
			if (c.obs) {
				try {
					c.obs.disconnect();
				} catch {}
				c.obs = null;
			}
			c.status = 'disconnected';
			c.currentScene = '';
			c.scenes = [];
			log(`OBS [${streamId}] disconnected`);
			flush(streamId);
		},
		[log],
	);

	const setScene = useCallback(
		async (streamId, sceneName) => {
			const c = connRef.current[streamId];
			if (!c.obs || c.status !== 'connected') return;
			try {
				await c.obs.call('SetCurrentProgramScene', { sceneName });
			} catch (e) {
				log(`[${streamId}] scene error: ${e.message}`);
			}
		},
		[log],
	);

	const setPreviewScene = useCallback(
		async (streamId, sceneName) => {
			const c = connRef.current[streamId];
			if (!c.obs || c.status !== 'connected' || !c.studioMode) return;
			try {
				await c.obs.call('SetCurrentPreviewScene', { sceneName });
			} catch (e) {
				log(`[${streamId}] preview error: ${e.message}`);
			}
		},
		[log],
	);

	const transitionToProgram = useCallback(
		async (streamId) => {
			const c = connRef.current[streamId];
			if (!c.obs || c.status !== 'connected' || !c.studioMode) return;
			try {
				await c.obs.call('TriggerStudioModeTransition');
			} catch (e) {
				log(`[${streamId}] transition error: ${e.message}`);
			}
		},
		[log],
	);

	const toggleStudioMode = useCallback(
		async (streamId) => {
			const c = connRef.current[streamId];
			if (!c.obs || c.status !== 'connected') return;
			try {
				await c.obs.call('SetStudioModeEnabled', {
					studioModeEnabled: !c.studioMode,
				});
			} catch (e) {
				log(`[${streamId}] studio mode error: ${e.message}`);
			}
		},
		[log],
	);

	const transitionOverlay = useCallback(
		async (streamId, targetSourceName, sceneName, allSourceNames) => {
			const c = connRef.current[streamId];
			if (!c.obs || c.status !== 'connected') return;
			try {
				const { sceneItems } = await c.obs.call('GetSceneItemList', {
					sceneName,
				});
				log(`[${streamId}] scene "${sceneName}" items: ${sceneItems.map((i) => i.sourceName).join(', ')}`);
				for (const item of sceneItems) {
					if (!allSourceNames.includes(item.sourceName)) continue;
					const shouldBeVisible = item.sourceName === targetSourceName;
					if (item.sceneItemEnabled === shouldBeVisible) continue;
					await c.obs.call('SetSceneItemEnabled', {
						sceneName,
						sceneItemId: item.sceneItemId,
						sceneItemEnabled: shouldBeVisible,
					});
					c.sourceStates[item.sourceName] = shouldBeVisible;
				}
				log(`[${streamId}] overlay → ${targetSourceName}`);
				flush(streamId);
			} catch (e) {
				log(`[${streamId}] overlay error: ${e.message}`);
			}
		},
		[log],
	);

	const hideAllOverlays = useCallback(
		async (streamId, sceneName, allSourceNames) => {
			const c = connRef.current[streamId];
			if (!c.obs || c.status !== 'connected') return;
			try {
				const { sceneItems } = await c.obs.call('GetSceneItemList', {
					sceneName,
				});
				for (const item of sceneItems) {
					if (!allSourceNames.includes(item.sourceName) || !item.sceneItemEnabled) continue;
					await c.obs.call('SetSceneItemEnabled', {
						sceneName,
						sceneItemId: item.sceneItemId,
						sceneItemEnabled: false,
					});
					c.sourceStates[item.sourceName] = false;
				}
				flush(streamId);
			} catch (e) {
				log(`[${streamId}] hide overlays error: ${e.message}`);
			}
		},
		[log],
	);

	const refreshScene = useCallback(async (streamId, sceneName) => {
		const c = connRef.current[streamId];
		if (!c.obs || c.status !== 'connected') return;
		try {
			const { sceneItems } = await c.obs.call('GetSceneItemList', {
				sceneName,
			});
			sceneItems.forEach((i) => {
				c.sourceStates[i.sourceName] = i.sceneItemEnabled;
			});
			flush(streamId);
		} catch {}
	}, []);

	const getScreenshot = useCallback(async (streamId, type = 'program') => {
		const c = connRef.current[streamId];
		if (!c.obs || c.status !== 'connected') return null;
		try {
			const sceneName = type === 'preview' ? c.previewScene : c.currentScene;
			if (!sceneName) return null;
			const { imageData } = await c.obs.call('GetSourceScreenshot', {
				sourceName: sceneName,
				imageFormat: 'jpeg',
				imageWidth: 640,
				imageHeight: 360,
				imageQuality: 70,
			});
			return imageData;
		} catch {
			return null;
		}
	}, []);

	const onSceneChange = useCallback((streamId, cb) => {
		sceneCallbacks.current[streamId] = sceneCallbacks.current[streamId] || [];
		sceneCallbacks.current[streamId].push(cb);
		return () => {
			sceneCallbacks.current[streamId] = sceneCallbacks.current[streamId].filter((c) => c !== cb);
		};
	}, []);

	return (
		<OBSContext.Provider
			value={{
				connections,
				connect,
				disconnect,
				setScene,
				setPreviewScene,
				transitionToProgram,
				toggleStudioMode,
				transitionOverlay,
				hideAllOverlays,
				refreshScene,
				getScreenshot,
				onSceneChange,
			}}
		>
			{children}
		</OBSContext.Provider>
	);
}

export const useOBS = () => useContext(OBSContext);

export function useOBSStream(streamId) {
	const ctx = useOBS();
	const conn = ctx.connections[streamId] || makeConnection();
	return {
		...conn,
		connect: (cfg) => ctx.connect(streamId, cfg),
		disconnect: () => ctx.disconnect(streamId),
		setScene: (sceneName) => ctx.setScene(streamId, sceneName),
		setPreviewScene: (sceneName) => ctx.setPreviewScene(streamId, sceneName),
		transitionToProgram: () => ctx.transitionToProgram(streamId),
		toggleStudioMode: () => ctx.toggleStudioMode(streamId),
		transitionOverlay: (t, s, all) => ctx.transitionOverlay(streamId, t, s, all),
		hideAllOverlays: (s, all) => ctx.hideAllOverlays(streamId, s, all),
		refreshScene: (s) => ctx.refreshScene(streamId, s),
		getScreenshot: (type) => ctx.getScreenshot(streamId, type),
		onSceneChange: (cb) => ctx.onSceneChange(streamId, cb),
	};
}
