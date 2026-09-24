import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearInvalidLocalAuthSession, restoreLocalAuthSession } from '../localAuthService';

const storageKey = 'local_api_auth_session';

const tokenWithExpiry = (expiresAt: number) => {
  const payload = window.btoa(JSON.stringify({ sub: 1, exp: expiresAt }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${payload}.test-signature`;
};

const storedSession = (token: string) => ({
  token,
  context: {
    token,
    user: { id: 1, main_userid: 1, email: 'owner@example.com', team: 'North Team' },
    main_userid: 1,
    user_type: '1',
    session_branch: 'mainbranch',
    logintype: '1',
    industry: 'Shop',
  },
  userProfile: {
    id: '1',
    email: 'owner@example.com',
    full_name: 'Owner User',
    role: 'Owner',
    access_rights: ['*'],
  },
});

describe('localAuthService session restoration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('keeps a previously issued token and validates it with /auth/me (no client-side expiry logout)', async () => {
    const oldToken = tokenWithExpiry(Math.floor(Date.now() / 1000) - 60);
    window.localStorage.setItem(storageKey, JSON.stringify(storedSession(oldToken)));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      data: {
        token: oldToken,
        user: { id: 1, main_userid: 1, email: 'owner@example.com', team: 'North Team' },
        main_userid: 1,
        user_type: '1',
        session_branch: 'mainbranch',
        logintype: '1',
        industry: 'Shop',
      },
    }), { status: 200 }));

    const restored = await restoreLocalAuthSession();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(restored?.token).toBe(oldToken);
    expect(restored?.userProfile.team).toBe('North Team');
    expect(window.localStorage.getItem(storageKey)).not.toBeNull();
  });

  it('clears an invalid cached session immediately', () => {
    window.localStorage.setItem(storageKey, JSON.stringify(storedSession(tokenWithExpiry(Math.floor(Date.now() / 1000) + 3600))));

    clearInvalidLocalAuthSession();

    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });
});
