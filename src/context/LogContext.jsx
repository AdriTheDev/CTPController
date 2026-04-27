import { createContext, useContext, useState, useCallback } from 'react';

const LogContext = createContext(null);

export function LogProvider({ children }) {
	const [entries, setEntries] = useState([{ ts: new Date(), msg: 'CTP Controller ready.' }]);

	const log = useCallback((msg) => {
		setEntries((prev) => [{ ts: new Date(), msg }, ...prev].slice(0, 100));
	}, []);

	return <LogContext.Provider value={{ entries, log }}>{children}</LogContext.Provider>;
}

export const useLog = () => useContext(LogContext);
