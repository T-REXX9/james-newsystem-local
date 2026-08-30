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

const resolveBrowserApiBase = (value: string | undefined): string => {
  const configured = String(value || '/api/v1').trim();
  // Browser requests must share the public application's origin. An absolute
  // URL works on a developer machine but points at the visitor's own machine
  // when the app is opened through a corporate tunnel.
  if (!configured.startsWith('/') || configured.startsWith('//')) {
    console.warn('Ignoring absolute VITE_API_BASE_URL; browser API calls use /api/v1 on the current origin.');
    return '/api/v1';
  }
  return configured;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const browserApiBase = resolveBrowserApiBase(env.VITE_API_BASE_URL);
  const apiTarget = `http://${normalizeProxyHost(
    env.API_HOST || process.env.API_HOST,
    '127.0.0.1'
  )}:${env.API_PORT || process.env.API_PORT || '8081'}`;
  const realtimeTarget = `http://${normalizeProxyHost(
    env.REALTIME_HOST || process.env.REALTIME_HOST,
    '127.0.0.1'
  )}:${env.REALTIME_PORT || process.env.REALTIME_PORT || '8082'}`;

  return {
    define: {
      // Use the validated value in every browser service, including ones that
      // access import.meta.env through optional chaining.
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(browserApiBase),
    },
    // Keep dependency optimization writable even when node_modules contains an old root-owned cache.
    cacheDir: '.cache/vite',
    server: {
      port: 8080,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
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
      strictPort: true,
      allowedHosts: true,
      headers: {
        // A tunnel must always retrieve the current HTML entry point after a
        // deployment; hashed assets can then be selected by that entry point.
        'Cache-Control': 'no-store, max-age=0',
      },
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
