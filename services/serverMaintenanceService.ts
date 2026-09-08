import { clearInvalidLocalAuthSession, getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

export type ServerMaintenanceStatus = {
  database_name: string;
  backup_available: boolean;
  format: string;
  description: string;
};

const authHeaders = (): HeadersInit => {
  const session = getLocalAuthSession();
  return {
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
  };
};

const throwApiError = async (response: Response): Promise<never> => {
  let message = `API request failed (${response.status})`;
  try {
    const payload = await response.json();
    message = payload.error || payload.message || message;
    if (response.status === 401 && /invalid token (signature|format|payload)|token expired/i.test(String(message))) {
      clearInvalidLocalAuthSession();
      throw new Error('The server could not validate this request session. Please refresh and sign in again if the issue continues.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('The server could not validate')) {
      throw error;
    }
  }
  throw new Error(message);
};

export async function fetchServerMaintenanceStatus(): Promise<ServerMaintenanceStatus> {
  const response = await fetch(`${API_BASE_URL}/server-maintenance/status`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  const payload = await response.json();
  if (payload.ok === false) {
    throw new Error(payload.error || payload.message || 'Unable to load server maintenance status');
  }
  return payload.data as ServerMaintenanceStatus;
}

const filenameFromDisposition = (value: string | null): string | null => {
  if (!value) return null;
  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      return utfMatch[1].trim();
    }
  }
  const plainMatch = value.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1]?.trim() || null;
};

export async function downloadFullDatabaseBackup(): Promise<{ filename: string; bytes: number }> {
  const response = await fetch(`${API_BASE_URL}/server-maintenance/database-backup`, {
    method: 'GET',
    headers: {
      Accept: 'application/gzip, application/json',
      ...authHeaders(),
    },
  });

  const contentType = String(response.headers.get('Content-Type') || '').toLowerCase();
  if (!response.ok || contentType.includes('application/json')) {
    await throwApiError(response);
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error('Database backup download was empty');
  }

  const filename =
    filenameFromDisposition(response.headers.get('Content-Disposition')) ||
    `database_full_${new Date().toISOString().replace(/[:.]/g, '-')}.sql.gz`;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  return { filename, bytes: blob.size };
}
