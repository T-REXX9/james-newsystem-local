import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const realtimeTarget = `http://${env.REALTIME_HOST || process.env.REALTIME_HOST || '127.0.0.1'}:${env.REALTIME_PORT || process.env.REALTIME_PORT || '8082'}`;
  const extraAllowedHosts = (env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);

  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  }

  return {
    server: {
      port: 8080,
      host: '0.0.0.0',
      allowedHosts: [
        'influential-mouthily-dominik.ngrok-free.dev',
        '.ngrok-free.dev',
        ...extraAllowedHosts,
      ],
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8081',
          changeOrigin: true,
        },
        '/socket.io': {
          target: realtimeTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 3305,
      allowedHosts: [
        'influential-mouthily-dominik.ngrok-free.dev',
        '.ngrok-free.dev',
        ...extraAllowedHosts,
      ],
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8081',
          changeOrigin: true,
        },
        '/socket.io': {
          target: realtimeTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    plugins: [react()],
    base: '/james-newsystem/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './vitest.setup.ts',
      exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
    },
  };
});
