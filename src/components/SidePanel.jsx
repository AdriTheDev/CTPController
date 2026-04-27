import { useState, useEffect, useRef } from 'react';
import { useOBSStream, STREAM_CONTROLLER, STREAM_RUNWAY } from '../context/OBSContext';
import styles from './SidePanel.module.css';

export default function SidePanel() {
	const { status, currentScene, previewScene, studioMode, getScreenshot } = useOBSStream(STREAM_CONTROLLER);
	const {
		status: runwayStatus,
		currentScene: runwayCurrentScene,
		previewScene: runwayPreviewScene,
		studioMode: runwayStudioMode,
		getScreenshot: runwayGetScreenshot,
	} = useOBSStream(STREAM_RUNWAY);

	const [tab, setTab] = useState('preview');
	const [programImg, setProgramImg] = useState(null);
	const [previewImg, setPreviewImg] = useState(null);
	const [runwayProgramImg, setRunwayProgramImg] = useState(null);
	const [runwayPreviewImg, setRunwayPreviewImg] = useState(null);
	const [ytUrl, setYtUrl] = useState(() => localStorage.getItem('yt_chat_url') || '');
	const connected = status === 'connected';
	const runwayConnected = runwayStatus === 'connected';
	const intervalRef = useRef(null);

	useEffect(() => {
		if (!connected || tab !== 'preview') {
			clearInterval(intervalRef.current);
			return;
		}

		async function refresh() {
			const prog = await getScreenshot('program');
			if (prog) setProgramImg(prog);
			if (studioMode) {
				const prev = await getScreenshot('preview');
				if (prev) setPreviewImg(prev);
			}

			if (runwayConnected) {
				const runwayProg = await runwayGetScreenshot('program');
				if (runwayProg) setRunwayProgramImg(runwayProg);
				if (runwayStudioMode) {
					const runwayPrev = await runwayGetScreenshot('preview');
					if (runwayPrev) setRunwayPreviewImg(runwayPrev);
				}
			}
		}

		refresh();
		intervalRef.current = setInterval(refresh, 2000);
		return () => clearInterval(intervalRef.current);
	}, [connected, runwayConnected, tab, studioMode, runwayStudioMode, getScreenshot, runwayGetScreenshot]);

	useEffect(() => {
		const stored = localStorage.getItem('yt_chat_url') || '';
		setYtUrl(stored);
	}, [tab]);

	function toChatUrl(url) {
		if (!url) return '';
		if (url.includes('youtube.com/live_chat')) return url;
		const match = url.match(/(?:v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/);
		if (match) return `https://www.youtube.com/live_chat?v=${match[1]}&embed_domain=${window.location.hostname}`;
		return url;
	}

	return (
		<aside className={styles.panel}>
			<div className={styles.tabs}>
				<button className={`${styles.tab} ${tab === 'preview' ? styles.tabActive : ''}`} onClick={() => setTab('preview')}>
					Preview
				</button>
				<button className={`${styles.tab} ${tab === 'chat' ? styles.tabActive : ''}`} onClick={() => setTab('chat')}>
					Chat
				</button>
			</div>

			{tab === 'preview' && (
				<div className={styles.previewContent}>
					{!connected && !runwayConnected ? (
						<div className={styles.empty}>OBS not connected</div>
					) : (
						<>
							{/* Controller Stream */}
							<h3 className={styles.streamHeader}>Controller Stream</h3>
							<div className={styles.screenWrap}>
								<div className={styles.screenMeta}>
									<span className={`badge red ${styles.badge}`}>
										<span className="dot" />
										PGM
									</span>
									<span className={styles.sceneName}>{currentScene}</span>
								</div>
								<div className={styles.screen}>
									{programImg ? (
										<img src={programImg} alt="Program" className={styles.screenImg} />
									) : (
										<div className={styles.screenEmpty}>{connected ? 'Loading…' : 'Controller OBS not connected'}</div>
									)}
								</div>
							</div>
							{studioMode && (
								<div className={styles.screenWrap}>
									<div className={styles.screenMeta}>
										<span className={`badge amber ${styles.badge}`}>
											<span className="dot" />
											PRV
										</span>
										<span className={styles.sceneName}>{previewScene || '—'}</span>
									</div>
									<div className={styles.screen}>
										{previewImg ? (
											<img src={previewImg} alt="Preview" className={styles.screenImg} />
										) : (
											<div className={styles.screenEmpty}>{previewScene ? 'Loading…' : '—'}</div>
										)}
									</div>
								</div>
							)}

							{/* Runway Stream */}
							<h3 className={styles.streamHeader}>Runway Stream</h3>
							<div className={styles.screenWrap}>
								<div className={styles.screenMeta}>
									<span className={`badge red ${styles.badge}`}>
										<span className="dot" />
										PGM
									</span>
									<span className={styles.sceneName}>{runwayCurrentScene}</span>
								</div>
								<div className={styles.screen}>
									{runwayProgramImg ? (
										<img src={runwayProgramImg} alt="Runway Program" className={styles.screenImg} />
									) : (
										<div className={styles.screenEmpty}>
											{runwayConnected ? 'Loading…' : 'Runway OBS not connected'}
										</div>
									)}
								</div>
							</div>
							{runwayStudioMode && (
								<div className={styles.screenWrap}>
									<div className={styles.screenMeta}>
										<span className={`badge amber ${styles.badge}`}>
											<span className="dot" />
											PRV
										</span>
										<span className={styles.sceneName}>{runwayPreviewScene || '—'}</span>
									</div>
									<div className={styles.screen}>
										{runwayPreviewImg ? (
											<img src={runwayPreviewImg} alt="Runway Preview" className={styles.screenImg} />
										) : (
											<div className={styles.screenEmpty}>{runwayPreviewScene ? 'Loading…' : '—'}</div>
										)}
									</div>
								</div>
							)}

							<p className={styles.refreshNote}>↻ 2s</p>
						</>
					)}
				</div>
			)}

			{tab === 'chat' && (
				<div className={styles.chatContent}>
					{ytUrl ? (
						<iframe className={styles.chatFrame} src={toChatUrl(ytUrl)} title="YouTube Live Chat" />
					) : (
						<div className={styles.empty}>Set your YouTube URL in the Preview page.</div>
					)}
				</div>
			)}
		</aside>
	);
}
