import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchStaff } from '../staffLocalApiService';

describe('staffLocalApiService authentication', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('sends the bearer token when listing staff', async () => {
    window.localStorage.setItem('local_api_auth_session', JSON.stringify({
      token: 'test-bearer-token',
      context: { user: { id: 1 } },
    }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { items: [], meta: { page: 1, per_page: 100, total: 0, total_pages: 0 } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await fetchStaff('', 1, 100);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/staff?main_id=1&search=&page=1&per_page=100',
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-bearer-token');
  });
});
