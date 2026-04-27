import { useEffect, useRef } from 'react';
import { useOBS, LIVE_SCENES, HOLDING_SCENES, STREAM_CONTROLLER, STREAM_RUNWAY } from '../context/OBSContext';
import { useSpotify } from '../context/SpotifyContext';
import { useLocalMusic } from '../context/LocalMusicContext';

function isLive(sceneName) {
	return LIVE_SCENES.some((s) => sceneName?.toLowerCase().includes(s.toLowerCase()));
}
function isHolding(sceneName) {
	return HOLDING_SCENES.some((s) => sceneName?.toLowerCase().includes(s.toLowerCase()));
}

export function useSceneAutomation() {
	const { connections, onSceneChange } = useOBS();
	const spotify = useSpotify();
	const localMusic = useLocalMusic();

	const spPlayingRef = useRef(spotify.playing);
	const localPlayRef = useRef(localMusic.playing);
	useEffect(() => {
		spPlayingRef.current = spotify.playing;
	}, [spotify.playing]);
	useEffect(() => {
		localPlayRef.current = localMusic.playing;
	}, [localMusic.playing]);

	const spTokenRef = useRef(spotify.token);
	useEffect(() => {
		spTokenRef.current = spotify.token;
	}, [spotify.token]);

	const runwayStatus = connections[STREAM_RUNWAY]?.status;
	useEffect(() => {
		if (runwayStatus !== 'connected') return;
		const unsub = onSceneChange(STREAM_RUNWAY, (sceneName) => {
			if (!spTokenRef.current) return;
			if (isLive(sceneName) && spPlayingRef.current) {
			} else if (isHolding(sceneName)) {
				if (!spPlayingRef.current) spotify.fadeIn();
			}
		});
		return unsub;
	}, [runwayStatus, onSceneChange, spotify]);

	const ctlStatus = connections[STREAM_CONTROLLER]?.status;
	useEffect(() => {
		if (ctlStatus !== 'connected') return;
		const unsub = onSceneChange(STREAM_CONTROLLER, (sceneName) => {
			if (isLive(sceneName) && localPlayRef.current) {
				localMusic.fadeOut();
			} else if (isHolding(sceneName)) {
				localMusic.fadeIn();
			}
		});
		return unsub;
	}, [ctlStatus, onSceneChange, localMusic]);
}
