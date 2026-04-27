import { useLog } from '../context/LogContext';
import { useState, useEffect } from 'react';
import styles from './LogBar.module.css';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?.?.?';

function formatZuluTime(date) {
	const h = String(date.getUTCHours()).padStart(2, '0');
	const m = String(date.getUTCMinutes()).padStart(2, '0');
	const s = String(date.getUTCSeconds()).padStart(2, '0');
	return `${h}:${m}:${s}Z`;
}

export default function LogBar() {
	const { entries } = useLog();
	const latest = entries[0];
	const [clock, setClock] = useState(() => formatZuluTime(new Date()));

	useEffect(() => {
		const id = setInterval(() => setClock(formatZuluTime(new Date())), 1000);
		return () => clearInterval(id);
	}, []);

	return (
		<div className={styles.bar}>
			<span className={styles.clock}>{clock}</span>
			<span className={styles.divider} />
			{latest && (
				<>
					<span className={styles.ts}>{formatZuluTime(latest.ts)}</span>
					<span className={styles.sep}>›</span>
					<span className={styles.msg}>{latest.msg}</span>
				</>
			)}
			<span className={styles.version}>v{VERSION}</span>
		</div>
	);
}
