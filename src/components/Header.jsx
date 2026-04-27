import { useState, useEffect } from 'react';
import { useOBS, STREAM_CONTROLLER, STREAM_RUNWAY } from '../context/OBSContext';
import { useSpotify } from '../context/SpotifyContext';
import { useLocalMusic } from '../context/LocalMusicContext';
import { useTrackAudio } from '../context/TrackAudioContext';
import { useNavigate } from 'react-router-dom';
import styles from './Header.module.css';

const STATUS_LABEL = {
	connected: 'Connected',
	connecting: 'Connecting…',
	disconnected: 'Offline',
	error: 'Error',
};
const STATUS_CLASS = {
	connected: 'green',
	connecting: 'amber',
	disconnected: '',
	error: 'red',
};

export default function Header() {
	const { connections } = useOBS();
	const sp = useSpotify();
	const lm = useLocalMusic();
	const ta = useTrackAudio();
	const navigate = useNavigate();

	const ctl = connections[STREAM_CONTROLLER];
	const rwy = connections[STREAM_RUNWAY];

	return (
		<header className={styles.header}>
			<div className={styles.left}>
				<span className={styles.title}>CTP Stream Controller</span>
				<span className={styles.subtitle}>Cross The Pond · VATSIM UK</span>
			</div>

			<div className={styles.pills}>
				{ctl?.streamActive && (
					<span className={`badge red ${styles.live}`}>
						<span className={`dot ${styles.liveDot}`} />
						LIVE
					</span>
				)}

				{/* Controller OBS */}
				<button
					className={`badge ${STATUS_CLASS[ctl?.status || 'disconnected']} ${styles.pill}`}
					onClick={() => navigate('/')}
					title="Controller OBS"
				>
					<span className="dot" />
					CTL · {ctl?.status === 'connected' ? ctl.currentScene || 'Connected' : STATUS_LABEL[ctl?.status || 'disconnected']}
				</button>

				{/* Runway OBS */}
				<button
					className={`badge ${STATUS_CLASS[rwy?.status || 'disconnected']} ${styles.pill}`}
					onClick={() => navigate('/runway')}
					title="Runway OBS"
				>
					<span className="dot" />
					RWY · {rwy?.status === 'connected' ? rwy.currentScene || 'Connected' : STATUS_LABEL[rwy?.status || 'disconnected']}
				</button>

				{/* Spotify (Runway music) */}
				<button
					className={`badge ${sp.token ? (sp.playing ? 'green' : 'blue') : ''} ${styles.pill}`}
					onClick={() => navigate('/music')}
					title="Spotify — Runway stream"
				>
					<span className="dot" />
					{sp.token ? (sp.playing ? `♫ ${sp.track?.title || 'Playing'}` : 'Spotify · Paused') : 'Spotify · Setup'}
				</button>

				{/* Local music (Controller music) */}
				{lm.playing && (
					<button
						className={`badge green ${styles.pill}`}
						onClick={() => navigate('/music')}
						title="Local music — Controller stream"
					>
						<span className="dot" />♪ {lm.currentTrack?.name || 'Playing'}
					</button>
				)}

				{/* TrackAudio */}
				<button
					className={`badge ${STATUS_CLASS[ta.status] || ''} ${styles.pill}`}
					onClick={() => navigate('/frequencies')}
					title="TrackAudio"
				>
					<span className="dot" />
					TA · {STATUS_LABEL[ta.status]}
				</button>
			</div>
		</header>
	);
}
