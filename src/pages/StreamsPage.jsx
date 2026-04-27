import { useEffect } from 'react';
import { useOBSStream, STREAM_CONTROLLER, STREAM_RUNWAY } from '../context/OBSContext';
import styles from './StreamsPage.module.css';

const OVERLAY_SOURCES = [
	{ key: 'EGGX_CTR', label: 'EGGX', description: 'Shanwick Radio', sourceName: 'EGGX_CTR', scene: 'ES + Overlay' },
	{ key: 'LON_C_CTR', label: 'AC Central', description: 'AC Central', sourceName: 'LON_C_CTR', scene: 'ES + Overlay' },
	{ key: 'EGLL_F_APP', label: 'LL FIN', description: 'Heathrow FIN', sourceName: 'EGLL_F_APP', scene: 'ES + Overlay' },
	{ key: 'EGLL_N_TWR', label: 'LL AIR N', description: 'Heathrow AIR North', sourceName: 'EGLL_N_TWR', scene: 'ES + Overlay' },
	{ key: 'EGLL_S_TWR', label: 'LL AIR S', description: 'Heathrow AIR South', sourceName: 'EGLL_S_TWR', scene: 'ES + Overlay' },
	{ key: 'EGLL_2_GND', label: 'LL GMC 2', description: 'Heathrow GMC 2', sourceName: 'EGLL_2_GND', scene: 'ES + Overlay' },
	{ key: 'EGLL_1_GND', label: 'LL GMC 1', description: 'Heathrow GMC 1', sourceName: 'EGLL_1_GND', scene: 'ES + Overlay' },
];

const QUICK_SCENES_CONTROLLER = [
	{ label: 'Starting Screen', sceneName: 'Starting Screen', isBrb: false },
	{ label: 'BRB', sceneName: 'Break', isBrb: true },
	{ label: 'Controller View', sceneName: 'ES + Overlay', isBrb: false },
	{ label: 'Ending', sceneName: 'Ending', isBrb: false },
];

const QUICK_SCENES_RUNWAY = [
	{ label: 'Starting Screen', sceneName: 'Starting Screen', isBrb: false },
	{ label: 'Main Screen', sceneName: 'Runway Cam', isBrb: false },
	{ label: 'BRB', sceneName: 'Break', isBrb: true },
	{ label: 'Ending', sceneName: 'Ending', isBrb: false },
];

