import { useState, useEffect, useRef } from 'react';
import { useOBSStream, STREAM_CONTROLLER, STREAM_RUNWAY } from '../context/OBSContext';
import styles from './PreviewPage.module.css';

export default function PreviewPage() {
	const [activeStream, setActiveStream] = useState(STREAM_CONTROLLER);
	const { status, currentScene, previewScene, studioMode, getScreenshot, toggleStudioMode, transitionToProgram } =
		useOBSStream(activeStream);

	const [tab, setTab] = useState('preview');
	const [programImg, setProgramImg] = useState(null);
	const [previewImg, setPreviewImg] = useState(null);
	const [ytUrl, setYtUrl] = useState(() => localStorage.getItem('yt_chat_url') || '');
	const [ytInput, setYtInput] = useState(ytUrl);
	const connected = status === 'connected';
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
		}

		refresh();
		intervalRef.current = setInterval(refresh, 2000);
		return () => clearInterval(intervalRef.current);
	}, [connected, tab, studioMode, getScreenshot]);

	function saveYtUrl() {
		localStorage.setItem('yt_chat_url', ytInput);
		setYtUrl(ytInput);
		fetch('/api/config', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ youtube: { chatUrl: ytInput } }),
		}).catch(() => {});
	}

	function toChatUrl(url) {
		if (!url) return '';
		if (url.includes('youtube.com/live_chat')) return url;
		const match = url.match(/(?:v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/);
		if (match) {
			return `https://www.youtube.com/live_chat?v=${match[1]}&embed_domain=${window.location.hostname}`;
		}
		return url;
	}

	return (
		<div className={styles.page}>
			<div className={styles.tabs}>
				<button className={`btn sm ${tab === 'preview' ? 'active' : ''}`} onClick={() => setTab('preview')}>
					Preview
				</button>
				<button className={`btn sm ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>
					YouTube Chat
				</button>
			</div>

			{tab === 'preview' && (
				<div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
					<button
						className={`btn sm ${activeStream === STREAM_CONTROLLER ? 'active' : ''}`}
						onClick={() => setActiveStream(STREAM_CONTROLLER)}
					>
						Controller
					</button>
					<button
						className={`btn sm ${activeStream === STREAM_RUNWAY ? 'active' : ''}`}
						onClick={() => setActiveStream(STREAM_RUNWAY)}
					>
						Runway
					</button>
				</div>
			)}
			{tab === 'preview' && (
				<div className={styles.previewTab}>
					{!connected ? (
						<div className={styles.empty}>Connect to OBS in Settings to see a preview.</div>
					) : (
						<>
							<div className={styles.screens}>
								{/* Program output */}
								<div className={styles.screenWrap}>
									<div className={styles.screenLabel}>
										<span className="badge red">
											<span className="dot" />
											PROGRAM
										</span>
										<span className={styles.sceneName}>{currentScene}</span>
									</div>
									<div className={styles.screen}>
										{programImg ? (
											<img src={programImg} alt="Program output" className={styles.screenImg} />
										) : (
											<div className={styles.screenPlaceholder}>Loading…</div>
										)}
									</div>
								</div>

								{studioMode && (
									<div className={styles.screenWrap}>
										<div className={styles.screenLabel}>
											<span className="badge amber">
												<span className="dot" />
												PREVIEW
											</span>
											<span className={styles.sceneName}>{previewScene || '—'}</span>
										</div>
										<div className={styles.screen}>
											{previewImg ? (
												<img src={previewImg} alt="Preview output" className={styles.screenImg} />
											) : (
												<div className={styles.screenPlaceholder}>
													{previewScene ? 'Loading…' : 'No preview scene'}
												</div>
											)}
										</div>
									</div>
								)}
							</div>

							<div className={styles.controls}>
								<button className={`btn sm ${studioMode ? 'active' : ''}`} onClick={toggleStudioMode}>
									{studioMode ? '⬡ Studio On' : '⬡ Studio Off'}
								</button>
								{studioMode && (
									<button className="btn sm primary" onClick={transitionToProgram} disabled={!previewScene}>
										▶ Transition to Program
									</button>
								)}
								<span className={styles.refreshNote}>Preview refreshes every 2s via OBS screenshot API.</span>
							</div>
						</>
					)}
				</div>
			)}

			{tab === 'chat' && (
				<div className={styles.chatTab}>
					<div className={styles.chatConfig}>
						<input
							className="input"
							value={ytInput}
							onChange={(e) => setYtInput(e.target.value)}
							placeholder="YouTube video URL or live chat embed URL"
							style={{ flex: 1 }}
						/>
						<button className="btn sm primary" onClick={saveYtUrl}>
							Save
						</button>
					</div>
					{ytUrl ? (
						<iframe className={styles.chatFrame} src={toChatUrl(ytUrl)} title="YouTube Live Chat" allow="autoplay" />
					) : (
						<div className={styles.empty}>Paste your YouTube stream URL above and click Save.</div>
					)}
				</div>
			)}
		</div>
	);
}
