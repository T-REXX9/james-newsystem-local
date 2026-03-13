import { AccessGroup } from '../types';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

interface AccessGroupRecord {
  id: string | number;
  main_id?: number;
  name?: string;
  description?: string | null;
  access_rights?: string[] | string | null;
  created_at?: string;
  assigned_staff_count?: number;
}

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // ignore parse errors
  }

  return `API request failed (${response.status})`;
};

const requestJson = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const parseAccessRights = (value: AccessGroupRecord['access_rights']): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const mapGroup = (group: AccessGroupRecord): AccessGroup => ({
  id: String(group.id),
  main_id: group.main_id,
  name: group.name || '',
  description: group.description || '',
  access_rights: parseAccessRights(group.access_rights),
  created_at: group.created_at,
  assigned_staff_count: Number(group.assigned_staff_count || 0),
});

export const fetchAccessGroups = async (): Promise<AccessGroup[]> => {
  const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
  const payload = await requestJson(`${API_BASE_URL}/access-groups?${query.toString()}`);
  const items = Array.isArray(payload?.data) ? payload.data : [];
  return items.map(mapGroup);
};

export const createAccessGroup = async (
  name: string,
  description: string,
  accessRights: string[]
): Promise<AccessGroup> => {
  const payload = await requestJson(`${API_BASE_URL}/access-groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: API_MAIN_ID,
      name,
      description,
      access_rights: accessRights,
    }),
  });

  return mapGroup(payload?.data || {});
};

export const updateAccessGroup = async (
  id: string,
  data: Partial<Pick<AccessGroup, 'name' | 'description' | 'access_rights'>>
): Promise<AccessGroup> => {
  const payload = await requestJson(`${API_BASE_URL}/access-groups/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: API_MAIN_ID,
      ...data,
    }),
  });

  return mapGroup(payload?.data || {});
};

export const deleteAccessGroup = async (id: string): Promise<{ success: boolean }> => {
  const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
  await requestJson(`${API_BASE_URL}/access-groups/${id}?${query.toString()}`, {
    method: 'DELETE',
  });

  return { success: true };
};

export const assignStaffToGroup = async (
  staffId: string,
  groupId: string | null,
  accessRights: string[]
): Promise<void> => {
  await requestJson(`${API_BASE_URL}/staff/${staffId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: API_MAIN_ID,
      group_id: groupId,
      access_rights: accessRights,
    }),
  });
};
