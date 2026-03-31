import {
  CreateNotificationInput,
  Notification,
  NotificationType,
  StandardNotificationPayload,
  UserProfile,
} from '../types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const PROFILES_CACHE_TTL_MS = 60 * 1000;

let profilesCache: UserProfile[] | null = null;
let profilesCachedAt = 0;

export interface NotificationReadMetadataKey {
  entityType?: string;
  entityId?: string;
  refno?: string;
}

export interface NotificationBatchReadResult {
  success: boolean;
  updatedCount: number;
  updatedIds: string[];
  readAt?: string;
}

export interface NotifyWorkflowEventInput {
  title: string;
  message: string;
  type: NotificationType;
  action: string;
  status: string;
  entityType: string;
  entityId: string;
  actionUrl?: string;
  includeActor?: boolean;
  actorId?: string;
  actorRole?: string;
  targetRoles?: string[];
  targetUserIds?: string[];
  metadata?: Record<string, unknown>;
}

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // ignore parse errors
  }

  return `API request failed (${response.status}${response.statusText ? `: ${response.statusText}` : ''})`;
};

const getUserContext = () => {
  const session = getLocalAuthSession();
  const userId = String(session?.userProfile?.id || session?.context?.user?.id || '').trim();
  const mainId = Number(session?.context?.main_userid || session?.context?.user?.main_userid || 0);

  return {
    session,
    userId,
    mainId: Number.isFinite(mainId) ? mainId : 0,
  };
};

const getAuthHeaders = (): HeadersInit => {
  const { session } = getUserContext();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  return headers;
};

const getEffectiveUserId = (userId?: string): string => {
  const effectiveUserId = String(userId || getUserContext().userId || '').trim();
  if (!effectiveUserId) {
    throw new Error('A notification user context is required.');
  }
  return effectiveUserId;
};

const extractApiData = <T>(result: unknown): T | undefined => {
  if (!result || typeof result !== 'object') {
    return undefined;
  }

  const outerData = (result as { data?: unknown }).data;
  if (outerData && typeof outerData === 'object' && 'data' in (outerData as Record<string, unknown>)) {
    return (outerData as { data?: T }).data;
  }

  return outerData as T | undefined;
};

export async function fetchNotifications(userId?: string, limit = 50): Promise<Notification[]> {
  try {
    const effectiveUserId = getEffectiveUserId(userId);
    const params = new URLSearchParams({
      user_id: effectiveUserId,
      limit: String(limit),
    });

    const response = await fetch(`${API_BASE_URL}/notifications?${params.toString()}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }

    const result = await response.json();
    const notifications = extractApiData<Notification[]>(result);
    return Array.isArray(notifications) ? notifications : [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification | null> {
  try {
    const { mainId } = getUserContext();
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...input,
        main_id: mainId > 0 ? mainId : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }

    const result = await response.json();
    return (result.data || result) as Notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

export async function getUnreadCount(userId?: string): Promise<number> {
  try {
    const effectiveUserId = getEffectiveUserId(userId);
    const params = new URLSearchParams({ user_id: effectiveUserId });
    const response = await fetch(`${API_BASE_URL}/notifications/unread-count?${params.toString()}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }

    const result = await response.json();
    const payload = extractApiData<{ count?: unknown }>(result);
    return Number(payload?.count ?? 0);
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    return 0;
  }
}

export async function markAsRead(notificationId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }

    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

export async function markNotificationsAsReadByEntityKey(
  userId: string | undefined,
  key: NotificationReadMetadataKey
): Promise<NotificationBatchReadResult> {
  try {
    const effectiveUserId = getEffectiveUserId(userId);
    const response = await fetch(`${API_BASE_URL}/notifications/mark-by-entity-read`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        user_id: effectiveUserId,
        entity_type: key.entityType,
        entity_id: key.entityId,
        refno: key.refno,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }

    const result = await response.json();
    return (result.data || result) as NotificationBatchReadResult;
  } catch (error) {
    console.error('Error marking notifications as read by entity key:', error);
    return {
      success: false,
      updatedCount: 0,
      updatedIds: [],
    };
  }
}

export async function markAllAsRead(userId?: string): Promise<boolean> {
  try {
    const effectiveUserId = getEffectiveUserId(userId);
    const response = await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        user_id: effectiveUserId,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }

    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
}

export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }

    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
}

export async function dispatchWorkflowNotification(input: NotifyWorkflowEventInput): Promise<Notification[]> {
  try {
    const session = getLocalAuthSession();
    const actorId = String(input.actorId || session?.userProfile?.id || session?.context?.user?.id || '').trim();
    const actorRole = String(
      input.actorRole ||
      session?.userProfile?.role ||
      session?.context?.user?.role_name ||
      session?.context?.user_type ||
      'Unknown'
    ).trim();

    const response = await fetch(`${API_BASE_URL}/notifications/workflow-dispatch`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...input,
        actorId,
        actorRole,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }

    const result = await response.json();
    return (result.data || result || []) as Notification[];
  } catch (error) {
    console.error('Error dispatching workflow notification:', error);
    return [];
  }
}

export async function fetchNotificationProfiles(force = false): Promise<UserProfile[]> {
  if (!force && profilesCache && Date.now() - profilesCachedAt < PROFILES_CACHE_TTL_MS) {
    return profilesCache;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/profiles?page=1&per_page=500`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }

    const result = await response.json();
    const profiles = ((result?.data?.data || result?.data || []) as UserProfile[]).map((profile) => ({
      ...profile,
      id: String(profile.id || ''),
      role: String(profile.role || ''),
    }));

    profilesCache = profiles;
    profilesCachedAt = Date.now();
    return profiles;
  } catch (error) {
    console.error('Error fetching notification profiles:', error);
    return [];
  }
}

const normalizeLookupValue = (value: unknown): string => String(value || '').trim().toLowerCase();

export async function resolveNotificationUserId(...candidates: Array<unknown>): Promise<string | null> {
  const directCandidate = candidates
    .map((value) => String(value || '').trim())
    .find((value) => /^\d+$/.test(value));

  if (directCandidate) {
    return directCandidate;
  }

  const lookups = candidates.map(normalizeLookupValue).filter(Boolean);
  if (lookups.length === 0) {
    return null;
  }

  const profiles = await fetchNotificationProfiles();
  const matched = profiles.find((profile) => {
    const role = normalizeLookupValue(profile.role);
    const email = normalizeLookupValue(profile.email);
    const fullName = normalizeLookupValue((profile as any).fullName || profile.full_name);

    return lookups.some((lookup) => lookup === email || lookup === fullName || lookup === role);
  });

  return matched?.id ? String(matched.id) : null;
}

export async function triggerInventoryAlertScan(): Promise<Notification[]> {
  try {
    const { mainId } = getUserContext();
    const response = await fetch(`${API_BASE_URL}/notifications/inventory-alerts/scan`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        main_id: mainId > 0 ? mainId : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }

    const result = await response.json();
    return (result.data || result || []) as Notification[];
  } catch (error) {
    console.error('Error scanning inventory alerts:', error);
    return [];
  }
}

export const buildWorkflowNotificationMetadata = (
  payload: Partial<StandardNotificationPayload> & Record<string, unknown>
): Record<string, unknown> => payload;
