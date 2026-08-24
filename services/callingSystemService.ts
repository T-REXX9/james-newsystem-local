import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

export interface CallDialRequest {
  lid: number | string;
  lagent_id?: number | string;
  lphone_number: string;
  lcustomer_id?: number | string | null;
  lstatus?: string;
  lcreated_at?: string;
}

export interface QueueCallResult {
  queued: boolean;
  request: CallDialRequest;
  customer_matched?: boolean;
}

const getAuthHeaders = (): HeadersInit => {
  const session = getLocalAuthSession();
  if (!session?.token) {
    throw new Error('Please sign in before requesting a phone call.');
  }
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.token}`,
  };
};

export interface CallDeviceHealth {
  lid: number | string;
  lagent_id: number | string;
  ldevice_id: string;
  llast_seen?: string | null;
  lstatus?: string;
  effective_status?: string;
  agent_first_name?: string;
  agent_last_name?: string;
}

export interface AutoReplySettings {
  lid?: number | string;
  lagent_id?: number | string | null;
  lis_active?: number | boolean;
  ltemplate_id?: number | string;
  lcooldown_minutes?: number | string;
  lupdated_at?: string | null;
}

export interface AutoReplyAuditEntry {
  lid: number | string;
  lagent_id: number | string;
  lphone_number: string;
  lmessage_sent: string;
  lsent_at: string;
  agent_first_name?: string;
  agent_last_name?: string;
}

export interface HardwareCallLog {
  lid: number | string;
  lagent_id: number | string;
  ldevice_id: string;
  lcustomer_id?: number | string | null;
  lphone_number: string;
  ldirection: 'inbound' | 'outbound' | 'missed' | string;
  lduration_seconds: number | string;
  lcall_timestamp: string;
  lsource?: string;
  agent_first_name?: string;
  agent_last_name?: string;
  customer_company?: string;
  customer_code?: string;
}

const authenticatedGet = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    const error = payload?.error;
    const message = typeof error === 'string' ? error : error?.message;
    throw new Error(message || `Unable to load call information (${response.status}).`);
  }
  return payload?.data as T;
};

export const fetchCallDeviceHealth = async (): Promise<CallDeviceHealth[]> => {
  const data = await authenticatedGet<{ devices?: CallDeviceHealth[] }>('/call-system/devices');
  return Array.isArray(data?.devices) ? data.devices : [];
};

export const fetchAutoReplySettings = async (): Promise<AutoReplySettings | null> => {
  const data = await authenticatedGet<{ settings?: AutoReplySettings | null }>('/call-system/auto-reply-settings');
  return data?.settings || null;
};

export const saveAutoReplySettings = async (settings: {
  isActive: boolean;
  templateId: string | number;
  cooldownMinutes: number;
}): Promise<AutoReplySettings> => {
  const response = await fetch(`${API_BASE_URL}/call-system/auto-reply-settings`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      is_active: settings.isActive,
      template_id: settings.templateId,
      cooldown_minutes: settings.cooldownMinutes,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    const error = payload?.error;
    const message = typeof error === 'string' ? error : error?.message;
    throw new Error(message || `Unable to save missed-call reply settings (${response.status}).`);
  }
  return payload?.data?.settings as AutoReplySettings;
};

export const fetchAutoReplyAudit = async (): Promise<AutoReplyAuditEntry[]> => {
  const data = await authenticatedGet<{ replies?: AutoReplyAuditEntry[] }>('/call-system/auto-reply-audit');
  return Array.isArray(data?.replies) ? data.replies : [];
};

export const fetchHardwareCallLogs = async (filters: {
  direction?: string;
  agentId?: string | number;
  customerId?: string | number;
  fromDate?: string;
  toDate?: string;
} = {}): Promise<HardwareCallLog[]> => {
  const params = new URLSearchParams();
  if (filters.direction) params.set('direction', filters.direction);
  if (filters.agentId) params.set('agent_id', String(filters.agentId));
  if (filters.customerId) params.set('customer_id', String(filters.customerId));
  if (filters.fromDate) params.set('from_date', filters.fromDate);
  if (filters.toDate) params.set('to_date', filters.toDate);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const data = await authenticatedGet<{ calls?: HardwareCallLog[] }>(`/call-system/call-logs${suffix}`);
  return Array.isArray(data?.calls) ? data.calls : [];
};

export const queueCallRequest = async (phoneNumber: string, customerId?: string | number): Promise<QueueCallResult> => {
  const phone = String(phoneNumber || '').trim();
  if (!phone) throw new Error('This customer does not have a phone number.');

  const response = await fetch(`${API_BASE_URL}/call-system/dial-requests`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      phone_number: phone,
      ...(customerId ? { customer_id: customerId } : {}),
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    const error = payload?.error;
    const message = typeof error === 'string' ? error : error?.message;
    throw new Error(message || `Unable to queue call request (${response.status}).`);
  }

  const data = payload?.data || {};
  return {
    queued: data.queued === true,
    request: data.request as CallDialRequest,
    customer_matched: data.customer_matched === true,
  };
};