export default function StreamsPage() {
	const controllerOBS = useOBSStream(STREAM_CONTROLLER);
	const runwayOBS = useOBSStream(STREAM_RUNWAY);

	const {
		status: controllerStatus,
		currentScene: controllerCurrentScene,
		previewScene: controllerPreviewScene,
		scenes: controllerScenes,
		sourceStates: controllerSourceStates,
		studioMode: controllerStudioMode,
		setScene: controllerSetScene,
		setPreviewScene: controllerSetPreviewScene,
		transitionToProgram: controllerTransitionToProgram,
		toggleStudioMode: controllerToggleStudioMode,
		transitionOverlay: controllerTransitionOverlay,
		hideAllOverlays: controllerHideAllOverlays,
		refreshScene: controllerRefreshScene,
	} = controllerOBS;

	const {
		status: runwayStatus,
		currentScene: runwayCurrentScene,
		previewScene: runwayPreviewScene,
		scenes: runwayScenes,
		studioMode: runwayStudioMode,
		setScene: runwaySetScene,
		setPreviewScene: runwaySetPreviewScene,
		transitionToProgram: runwayTransitionToProgram,
		toggleStudioMode: runwayToggleStudioMode,
		refreshScene: runwayRefreshScene,
	} = runwayOBS;

	const controllerConnected = controllerStatus === 'connected';
	const runwayConnected = runwayStatus === 'connected';

	useEffect(() => {
		if (controllerConnected) {
			const uniqueScenes = [...new Set(OVERLAY_SOURCES.map((s) => s.scene))];
			uniqueScenes.forEach((s) => controllerRefreshScene(s));
		}
	}, [controllerConnected, controllerRefreshScene]);

	const activeOverlay = OVERLAY_SOURCES.find((s) => controllerSourceStates[s.sourceName] === true);

	async function selectOverlay(src) {
		if (!controllerConnected) return;
		// Pass all source names so OBSContext knows which items are overlays
		const allNames = OVERLAY_SOURCES.filter((o) => o.scene === src.scene).map((o) => o.sourceName);

		const isActive = controllerSourceStates[src.sourceName] === true;
		if (isActive) {
			await controllerHideAllOverlays(src.scene, allNames);
		} else {
			await controllerTransitionOverlay(src.sourceName, src.scene, allNames);
		}
	}

	function handleSceneClickController(sceneName) {
		if (!controllerConnected) return;
		if (controllerStudioMode) controllerSetPreviewScene(sceneName);
		else controllerSetScene(sceneName);
	}

	function handleSceneClickRunway(sceneName) {
		if (!runwayConnected) return;
		if (runwayStudioMode) runwaySetPreviewScene(sceneName);
		else runwaySetScene(sceneName);
	}

	return (
		<div className={styles.page}>
			{/* Controller Stream */}
			<div className="card">
				<div className="card-header">
					<span className="card-title">Controller Stream — Scene</span>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						{controllerStudioMode && controllerPreviewScene && (
							<span className="badge amber">Preview: {controllerPreviewScene}</span>
						)}
						{controllerCurrentScene && <span className="badge blue mono">{controllerCurrentScene}</span>}
						<button
							className={`btn sm ${controllerStudioMode ? 'active' : ''}`}
							onClick={controllerToggleStudioMode}
							disabled={!controllerConnected}
							title="Toggle OBS Studio Mode"
						>
							{controllerStudioMode ? '⬡ Studio On' : '⬡ Studio Off'}
						</button>
					</div>
				</div>
				<div className="card-body">
					<div className={styles.quickScenes}>
						{QUICK_SCENES_CONTROLLER.map((s) => {
							const isProgram = controllerCurrentScene === s.sceneName;
							const isPreview = controllerStudioMode && controllerPreviewScene === s.sceneName;
							return (
								<button
									key={s.sceneName}
									className={`btn ${s.isBrb ? styles.brbBtn : ''} ${isProgram ? (s.isBrb ? styles.brbActive : 'active') : ''} ${isPreview ? styles.previewActive : ''}`}
									onClick={() => handleSceneClickController(s.sceneName)}
									disabled={!controllerConnected}
									title={controllerStudioMode ? 'Set as preview scene' : 'Switch to scene'}
								>
									{isPreview && !isProgram ? '○ ' : ''}
									{s.label}
								</button>
							);
						})}
					</div>

					{controllerStudioMode && (
						<div className={styles.studioRow}>
							<p className={styles.studioHint}>
								Studio Mode is active. Click a scene to set preview, then transition to go live.
							</p>
							<button
								className="btn primary"
								onClick={controllerTransitionToProgram}
								disabled={!controllerConnected || !controllerPreviewScene}
							>
								▶ Transition to Program
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Overlay selector for Controller */}
			<div className="card">
				<div className="card-header">
					<span className="card-title">Controller Overlays</span>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						{activeOverlay ? (
							<span className="badge green">{activeOverlay.label} active</span>
						) : (
							<span className="badge">None active</span>
						)}
						<button
							className="btn sm ghost"
							onClick={() => {
								const s = [...new Set(OVERLAY_SOURCES.map((o) => o.scene))];
								s.forEach((sc) => controllerRefreshScene(sc));
							}}
							disabled={!controllerConnected}
						>
							Refresh
						</button>
					</div>
				</div>
				<div className="card-body">
					{!controllerConnected && <p className={styles.notice}>Connect to Controller OBS in Settings to control overlays.</p>}
					<div className={styles.overlayGrid}>
						{OVERLAY_SOURCES.map((src) => {
							const visible = controllerSourceStates[src.sourceName] === true;
							return (
								<button
									key={src.key}
									className={`${styles.tile} ${visible ? styles.tileOn : styles.tileOff}`}
									onClick={() => selectOverlay(src)}
									disabled={!controllerConnected}
								>
									<div className={styles.tileLabel}>{src.label}</div>
									<div className={styles.tileDesc}>{src.description}</div>
									<div className={styles.tileStatus}>{visible ? '● Active' : '○ Hidden'}</div>
								</button>
							);
						})}
					</div>
					<p className={styles.hint}>
						Selecting an overlay hides all others. Click the active overlay to deselect. Add an OBS <strong>Fade</strong> filter
						to each overlay source for smooth crossfades. Edit <code>OVERLAY_SOURCES</code> in{' '}
						<code>src/pages/StreamsPage.jsx</code> to match your source names.
					</p>
				</div>
			</div>

			{/* Runway Stream */}
			<div className="card">
				<div className="card-header">
					<span className="card-title">Runway Stream — Scene</span>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						{runwayStudioMode && runwayPreviewScene && <span className="badge amber">Preview: {runwayPreviewScene}</span>}
						{runwayCurrentScene && <span className="badge blue mono">{runwayCurrentScene}</span>}
						<button
							className={`btn sm ${runwayStudioMode ? 'active' : ''}`}
							onClick={runwayToggleStudioMode}
							disabled={!runwayConnected}
						>
							{runwayStudioMode ? '⬡ Studio On' : '⬡ Studio Off'}
						</button>
					</div>
				</div>
				<div className="card-body">
					<div className={styles.quickScenes}>
						{QUICK_SCENES_RUNWAY.map((s) => {
							const isProgram = runwayCurrentScene === s.sceneName;
							const isPreview = runwayStudioMode && runwayPreviewScene === s.sceneName;
							return (
								<button
									key={s.sceneName}
									className={`btn ${s.isBrb ? styles.brbBtn : ''} ${isProgram ? (s.isBrb ? styles.brbActive : 'active') : ''} ${isPreview ? styles.previewActive : ''}`}
									onClick={() => handleSceneClickRunway(s.sceneName)}
									disabled={!runwayConnected}
								>
									{isPreview && !isProgram ? '○ ' : ''}
									{s.label}
								</button>
							);
						})}
					</div>

					{runwayStudioMode && (
						<div className={styles.studioRow}>
							<p className={styles.studioHint}>Studio Mode active — click a scene to set preview, then transition.</p>
							<button
								className="btn primary"
								onClick={runwayTransitionToProgram}
								disabled={!runwayConnected || !runwayPreviewScene}
							>
								▶ Transition to Program
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
