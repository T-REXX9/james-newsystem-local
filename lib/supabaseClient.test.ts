import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    client: true,
    auth: {
      stopAutoRefresh: vi.fn(),
    },
  }))
}));

const { createClient } = await import('@supabase/supabase-js');

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('supabaseClient', () => {
  it('creates a real client when env vars are present', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('VITE_API_BASE_URL', '');

    const module = await import('./supabaseClient');

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        }),
      })
    );
    expect(module.supabase).toBeTruthy();
  });

  it('throws error when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.stubEnv('VITE_API_BASE_URL', '');

    await expect(async () => {
      await import('./supabaseClient');
    }).rejects.toThrow('Missing Supabase environment variables');
  });

  it('disables Supabase auth bootstrapping in local api mode', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.stubEnv('VITE_API_BASE_URL', '/api/v1');

    const module = await import('./supabaseClient');

    expect(createClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'local-api-mode-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: 'supabase-auth-disabled-local-api-mode',
        }),
      })
    );
    expect(module.supabase).toBeTruthy();
  });
});
