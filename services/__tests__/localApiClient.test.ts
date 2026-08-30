import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestLocalApi } from '../localApiClient';

const storageKey = 'local_api_auth_session';

const storedSession = {
  token: 'stale-deployment-token',
  context: {
    token: 'stale-deployment-token',
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
    role: 'Company Owner',
    access_rights: ['*'],
  },
};

describe('localApiClient', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('clears a cached session when the deployed API rejects the token signature', async () => {
    const authChanged = vi.fn();
    window.localStorage.setItem(storageKey, JSON.stringify(storedSession));
    window.addEventListener('local-auth-changed', authChanged);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ok: false,
      error: 'Invalid token signature',
    }), { status: 401 }));

    await expect(requestLocalApi('/customer-workflows/requests')).rejects.toThrow('could not validate');

    expect(window.localStorage.getItem(storageKey)).toBeNull();
    expect(authChanged).toHaveBeenCalledTimes(1);
    expect((authChanged.mock.calls[0][0] as CustomEvent).detail).toBeNull();
    window.removeEventListener('local-auth-changed', authChanged);
  });
});
