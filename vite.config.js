import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    root: '.',
    publicDir: 'public',
    server: {
        proxy: {
            '/send-message': 'http://localhost:3000',
            '/qr': 'http://localhost:3000',
            '/auth-status': 'http://localhost:3000',
            '/schedule-message': 'http://localhost:3000',
            '/cancel-schedule/:id': 'http://localhost:3000',
            '/scheduled-jobs': 'http://localhost:3000',
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    css: {
        preprocessorOptions: {
            less: {
                javascriptEnabled: true,
            },
        },
    },
    optimizeDeps: {
        include: ['react-cron-generator'],
    },
});