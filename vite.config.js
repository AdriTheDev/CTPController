import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
    plugins: [react()],
    root: resolve(__dirname),
    define: {
        __APP_VERSION__: JSON.stringify(version),
    },
    build: {
        rollupOptions: {
            input: resolve(__dirname, 'index.html'),
        },
        outDir: 'dist',
        emptyOutDir: true,
    },
    server: {
        port: 5173,
        host: '127.0.0.1',
    },
});
