import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        root: '.',
        publicDir: 'public',
        server: {
            proxy: {
                '/api': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    secure: false,
                    ws: false,
                },
            },
        },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
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
        define: {
            'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
            'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
        },
    };
});