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
    user: { id: 1, main_userid: 1, email: 'owner@example.com' },
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

  it('clears an expired cached token without sending an unauthorized request', async () => {
    const expiredToken = tokenWithExpiry(Math.floor(Date.now() / 1000) - 60);
    window.localStorage.setItem(storageKey, JSON.stringify(storedSession(expiredToken)));

    await expect(restoreLocalAuthSession()).resolves.toBeNull();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });

  it('clears an invalid cached session immediately', () => {
    window.localStorage.setItem(storageKey, JSON.stringify(storedSession(tokenWithExpiry(Math.floor(Date.now() / 1000) + 3600))));

    clearInvalidLocalAuthSession();

    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });
});
