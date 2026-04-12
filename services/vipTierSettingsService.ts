import { VipTierConfig } from '../types';
import { getLocalAuthSession } from './localAuthService';
import { DEFAULT_VIP_TIER_CONFIG, normalizeVipTierConfig } from '../utils/vipTierConfig';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // Ignore parse errors and fall through to a generic message.
  }

  return `API request failed (${response.status})`;
};

const requestApi = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }

  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || 'API request failed');
  }

  return payload?.data;
};

const resolveMainId = (): number => {
  const session = getLocalAuthSession();
  const fromSession = Number(
    session?.context?.main_userid ||
    session?.context?.user?.main_userid ||
    (session?.context as any)?.user?.main_id ||
    API_MAIN_ID ||
    1
  );

  return Number.isFinite(fromSession) && fromSession > 0 ? fromSession : 1;
};

const resolveUserId = (): number => {
  const session = getLocalAuthSession();
  const userId = Number(session?.context?.user?.id || 0);
  return Number.isFinite(userId) && userId > 0 ? userId : 1;
};

export async function getVipTierConfig(): Promise<VipTierConfig> {
  const query = new URLSearchParams({ main_id: String(resolveMainId()) });

  try {
    const data = await requestApi(`${API_BASE_URL}/vip-tier-settings?${query.toString()}`);
    return normalizeVipTierConfig(data);
  } catch (error) {
    console.error('Error loading VIP tier settings:', error);
    return DEFAULT_VIP_TIER_CONFIG;
  }
}

export async function setVipTierConfig(config: VipTierConfig): Promise<VipTierConfig | null> {
  const payload = {
    main_id: resolveMainId(),
    user_id: resolveUserId(),
    ...normalizeVipTierConfig(config),
  };

  try {
    const data = await requestApi(`${API_BASE_URL}/vip-tier-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return normalizeVipTierConfig(data);
  } catch (error) {
    console.error('Error saving VIP tier settings:', error);
    return null;
  }
}
