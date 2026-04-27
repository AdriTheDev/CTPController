import { useTrackAudio } from '../context/TrackAudioContext';
import styles from './FrequenciesPage.module.css';

// Frequency comes in as Hz (e.g. 118505000) -> format as MHz (118.505)
function fmtFreq(hz) {
	if (!hz) return '—';
	return (hz / 1000000).toFixed(3);
}

export default function FrequenciesPage() {
	const { status, stations, setRx, muteStation, muteAll, refresh } = useTrackAudio();

	const connected = status === 'connected';
	const allMuted = stations.length > 0 && stations.every((s) => s.muted);

	return (
		<div className={styles.page}>
			<div className="card">
				<div className="card-header">
					<div className={styles.headerLeft}>
						<span className="card-title">RX Frequencies</span>
						<span className={`badge ${connected ? 'green' : status === 'connecting' ? 'amber' : 'red'}`}>
							<span className="dot" />
							{connected ? `${stations.length} station${stations.length !== 1 ? 's' : ''}` : status}
						</span>
					</div>
					<div className={styles.headerActions}>
						{stations.length > 0 && (
							<button
								className={`btn sm ${allMuted ? 'danger' : ''}`}
								onClick={() => muteAll(!allMuted)}
								disabled={!connected}
							>
								{allMuted ? 'Unmute All' : 'Mute All'}
							</button>
						)}
						<button className="btn sm" onClick={refresh} disabled={!connected}>
							Refresh
						</button>
					</div>
				</div>

				<div className="card-body" style={{ padding: 0 }}>
					{!connected && (
						<div className={styles.empty}>
							<p>TrackAudio is not connected.</p>
							<p>
								Check the host/port in <a href="/settings">Settings</a>. Auto-retrying every 5s.
							</p>
						</div>
					)}

					{connected && stations.length === 0 && (
						<div className={styles.empty}>
							<p>No stations found.</p>
							<p>Add frequencies in TrackAudio — they will appear here automatically.</p>
						</div>
					)}

					{stations.length > 0 && (
						<table className={styles.table}>
							<thead>
								<tr>
									<th>Callsign</th>
									<th>Frequency</th>
									<th>Active TX</th>
									<th>RX</th>
									<th>Mute</th>
								</tr>
							</thead>
							<tbody>
								{stations.map((st) => (
									<StationRow
										key={st.key}
										station={st}
										onToggleRx={() => setRx(st.key, !st.rx)}
										onToggleMute={() => muteStation(st.key, !st.muted)}
										disabled={!connected}
									/>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>
		</div>
	);
}

function StationRow({ station, onToggleRx, onToggleMute, disabled }) {
	const { callsign, frequency, rx, muted, rxActive } = station;

	return (
		<tr
			className={`
      ${styles.row}
      ${muted ? styles.rowMuted : ''}
      ${rxActive && !muted ? styles.rowActive : ''}
    `}
		>
			<td className={styles.callsign}>{callsign}</td>
			<td className={`mono ${styles.freq}`}>{fmtFreq(frequency)}</td>
			<td>
				{rxActive ? (
					<span className={styles.activePilot}>
						<span className={styles.activeDot} />
						{rxActive}
					</span>
				) : (
					<span className={styles.idle}>—</span>
				)}
			</td>
			<td>
				<button
					className={`btn sm ${rx ? styles.rxOn : styles.rxOff}`}
					onClick={onToggleRx}
					disabled={disabled}
					title={rx ? 'RX enabled — click to disable' : 'RX disabled — click to enable'}
				>
					{rx ? 'RX On' : 'RX Off'}
				</button>
			</td>
			<td className={styles.actionCell}>
				<button className={`btn sm ${muted ? 'danger' : ''}`} onClick={onToggleMute} disabled={disabled}>
					{muted ? 'Unmute' : 'Mute'}
				</button>
			</td>
		</tr>
	);
}
