import { getLocalAuthSession } from './localAuthService';
import { endAuthSessionSilently, parseApiErrorMessage } from './localApiAuth';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

const requireSession = () => {
  const session = getLocalAuthSession();
  if (!session?.token) {
    endAuthSessionSilently();
  }
  return session;
};

export async function queueSmsCampaign(messages: Array<{ phone: string; message: string }>, simId?: number): Promise<void> {
  const session = requireSession();

  const response = await fetch(`${API_BASE_URL}/sms-gateway/queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ messages, sim_id: simId }),
  });

  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
}

export async function getSmsHistory(): Promise<any> {
  const session = requireSession();

  const response = await fetch(`${API_BASE_URL}/sms-gateway/history`, {
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }

  const payload = await response.json();
  return payload?.data ?? payload;
}

export async function getGatewayDevices(): Promise<any> {
  const session = requireSession();

  const response = await fetch(`${API_BASE_URL}/sms-gateway/devices`, {
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }

  const payload = await response.json();
  return payload?.data ?? payload;
}
