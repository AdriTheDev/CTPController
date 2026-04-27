import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useLog } from './LogContext';

const LocalMusicContext = createContext(null);

const FADE_SECS = 5;

export function LocalMusicProvider({ children }) {
	const { log } = useLog();

	const actxRef = useRef(null);
	const gainRef = useRef(null);
	const elemRef = useRef(null);
	const fadeRef = useRef(null);
	const volumeRef = useRef(80);

	const [playlist, setPlaylist] = useState([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [volume, setVolumeState] = useState(80);
	const [fading, setFading] = useState(null);

	function ensureContext() {
		if (!actxRef.current) {
			const actx = new (window.AudioContext || window.webkitAudioContext)();
			const gain = actx.createGain();
			gain.gain.value = volumeRef.current / 100;
			gain.connect(actx.destination);
			actxRef.current = actx;
			gainRef.current = gain;
		}
		if (actxRef.current.state === 'suspended') actxRef.current.resume();
		return { actx: actxRef.current, gain: gainRef.current };
	}

	function connectElement(el) {
		ensureContext();
		if (!el._mediaSource) {
			el._mediaSource = actxRef.current.createMediaElementSource(el);
			el._mediaSource.connect(gainRef.current);
		}
	}

	const playTrack = useCallback(
		(index, playlist_) => {
			const list = playlist_ || playlist;
			const track = list[index];
			if (!track) return;
			if (elemRef.current) {
				elemRef.current.pause();
				elemRef.current.onended = null;
			}

			const el = new Audio();
			el.src = track.url;
			el.preload = 'auto';
			elemRef.current = el;
			connectElement(el);

			el.play()
				.then(() => {
					setPlaying(true);
					setCurrentIndex(index);
					log(`Music: playing "${track.name}"`);
				})
				.catch((e) => log(`Music: play failed — ${e.message}`));

			el.onended = () => {
				const next = (index + 1) % list.length;
				if (list.length > 1) playTrack(next, list);
				else setPlaying(false);
			};
		},
		[playlist, log],
	);

	const play = useCallback(() => {
		ensureContext();
		if (elemRef.current && playlist.length > 0) {
			elemRef.current.play().catch(() => {});
			setPlaying(true);
		} else if (playlist.length > 0) {
			playTrack(currentIndex);
		}
	}, [playlist, currentIndex, playTrack]);

	const pause = useCallback(() => {
		elemRef.current?.pause();
		setPlaying(false);
	}, []);

	const togglePlay = useCallback(() => {
		if (playing) pause();
		else play();
	}, [playing, play, pause]);

	const next = useCallback(() => {
		if (!playlist.length) return;
		playTrack((currentIndex + 1) % playlist.length);
	}, [playlist, currentIndex, playTrack]);

	const prev = useCallback(() => {
		if (!playlist.length) return;
		playTrack((currentIndex - 1 + playlist.length) % playlist.length);
	}, [playlist, currentIndex, playTrack]);

	const setVolume = useCallback(
		(val) => {
			setVolumeState(val);
			volumeRef.current = val;
			if (gainRef.current && actxRef.current && !fading) {
				gainRef.current.gain.setValueAtTime(val / 100, actxRef.current.currentTime);
			}
		},
		[fading],
	);

	const fadeIn = useCallback(() => {
		clearInterval(fadeRef.current);
		const { actx, gain } = ensureContext();
		const target = volumeRef.current;
		let current = 0;

		gain.gain.cancelScheduledValues(actx.currentTime);
		gain.gain.setValueAtTime(0, actx.currentTime);

		if (elemRef.current && playlist.length > 0) {
			elemRef.current.play().catch(() => {});
			setPlaying(true);
		} else if (playlist.length > 0) {
			playTrack(currentIndex);
		}

		setFading('in');
		log(`Music: fade in (${FADE_SECS}s)`);

		const step = Math.max(target / 30, 1);
		const ms = (FADE_SECS * 1000) / 30;

		fadeRef.current = setInterval(() => {
			current = Math.min(current + step, target);
			if (gainRef.current && actxRef.current) {
				gainRef.current.gain.setValueAtTime(current / 100, actxRef.current.currentTime);
			}
			if (current >= target) {
				clearInterval(fadeRef.current);
				setFading(null);
			}
		}, ms);
	}, [playlist, currentIndex, playTrack, log]);

	const fadeOut = useCallback(() => {
		clearInterval(fadeRef.current);
		if (!gainRef.current || !actxRef.current) return;
		const startVol = volumeRef.current;
		let current = startVol;
		setFading('out');
		log(`Music: fade out (${FADE_SECS}s)`);

		const step = Math.max(startVol / 30, 1);
		const ms = (FADE_SECS * 1000) / 30;

		fadeRef.current = setInterval(() => {
			current = Math.max(current - step, 0);
			if (gainRef.current && actxRef.current) {
				gainRef.current.gain.setValueAtTime(current / 100, actxRef.current.currentTime);
			}
			if (current <= 0) {
				clearInterval(fadeRef.current);
				elemRef.current?.pause();
				setPlaying(false);
				setFading(null);
				if (gainRef.current && actxRef.current) {
					gainRef.current.gain.setValueAtTime(startVol / 100, actxRef.current.currentTime);
				}
			}
		}, ms);
	}, [log]);

	const loadFiles = useCallback(
		(files) => {
			const tracks = Array.from(files).map((file) => ({
				name: file.name.replace(/\.[^.]+$/, ''),
				url: URL.createObjectURL(file),
				file,
			}));
			setPlaylist(tracks);
			setCurrentIndex(0);
			setPlaying(false);
			if (elemRef.current) {
				elemRef.current.pause();
				elemRef.current = null;
			}
			log(`Music: loaded ${tracks.length} track${tracks.length !== 1 ? 's' : ''}`);
		},
		[log],
	);

	useEffect(
		() => () => {
			elemRef.current?.pause();
			actxRef.current?.close();
		},
		[],
	);

	return (
		<LocalMusicContext.Provider
			value={{
				playlist,
				currentTrack: playlist[currentIndex] || null,
				currentIndex,
				playing,
				volume,
				fading,
				play,
				pause,
				togglePlay,
				next,
				prev,
				fadeIn,
				fadeOut,
				setVolume,
				loadFiles,
			}}
		>
			{children}
		</LocalMusicContext.Provider>
	);
}

export const useLocalMusic = () => useContext(LocalMusicContext);
