import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeStaffPassword, fetchStaff } from '../staffLocalApiService';
import { fetchProfilesLocal } from '../accessLocalApiService';

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

  it('sends the bearer token for the system access staff listing', async () => {
    window.localStorage.setItem('local_api_auth_session', JSON.stringify({
      token: 'access-page-token',
      context: { user: { id: 1 } },
    }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { items: [], meta: { page: 1, per_page: 500, total: 0, total_pages: 1 } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await fetchProfilesLocal({ page: 1, perPage: 500 });

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer access-page-token');
  });

  it('posts a direct staff password change without exposing the password in the response', async () => {
    window.localStorage.setItem('local_api_auth_session', JSON.stringify({
      token: 'master-token',
      context: { user: { id: 1 } },
    }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { password_changed: true, staff_id: 9 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await changeStaffPassword('9', 'NewStrongPass1');

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/staff/9/password', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ main_id: 1, new_password: 'NewStrongPass1' }),
    }));
  });
});
