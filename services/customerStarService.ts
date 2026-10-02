import { getLocalAuthSession } from './localAuthService';
import { parseApiErrorMessage } from './localApiAuth';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export const fetchStarredCustomerIds = async (): Promise<string[]> => {
  const session = getLocalAuthSession();
  const sessionMainId = Number(
    session?.context?.main_userid || session?.context?.user?.main_userid || session?.userProfile?.main_userid || 0
  );
  const mainId = Number.isFinite(sessionMainId) && sessionMainId > 0 ? sessionMainId : API_MAIN_ID;
  const query = new URLSearchParams({ main_id: String(mainId) });
  const headers = new Headers();
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
  const response = await fetch(`${API_BASE_URL}/customer-stars?${query.toString()}`, { headers });
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));
  const payload = await response.json();
  const items = payload?.data?.items;
  return Array.isArray(items) ? items.map(String) : [];
};
