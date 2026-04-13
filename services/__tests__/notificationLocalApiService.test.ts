import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchNotifications,
  getNotificationApiAvailability,
  getUnreadCount,
} from '../notificationLocalApiService';

const getLocalAuthSessionMock = vi.fn();

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => getLocalAuthSessionMock(),
}));

describe('notificationLocalApiService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T08:00:00.000Z'));
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
    vi.useRealTimers();
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

  it('marks the notification API unavailable after a transport failure and clears it after a response', async () => {
    (global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(fetchNotifications('73')).resolves.toEqual([]);

    expect(getNotificationApiAvailability()).toEqual({
      isReachable: false,
      retryAt: Date.parse('2026-04-13T08:02:00.000Z'),
      lastFailureAt: Date.parse('2026-04-13T08:00:00.000Z'),
    });

    vi.setSystemTime(new Date('2026-04-13T08:02:00.000Z'));
    expect(getNotificationApiAvailability()).toEqual({
      isReachable: true,
      retryAt: Date.parse('2026-04-13T08:02:00.000Z'),
      lastFailureAt: Date.parse('2026-04-13T08:00:00.000Z'),
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Unauthorized' }),
    });

    await expect(getUnreadCount('73')).resolves.toBe(0);
    expect(getNotificationApiAvailability()).toEqual({
      isReachable: true,
      retryAt: null,
      lastFailureAt: null,
    });
  });
});
