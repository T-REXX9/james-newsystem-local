import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function requestLocalApi<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const session = getLocalAuthSession();
  const mainId = session?.context?.main_userid || session?.context?.user?.main_userid || import.meta.env.VITE_MAIN_ID || 1;
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${API_BASE_URL}${path}${separator}main_id=${encodeURIComponent(String(mainId))}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(
      body && typeof body === 'object' && !Array.isArray(body) ? { ...body, main_id: Number(mainId) } : body
    ) }),
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || payload.message || `API request failed (${response.status})`);
  }
  return payload.data as T;
}
