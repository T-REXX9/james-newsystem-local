import {
  SalesReportFilters,
  SalesReportData,
  SalesReportTransaction,
  SalesReportSummary,
  CategoryTotal,
  SalespersonTotal,
  GrandTotal,
  CustomerOption,
} from '../types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

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
    // no-op
  }
  return `API request failed (${response.status})`;
};

const requestApi = async (url: string): Promise<any> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await parseApiError(response));
  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.error || 'API request failed');
  return payload.data;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapCategoryTotals = (value: any): CategoryTotal[] => {
  const rows = Array.isArray(value) ? value : [];
  return rows.map((entry: any) => ({
    category: String(entry?.category || 'Uncategorized'),
    soAmount: toNumber(entry?.soAmount),
    drAmount: toNumber(entry?.drAmount),
    invoiceAmount: toNumber(entry?.invoiceAmount),
  }));
};

const mapSalespersonTotals = (value: any): SalespersonTotal[] => {
  const rows = Array.isArray(value) ? value : [];
  return rows.map((entry: any) => ({
    salesperson: String(entry?.salesperson || 'Unassigned'),
    categories: mapCategoryTotals(entry?.categories),
    total: toNumber(entry?.total),
  }));
};

const mapGrandTotal = (value: any): GrandTotal => ({
  soAmount: toNumber(value?.soAmount),
  drAmount: toNumber(value?.drAmount),
  invoiceAmount: toNumber(value?.invoiceAmount),
  total: toNumber(value?.total),
});

export const getCustomerList = async (): Promise<CustomerOption[]> => {
  try {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      limit: '1000',
    });

    const data = await requestApi(`${API_BASE_URL}/sales-reports/customers?${query.toString()}`);
    const items = Array.isArray(data?.items) ? data.items : [];

    return items
      .map((c: any) => ({
        id: String(c?.id || ''),
        company: String(c?.company || 'Unknown'),
      }))
      .sort((a, b) => a.company.localeCompare(b.company))
      .filter((c: CustomerOption) => c.id !== '');
  } catch (err) {
    console.error('Error fetching customers:', err);
    return [];
  }
};

const resolveDateType = (dateFrom: string, dateTo: string): 'all' | 'custom' => {
  if (dateFrom === '2013-06-01') {
    return 'all';
  }
  return 'custom';
};

export const getSalesReportData = async (
  filters: SalesReportFilters
): Promise<SalesReportData> => {
  try {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      date_type: resolveDateType(filters.dateFrom, filters.dateTo),
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      customer_id: filters.customerId,
      limit: '2500',
    });

    const data = await requestApi(`${API_BASE_URL}/sales-reports?${query.toString()}`);

    const transactions: SalesReportTransaction[] = (Array.isArray(data?.transactions) ? data.transactions : []).map((tx: any) => ({
      id: String(tx?.id || ''),
      date: String(tx?.date || ''),
      customer: String(tx?.customer || 'Unknown'),
      customerId: String(tx?.customer_id || ''),
      terms: String(tx?.terms || ''),
      refNo: String(tx?.ref_no || ''),
      soNo: String(tx?.so_no || ''),
      soAmount: toNumber(tx?.so_amount),
      drAmount: toNumber(tx?.dr_amount),
      invoiceAmount: toNumber(tx?.invoice_amount),
      salesperson: String(tx?.salesperson || 'Unassigned'),
      category: String(tx?.category || 'Uncategorized'),
      vatType: tx?.vat_type === 'exclusive' || tx?.vat_type === 'inclusive' ? tx.vat_type : null,
      type: tx?.type === 'dr' ? 'dr' : tx?.type === 'so' ? 'so' : 'invoice',
    }));

    const summary: SalesReportSummary = {
      categoryTotals: mapCategoryTotals(data?.summary?.categoryTotals),
      salespersonTotals: mapSalespersonTotals(data?.summary?.salespersonTotals),
      grandTotal: mapGrandTotal(data?.summary?.grandTotal),
    };

    return { transactions, summary };
  } catch (err) {
    console.error('Error in getSalesReportData:', err);
    return {
      transactions: [],
      summary: {
        categoryTotals: [],
        salespersonTotals: [],
        grandTotal: { soAmount: 0, drAmount: 0, invoiceAmount: 0, total: 0 },
      },
    };
  }
};

export const getTransactionDetails = async (
  transactionId: string,
  type: 'invoice' | 'dr' | 'so'
): Promise<any[]> => {
  try {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      type,
    });

    const data = await requestApi(
      `${API_BASE_URL}/sales-reports/transactions/${encodeURIComponent(transactionId)}/items?${query.toString()}`
    );

    const items = Array.isArray(data?.items) ? data.items : [];

    return items.map((item: any) => ({
      id: String(item?.id || ''),
      qty: toNumber(item?.qty),
      partNo: String(item?.part_no || ''),
      itemCode: String(item?.item_code || ''),
      description: String(item?.description || ''),
      unitPrice: toNumber(item?.unit_price),
      amount: toNumber(item?.amount),
      brand: String(item?.brand || ''),
      category: String(item?.category || 'Uncategorized'),
    }));
  } catch (err) {
    console.error('Error in getTransactionDetails:', err);
    return [];
  }
};
