import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchNotifications, getUnreadCount } from '../notificationLocalApiService';

const getLocalAuthSessionMock = vi.fn();

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => getLocalAuthSessionMock(),
}));

describe('notificationLocalApiService', () => {
  beforeEach(() => {
    getLocalAuthSessionMock.mockReset();
    getLocalAuthSessionMock.mockReturnValue({
      token: 'token-123',
      userProfile: {
        id: '73',
      },
      context: {
        user: {
          id: 73,
        },
      },
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetchNotifications includes the default 10-day cutoff', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await fetchNotifications('73', 500);

    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('/notifications?');
    expect(String(url)).toContain('user_id=73');
    expect(String(url)).toContain('limit=500');
    expect(String(url)).toContain('max_age_days=10');
    expect(init.headers.Authorization).toBe('Bearer token-123');
  });

  it('getUnreadCount includes the default 10-day cutoff', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { count: 4 } }),
    });

    const count = await getUnreadCount('73');

    expect(count).toBe(4);
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('/notifications/unread-count?');
    expect(String(url)).toContain('user_id=73');
    expect(String(url)).toContain('max_age_days=10');
    expect(init.headers.Authorization).toBe('Bearer token-123');
  });
});
