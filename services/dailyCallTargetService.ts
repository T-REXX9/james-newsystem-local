import { getLocalAuthSession } from './localAuthService';
import { parseApiErrorMessage } from './localApiAuth';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

const request = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));
  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.error || 'API request failed');
  return payload.data;
};

const authHeaders = (): Record<string, string> => {
  const token = getLocalAuthSession()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function fetchDailyCallMonthlyTarget(): Promise<number> {
  const payload = await request(`${API_BASE_URL}/daily-call-monitoring/monthly-target`, {
    headers: authHeaders(),
  });
  const target = Number(payload?.monthly_target);
  if (!Number.isFinite(target) || target < 0) throw new Error('The saved monthly target is invalid.');
  return target;
}

export async function saveDailyCallMonthlyTarget(target: number): Promise<number> {
  const payload = await request(`${API_BASE_URL}/daily-call-monitoring/monthly-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ monthly_target: target }),
  });
  const savedTarget = Number(payload?.monthly_target);
  if (!Number.isFinite(savedTarget) || savedTarget < 0) throw new Error('The saved monthly target was not returned by the server.');
  return savedTarget;
}
