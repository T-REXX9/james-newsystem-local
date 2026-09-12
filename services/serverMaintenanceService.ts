import { clearInvalidLocalAuthSession, getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

export type CorporateDumpImportInfo = {
  supported_extensions: string[];
  max_bytes: number;
  chunk_max_bytes: number;
  safety: string;
};

export type ServerMaintenanceStatus = {
  database_name: string;
  backup_available: boolean;
  format: string;
  description: string;
  automatic_backup?: AutomaticBackupSettings;
  corporate_dump_import?: CorporateDumpImportInfo;
};

export type AutomaticBackupFrequency = 'daily' | 'weekly';

export type AutomaticBackupSettings = {
  enabled: boolean;
  frequency: AutomaticBackupFrequency;
  weekly_days: number[];
  time: string;
  timezone: string;
  destination_path: string;
  retention_count: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_message: string | null;
  last_run_key: string | null;
};

export type BackupDestination = {
  id: string;
  label: string;
  path: string;
};

export type CorporateDumpImportReport = {
  filename: string;
  bytes: number;
  import: {
    staging_database?: string;
    tables_merged: number;
    tables_skipped_missing: string[];
    tables_skipped_keyless: string[];
    tables_skipped_no_shared_columns: string[];
    affected_rows: number;
    details: string[];
  };
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

const unwrapData = async <T,>(response: Response): Promise<T> => {
  if (!response.ok) {
    await throwApiError(response);
  }
  const payload = await response.json();
  if (payload.ok === false) {
    throw new Error(payload.error || payload.message || 'Request failed');
  }
  return payload.data as T;
};

export async function fetchServerMaintenanceStatus(): Promise<ServerMaintenanceStatus> {
  const response = await fetch(`${API_BASE_URL}/server-maintenance/status`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  });
  return unwrapData<ServerMaintenanceStatus>(response);
}

export async function fetchAutomaticBackupSettings(): Promise<AutomaticBackupSettings> {
  const response = await fetch(`${API_BASE_URL}/server-maintenance/automatic-backup`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  });
  return unwrapData<AutomaticBackupSettings>(response);
}

export async function saveAutomaticBackupSettings(
  settings: Partial<AutomaticBackupSettings> & {
    enabled: boolean;
    frequency: AutomaticBackupFrequency;
    time: string;
    destination_path: string;
    retention_count: number;
    weekly_days?: number[];
  }
): Promise<AutomaticBackupSettings> {
  const response = await fetch(`${API_BASE_URL}/server-maintenance/automatic-backup`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(settings),
  });
  return unwrapData<AutomaticBackupSettings>(response);
}

export async function fetchBackupDestinations(): Promise<BackupDestination[]> {
  const response = await fetch(`${API_BASE_URL}/server-maintenance/backup-destinations`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  });
  const payload = await unwrapData<{ items: BackupDestination[] }>(response);
  return Array.isArray(payload.items) ? payload.items : [];
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

export async function importCorporateDumpFile(
  file: File,
  options?: {
    chunkSize?: number;
    onProgress?: (progress: { uploadedBytes: number; totalBytes: number; phase: 'upload' | 'import' }) => void;
  }
): Promise<CorporateDumpImportReport> {
  const totalBytes = file.size;
  if (!totalBytes) {
    throw new Error('Selected dump file is empty');
  }
  if (!/\.(sql|sql\.gz)$/i.test(file.name)) {
    throw new Error('Only .sql or .sql.gz dumps are supported');
  }

  const createResponse = await fetch(`${API_BASE_URL}/server-maintenance/corporate-dump/uploads`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({
      filename: file.name,
      bytes: totalBytes,
    }),
  });
  const session = await unwrapData<{
    upload_id: string;
    filename: string;
    bytes_expected: number;
  }>(createResponse);

  const chunkSize = Math.max(64 * 1024, Math.min(options?.chunkSize ?? 1024 * 1024, 2 * 1024 * 1024));
  let uploadedBytes = 0;
  options?.onProgress?.({ uploadedBytes, totalBytes, phase: 'upload' });

  while (uploadedBytes < totalBytes) {
    const chunk = file.slice(uploadedBytes, uploadedBytes + chunkSize);
    const buffer = await chunk.arrayBuffer();
    const response = await fetch(
      `${API_BASE_URL}/server-maintenance/corporate-dump/uploads/${encodeURIComponent(session.upload_id)}/chunks`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/octet-stream',
          ...authHeaders(),
        },
        body: buffer,
      }
    );
    const progress = await unwrapData<{
      bytes_received: number;
      bytes_expected: number;
      complete: boolean;
    }>(response);
    uploadedBytes = progress.bytes_received;
    options?.onProgress?.({ uploadedBytes, totalBytes, phase: 'upload' });
  }

  options?.onProgress?.({ uploadedBytes: totalBytes, totalBytes, phase: 'import' });
  const importResponse = await fetch(
    `${API_BASE_URL}/server-maintenance/corporate-dump/uploads/${encodeURIComponent(session.upload_id)}/import`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({}),
    }
  );
  return unwrapData<CorporateDumpImportReport>(importResponse);
}
