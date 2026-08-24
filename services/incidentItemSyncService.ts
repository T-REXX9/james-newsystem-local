import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export interface IncidentItemSyncInput {
  incident_report_id: string;
  contact_id: string;
  product_id?: string;
  item_code?: string;
  part_no?: string;
  description: string;
  supplier_id?: string;
  supplier_name?: string;
  quantity?: number;
  issue_summary: string;
  issue_type: string;
  report_date: string;
}

const resolveMainId = (): number => {
  const session = getLocalAuthSession();
  const dynamicMainId = Number(
    session?.context?.main_userid
      || session?.context?.user?.main_userid
      || session?.userProfile?.main_userid
      || 0
  );
  return Number.isFinite(dynamicMainId) && dynamicMainId > 0 ? dynamicMainId : API_MAIN_ID || 1;
};

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // Ignore malformed error bodies and use the HTTP status below.
  }
  return `API request failed (${response.status})`;
};

export const syncIncidentReportItem = async (input: IncidentItemSyncInput) => {
  const session = getLocalAuthSession();
  if (!session?.token) {
    throw new Error('Your session has expired. Please sign in again before saving the incident item.');
  }

  const response = await fetch(`${API_BASE_URL}/incident-report-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({
      ...input,
      main_id: resolveMainId(),
    }),
  });

  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }

  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || 'Unable to add the incident item to the warehouse report.');
  }

  return payload.data;
};
