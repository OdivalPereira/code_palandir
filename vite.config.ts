import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const backendPort = env.PORT || env.SERVER_PORT || '8787';
    const serverBaseUrl = env.SERVER_BASE_URL || `http://localhost:${backendPort}`;
    const frontendPort = Number(env.VITE_PORT || env.PORT_FRONTEND || 5174);

    return {
        plugins: [react()],
        define: {
            'process.env': {},
            global: 'globalThis',
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            port: frontendPort,
            strictPort: false,
            host: true,
            proxy: {
                '/api': {
                    target: serverBaseUrl,
                    changeOrigin: true,
                    rewrite: (p) => p,
                },
                '/realtime': {
                    target: serverBaseUrl,
                    changeOrigin: true,
                    ws: true,
                },
            },
        },
    };
})

