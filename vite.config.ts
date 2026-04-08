import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const normalizeProxyHost = (value: string | undefined, fallback: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === '0.0.0.0' || normalized === '::') {
    return fallback;
  }
  return normalized;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = `http://${normalizeProxyHost(
    env.API_HOST || process.env.API_HOST,
    '127.0.0.1'
  )}:${env.API_PORT || process.env.API_PORT || '8081'}`;
  const realtimeTarget = `http://${normalizeProxyHost(
    env.REALTIME_HOST || process.env.REALTIME_HOST,
    '127.0.0.1'
  )}:${env.REALTIME_PORT || process.env.REALTIME_PORT || '8082'}`;
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
          target: apiTarget,
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
          target: apiTarget,
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
