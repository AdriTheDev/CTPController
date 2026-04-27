import { useRef } from 'react';
import { useSpotify } from '../context/SpotifyContext';
import { useLocalMusic } from '../context/LocalMusicContext';
import { useNavigate } from 'react-router-dom';
import styles from './MusicPage.module.css';

function fmtMs(ms) {
	const s = Math.floor((ms || 0) / 1000);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function MusicPage() {
	return (
		<div className={styles.page}>
			<RunwaySpotify />
			<ControllerMusic />
		</div>
	);
}

function RunwaySpotify() {
	const { token, playing, volume, track, fading, play, pause, next, prev, setVolume, fadeIn, fadeOut } = useSpotify();
	const navigate = useNavigate();
	const progressPct = track ? Math.min(100, (track.progress / track.duration) * 100).toFixed(1) : 0;

	return (
		<div className="card">
			<div className="card-header">
				<span className="card-title">Spotify</span>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					{fading && (
						<span className={`badge ${fading === 'in' ? 'green' : 'amber'}`}>
							<span className="dot" />
							Fading {fading === 'in' ? 'In' : 'Out'}…
						</span>
					)}
					<span className={`badge ${playing ? 'green' : ''}`}>
						<span className="dot" />
						{playing ? 'Playing' : 'Paused'}
					</span>
				</div>
			</div>
			<div className="card-body">
				{!token ? (
					<div className={styles.noAuth}>
						<p>
							Spotify not connected.{' '}
							<a onClick={() => navigate('/settings')} style={{ cursor: 'pointer' }}>
								Configure in Settings.
							</a>
						</p>
					</div>
				) : (
					<>
						<div className={styles.trackRow}>
							<div className={styles.art}>
								{track?.art ? (
									<img src={track.art} alt="" className={styles.artImg} />
								) : (
									<span className={styles.artPlaceholder}>♫</span>
								)}
							</div>
							<div className={styles.meta}>
								<div className={styles.trackTitle}>{track?.title || 'Nothing playing'}</div>
								<div className={styles.trackArtist}>{track?.artist || '—'}</div>
							</div>
						</div>
						<div className={styles.progressWrap}>
							<div className={styles.progressBar}>
								<div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
							</div>
							<div className={styles.times}>
								<span>{fmtMs(track?.progress)}</span>
								<span>{fmtMs(track?.duration)}</span>
							</div>
						</div>
						<div className={styles.controls}>
							<button className="btn" onClick={prev}>
								⏮ Prev
							</button>
							<button className={`btn ${playing ? 'primary' : ''}`} style={{ minWidth: 90 }} onClick={playing ? pause : play}>
								{playing ? '⏸  Pause' : '▶  Play'}
							</button>
							<button className="btn" onClick={next}>
								Next ⏭
							</button>
						</div>
						<div className="divider" />
						<div className={styles.fadeRow}>
							<button
								className={`btn ${fading === 'in' ? styles.fadingIn : ''}`}
								style={{ flex: 1 }}
								onClick={fadeIn}
								disabled={!!fading}
							>
								↑ Fade In
							</button>
							<button
								className={`btn ${fading === 'out' ? styles.fadingOut : ''}`}
								style={{ flex: 1 }}
								onClick={fadeOut}
								disabled={!!fading || !playing}
							>
								↓ Fade Out
							</button>
						</div>
						<div className="divider" />
						<div className={styles.volumeRow}>
							<span className={styles.volLabel}>Volume</span>
							<input
								type="range"
								min={0}
								max={100}
								value={volume}
								className={styles.slider}
								onChange={(e) => setVolume(Number(e.target.value))}
							/>
							<span className={`mono ${styles.volVal}`}>{volume}%</span>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function ControllerMusic() {
	const { playlist, currentTrack, currentIndex, playing, volume, fading, togglePlay, next, prev, fadeIn, fadeOut, setVolume, loadFiles } =
		useLocalMusic();
	const fileInputRef = useRef(null);

	return (
		<div className="card">
			<div className="card-header">
				<span className="card-title">Local Music</span>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					{fading && (
						<span className={`badge ${fading === 'in' ? 'green' : 'amber'}`}>
							<span className="dot" />
							Fading {fading === 'in' ? 'In' : 'Out'}…
						</span>
					)}
					<span className={`badge ${playing ? 'green' : ''}`}>
						<span className="dot" />
						{playing ? 'Playing' : 'Stopped'}
					</span>
					<button className="btn sm" onClick={() => fileInputRef.current?.click()}>
						Load Files
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="audio/*"
						multiple
						style={{ display: 'none' }}
						onChange={(e) => {
							if (e.target.files?.length) loadFiles(e.target.files);
						}}
					/>
				</div>
			</div>
			<div className="card-body">
				<div className={styles.trackRow}>
					<div className={styles.art}>
						<span className={`${styles.artPlaceholder} ${playing ? styles.notePlaying : ''}`}>♫</span>
					</div>
					<div className={styles.meta}>
						<div className={styles.trackTitle}>{currentTrack ? currentTrack.name : 'No track loaded'}</div>
						{playlist.length > 0 && (
							<div className={styles.trackArtist}>
								Track {currentIndex + 1} of {playlist.length}
							</div>
						)}
					</div>
				</div>

				<div className={styles.controls}>
					<button className="btn" onClick={prev} disabled={playlist.length < 2}>
						⏮ Prev
					</button>
					<button
						className={`btn ${playing ? 'primary' : ''}`}
						style={{ minWidth: 90 }}
						onClick={togglePlay}
						disabled={!currentTrack}
					>
						{playing ? '⏸  Pause' : '▶  Play'}
					</button>
					<button className="btn" onClick={next} disabled={playlist.length < 2}>
						Next ⏭
					</button>
				</div>

				<div className="divider" />

				<div className={styles.fadeRow}>
					<button
						className={`btn ${fading === 'in' ? styles.fadingIn : ''}`}
						style={{ flex: 1 }}
						onClick={fadeIn}
						disabled={!currentTrack || !!fading}
					>
						↑ Fade In
					</button>
					<button
						className={`btn ${fading === 'out' ? styles.fadingOut : ''}`}
						style={{ flex: 1 }}
						onClick={fadeOut}
						disabled={!playing || !!fading}
					>
						↓ Fade Out
					</button>
				</div>

				<div className="divider" />

				<div className={styles.volumeRow}>
					<span className={styles.volLabel}>Volume</span>
					<input
						type="range"
						min={0}
						max={100}
						value={volume}
						className={styles.slider}
						onChange={(e) => setVolume(Number(e.target.value))}
					/>
					<span className={`mono ${styles.volVal}`}>{volume}%</span>
				</div>

				{playlist.length > 0 && (
					<>
						<div className="divider" />
						<div style={{ maxHeight: 160, overflowY: 'auto' }}>
							{playlist.map((t, i) => (
								<div
									key={i}
									style={{
										padding: '6px 0',
										fontSize: 12,
										color: i === currentIndex ? 'var(--accent)' : 'var(--text-2)',
										borderBottom: '1px solid var(--border)',
										display: 'flex',
										gap: 8,
									}}
								>
									<span
										style={{
											color: 'var(--text-3)',
											fontFamily: 'var(--font-mono)',
											minWidth: 24,
										}}
									>
										{i + 1}
									</span>
									<span>{t.name}</span>
									{i === currentIndex && playing && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>▶</span>}
								</div>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
