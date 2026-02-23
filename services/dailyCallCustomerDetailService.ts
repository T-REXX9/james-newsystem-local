const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const buildUrl = (path: string) => {
  const params = new URLSearchParams({ main_id: String(API_MAIN_ID) });
  return `${API_BASE_URL}${path}?${params.toString()}`;
};

const fetchList = async <T>(path: string): Promise<T[]> => {
  try {
    const response = await fetch(buildUrl(path));
    if (!response.ok) throw new Error(`API request failed (${response.status})`);
    const payload = await response.json();
    const data = payload?.data;
    return Array.isArray(data) ? (data as T[]) : [];
  } catch (error) {
    console.error('Daily call detail API error:', error);
    return [];
  }
};

export const fetchDailyCallPurchaseHistory = async (contactId: string) =>
  fetchList<any>(`/daily-call-monitoring/customers/${encodeURIComponent(contactId)}/purchase-history`);

export const fetchDailyCallSalesReports = async (contactId: string) =>
  fetchList<any>(`/daily-call-monitoring/customers/${encodeURIComponent(contactId)}/sales-reports`);

export const fetchDailyCallIncidentReports = async (contactId: string) =>
  fetchList<any>(`/daily-call-monitoring/customers/${encodeURIComponent(contactId)}/incident-reports`);
