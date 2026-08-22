import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

export async function queueSmsCampaign(messages: Array<{ phone: string; message: string }>, simId?: number): Promise<void> {
  const session = getLocalAuthSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/sms-gateway/queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.token}`,
    },
    body: JSON.stringify({ messages, sim_id: simId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to queue SMS: ${response.statusText}`);
  }
}

export async function getSmsHistory(): Promise<any> {
  const session = getLocalAuthSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/sms-gateway/history`, {
    headers: {
      'Authorization': `Bearer ${session.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SMS history: ${response.statusText}`);
  }

  const payload = await response.json();
  return payload?.data ?? payload;
}

export async function getGatewayDevices(): Promise<any> {
  const session = getLocalAuthSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/sms-gateway/devices`, {
    headers: {
      'Authorization': `Bearer ${session.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch gateway devices: ${response.statusText}`);
  }

  const payload = await response.json();
  return payload?.data ?? payload;
}
