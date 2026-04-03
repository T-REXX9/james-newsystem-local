import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export type FreightChargesReportDateType = 'Today' | 'Week' | 'Month' | 'Year' | 'Custom';

export type FreightChargesReportRow = {
  id: number;
  refno: string;
  dm_no: string;
  customer_id: string;
  customer: string;
  transaction: string;
  tracking_no: string;
  courier: string;
  date: string;
  status: string;
  amount: number;
};

export type FreightChargesReportResponse = {
  date_type: FreightChargesReportDateType;
  date_from: string;
  date_to: string;
  rows: FreightChargesReportRow[];
  total_amount: number;
};

const getMainId = (): number => {
  const session = getLocalAuthSession();
  const mainId = Number(session?.context?.user?.main_id || API_MAIN_ID || 1);
  return Number.isFinite(mainId) && mainId > 0 ? mainId : 1;
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // ignore
  }
  return `API request failed (${response.status})`;
};

const requestApi = async (url: string): Promise<any> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || 'API request failed');
  }

  return payload.data;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const freightChargesReportService = {
  async getReport(params: {
    dateType: FreightChargesReportDateType;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<FreightChargesReportResponse> {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      date_type: params.dateType,
    });

    if (params.dateFrom) query.set('date_from', params.dateFrom);
    if (params.dateTo) query.set('date_to', params.dateTo);

    const data = await requestApi(`${API_BASE_URL}/freight-charges/report?${query.toString()}`);

    return {
      date_type: (data?.date_type || 'Today') as FreightChargesReportDateType,
      date_from: String(data?.date_from || ''),
      date_to: String(data?.date_to || ''),
      rows: (Array.isArray(data?.rows) ? data.rows : []).map((row: any) => ({
        id: toNumber(row?.id),
        refno: String(row?.refno || ''),
        dm_no: String(row?.dm_no || ''),
        customer_id: String(row?.customer_id || ''),
        customer: String(row?.customer || ''),
        transaction: String(row?.transaction || ''),
        tracking_no: String(row?.tracking_no || ''),
        courier: String(row?.courier || ''),
        date: String(row?.date || ''),
        status: String(row?.status || ''),
        amount: toNumber(row?.amount),
      })),
      total_amount: toNumber(data?.total_amount),
    };
  },
};
