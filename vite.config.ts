import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        plugins: [react(), tailwindcss()],
        root: '.',
        define: {
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(env.VITE_GOOGLE_MAPS_API_KEY),
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './client/src'),
                '@shared': path.resolve(__dirname, './shared'),
            },
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                        'vendor-charts': ['recharts'],
                        'vendor-motion': ['motion/react'],
                        'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/storage'],
                    },
                },
            },
        },
        test: {
            exclude: [
                'e2e/**',
                '**/node_modules/**',
                '**/dist/**',
                '**/cypress/**',
                '**/.{idea,git,cache,output,temp}/**',
                '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
            ],
        },
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: env.S2P_API_URL || 'http://localhost:5000',
                    changeOrigin: true,
                },
                '/knowledge-base': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                },
            },
            // HMR is disabled in AI Studio via DISABLE_HMR env var.
            hmr: process.env.DISABLE_HMR !== 'true',
        },
    };
});
