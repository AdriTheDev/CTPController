import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { OBSProvider } from './context/OBSContext';
import { SpotifyProvider } from './context/SpotifyContext';
import { TrackAudioProvider } from './context/TrackAudioContext';
import { LocalMusicProvider } from './context/LocalMusicContext';
import { LogProvider } from './context/LogContext';
import { useSceneAutomation } from './hooks/useSceneAutomation';
import Header from './components/Header';
import LogBar from './components/LogBar';
import SidePanel from './components/SidePanel';
import StreamsPage from './pages/StreamsPage';
import MusicPage from './pages/MusicPage';
import FrequenciesPage from './pages/FrequenciesPage';
import SettingsPage from './pages/SettingsPage';
import PreviewPage from './pages/PreviewPage';
import styles from './App.module.css';

function AppInner() {
	useSceneAutomation();
	const location = useLocation();
	const isPreviewPage = location.pathname === '/preview';

	return (
		<div className={styles.shell}>
			<Header />
			<div className={styles.body}>
				<nav className={styles.nav}>
					<NavLink to="/" end className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}>
						Streams
					</NavLink>
					<NavLink to="/music" className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}>
						Music
					</NavLink>
					<NavLink to="/frequencies" className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}>
						Frequencies
					</NavLink>
					<NavLink to="/preview" className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}>
						Preview
					</NavLink>
					<NavLink to="/settings" className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}>
						Settings
					</NavLink>
				</nav>
				<main className={`${styles.main} ${isPreviewPage ? styles.mainFull : ''}`}>
					<Routes>
						<Route path="/" element={<StreamsPage />} />
						<Route path="/music" element={<MusicPage />} />
						<Route path="/frequencies" element={<FrequenciesPage />} />
						<Route path="/preview" element={<PreviewPage />} />
						<Route path="/settings" element={<SettingsPage />} />
					</Routes>
				</main>
				{!isPreviewPage && <SidePanel />}
			</div>
			<LogBar />
		</div>
	);
}

export default function App() {
	return (
		<LogProvider>
			<OBSProvider>
				<SpotifyProvider>
					<LocalMusicProvider>
						<TrackAudioProvider>
							<AppInner />
						</TrackAudioProvider>
					</LocalMusicProvider>
				</SpotifyProvider>
			</OBSProvider>
		</LogProvider>
	);
}
