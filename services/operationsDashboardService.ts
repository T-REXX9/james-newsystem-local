import { SalesInquiryStatus } from '../types';
import { getAllSalesInquiries } from './salesInquiryLocalApiService';
import { getSalesOrdersPage } from './salesOrderLocalApiService';
import { getOrderSlipsPage } from './orderSlipLocalApiService';
import { salesReturnService } from './salesReturnLocalApiService';
import { dailyCollectionService } from './dailyCollectionService';
import { accountsReceivableService } from './accountsReceivableService';
import { activityLogsLocalApiService, ActivityLogRecord } from './activityLogsLocalApiService';
import { fetchHardwareCallLogs } from './callingSystemService';

export interface OperationsDashboardSnapshot {
  orders: { inquiries: number; orders: number; open: number; cancelled: number; previousInquiries: number; previousOrders: number; previousOpen: number; previousCancelled: number };
  calls: { incoming: number; outgoing: number; missed: number; returned: number; unanswered: number; averageResponseSeconds: number };
  callDetails: OperationsCallDetail[];
  delivery: { ready: number; shipped: number; inTransit: number; delivered: number; delayed: number; failed: number; total: number };
  lbcRto: { total: number; delivered: number; rto: number; refused: number; wrongAddress: number; unclaimed: number };
  returns: { requests: number; inspection: number; approved: number; disapproved: number; replacement: number; refunded: number };
  collections: { total: number; sales: number; rate: number; previousChange: number; today: number };
  receivables: { total: number; current: number; days31to60: number; days61to90: number; over90: number };
  activities: OperationsActivity[];
  unavailable: string[];
}

export interface OperationsCallDetail {
  id: string;
  occurredAt: string;
  direction: string;
  durationSeconds: number;
  phoneNumber: string;
  agentName: string;
  customerId?: string;
  customerName?: string;
  customerCode?: string;
}

export interface OperationsActivity {
  id: string;
  time: string;
  activity: string;
  description: string;
  reference: string;
  by: string;
  route?: string;
  payload?: Record<string, string>;
}

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const isoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
export const toLocalDateInputValue = isoDate;
const monthKey = (value: unknown) => String(value || '').slice(0, 7);
const dateKey = (value: unknown) => String(value || '').slice(0, 10);
const parseHardwareCallTimestamp = (value: unknown) => {
  const timestamp = String(value || '').trim();
  if (!timestamp) return null;
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp);
  const parsed = new Date(`${timestamp.replace(' ', 'T')}${hasTimeZone ? '' : 'Z'}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const hardwareCallDateKey = (value: unknown) => {
  const timestamp = String(value || '').trim();
  const parsed = parseHardwareCallTimestamp(timestamp);
  if (!parsed) return dateKey(timestamp);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const includesAny = (value: unknown, terms: string[]) => {
  const normalized = String(value || '').toLowerCase();
  return terms.some((term) => normalized.includes(term));
};
const totalCollection = (summary: any) =>
  Number(summary?.collection_totals?.cash || 0)
  + Number(summary?.collection_totals?.check || 0)
  + Number(summary?.collection_totals?.tt || 0)
  - Number(summary?.collection_totals?.less || 0);

export const resolveOperationsActivityLink = (log: ActivityLogRecord): Pick<OperationsActivity, 'route' | 'payload'> => {
  const text = `${log.lpage} ${log.laction} ${log.lrefno}`.toLowerCase();
  const reference = log.lrefno || '';
  if (text.includes('inquiry')) return { route: 'sales-transaction-sales-inquiry', payload: reference ? { inquiryId: reference } : undefined };
  if (text.includes('order slip') || text.includes('delivery receipt') || /(^|\W)(dr|os)[-_]/i.test(reference)) {
    return { route: 'sales-transaction-order-slip', payload: reference ? { orderSlipRefNo: reference } : undefined };
  }
  if (text.includes('sales order') || /(^|\W)so[-_]/i.test(reference)) return { route: 'sales-transaction-sales-order', payload: reference ? { orderId: reference } : undefined };
  if (text.includes('sales return') || text.includes('credit memo') || /(^|\W)(cm|ret)[-_]/i.test(reference)) return { route: 'accounting-transactions-sales-return-credit' };
  if (text.includes('collection')) return { route: 'accounting-accounting-collection-summary' };
  if (text.includes('call')) return { route: 'sales-transaction-daily-call-monitoring' };
  if (text.includes('receivable') || text.includes('ledger')) return { route: 'accounting-reports-accounts-receivable-report' };
  return {};
};

const mapActivity = (log: ActivityLogRecord): OperationsActivity => {
  const occurred = new Date(log.ldatetime);
  const by = `${log.userfname || ''} ${log.userlname || ''}`.trim() || 'System';
  return {
    id: String(log.lid),
    time: Number.isNaN(occurred.getTime()) ? log.ldatetime : occurred.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    activity: log.laction || log.lpage || 'Activity recorded',
    description: [log.lpage, log.laction].filter(Boolean).join(' — '),
    reference: log.lrefno || '—',
    by,
    ...resolveOperationsActivityLink(log),
  };
};

export const buildOperationsDashboardSnapshot = (input: any, selectedDate: Date): OperationsDashboardSnapshot => {
  const currentMonth = isoDate(selectedDate).slice(0, 7);
  const previousDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
  const previousMonth = isoDate(previousDate).slice(0, 7);
  const selectedDay = isoDate(selectedDate);
  const inquiries = input.inquiries || [];
  const currentInquiries = inquiries.filter((row: any) => monthKey(row.sales_date || row.created_at) === currentMonth);
  const previousInquiries = inquiries.filter((row: any) => monthKey(row.sales_date || row.created_at) === previousMonth);
  const currentOrders = input.currentOrders?.items || [];
  const previousOrders = input.previousOrders?.items || [];
  const slips = input.slips?.items || [];
  const returns = input.returns?.items || [];
  const callLogs = input.hardwareCallLogs || [];
  const arCustomers = input.receivables?.customers || [];
  const referenceDate = new Date(`${selectedDay}T23:59:59`);
  const aging = { current: 0, days31to60: 0, days61to90: 0, over90: 0 };
  for (const customer of arCustomers) {
    for (const row of customer.rows || []) {
      const balance = Number(row.balance || 0);
      const occurred = new Date(row.date || selectedDay);
      const age = Number.isNaN(occurred.getTime()) ? 0 : Math.max(0, Math.floor((referenceDate.getTime() - occurred.getTime()) / 86400000));
      if (age <= 30) aging.current += balance;
      else if (age <= 60) aging.days31to60 += balance;
      else if (age <= 90) aging.days61to90 += balance;
      else aging.over90 += balance;
    }
  }
  const callsToday = callLogs.filter((log: any) => hardwareCallDateKey(log.lcall_timestamp) === selectedDay);
  const durations = callsToday.map((log: any) => Number(log.lduration_seconds || 0)).filter((value: number) => value > 0);
  const callDetails: OperationsCallDetail[] = callsToday.map((log: any) => {
    const parsedTimestamp = parseHardwareCallTimestamp(log.lcall_timestamp);
    return {
      id: String(log.lid || `${log.lcall_timestamp}-${log.lphone_number}`),
      occurredAt: parsedTimestamp?.toISOString() || String(log.lcall_timestamp || ''),
      direction: String(log.ldirection || ''),
      durationSeconds: Number(log.lduration_seconds || 0),
      phoneNumber: String(log.lphone_number || ''),
      agentName: `${log.agent_first_name || ''} ${log.agent_last_name || ''}`.trim() || `Staff #${log.lagent_id || '—'}`,
      customerId: log.lcustomer_id ? String(log.lcustomer_id) : undefined,
      customerName: String(log.customer_company || '').trim() || undefined,
      customerCode: String(log.customer_code || '').trim() || undefined,
    };
  });
  const shippedRemarks = (slip: any) => `${slip.remarks || ''} ${slip.status || ''}`;
  const trackedSlips = slips.filter((slip: any) => String(slip.tracking_no || '').trim());
  const currentCollection = totalCollection(input.currentCollections);
  const previousCollection = totalCollection(input.previousCollections);
  const todayCollection = totalCollection(input.todayCollections);
  const sales = currentOrders.reduce((sum: number, order: any) => sum + Number(order.grand_total || 0), 0);

  return {
    orders: {
      inquiries: currentInquiries.length,
      orders: currentOrders.length,
      open: currentInquiries.filter((row: any) => row.status === SalesInquiryStatus.DRAFT).length,
      cancelled: currentInquiries.filter((row: any) => row.status === SalesInquiryStatus.CANCELLED || row.is_deleted).length,
      previousInquiries: previousInquiries.length,
      previousOrders: previousOrders.length,
      previousOpen: previousInquiries.filter((row: any) => row.status === SalesInquiryStatus.DRAFT).length,
      previousCancelled: previousInquiries.filter((row: any) => row.status === SalesInquiryStatus.CANCELLED || row.is_deleted).length,
    },
    calls: {
      incoming: callsToday.filter((row: any) => row.ldirection === 'inbound').length,
      outgoing: callsToday.filter((row: any) => row.ldirection === 'outbound').length,
      missed: callsToday.filter((row: any) => row.ldirection === 'missed').length,
      returned: 0,
      unanswered: callsToday.filter((row: any) => row.ldirection === 'outbound' && Number(row.lduration_seconds || 0) === 0).length,
      averageResponseSeconds: durations.length ? Math.round(durations.reduce((sum: number, value: number) => sum + value, 0) / durations.length) : 0,
    },
    callDetails,
    delivery: {
      ready: slips.filter((row: any) => String(row.status).toLowerCase() === 'draft').length,
      shipped: slips.filter((row: any) => String(row.status).toLowerCase() === 'finalized').length,
      inTransit: slips.filter((row: any) => includesAny(shippedRemarks(row), ['in transit', 'in-transit'])).length,
      delivered: slips.filter((row: any) => includesAny(shippedRemarks(row), ['delivered'])).length,
      delayed: slips.filter((row: any) => includesAny(shippedRemarks(row), ['delay'])).length,
      failed: slips.filter((row: any) => String(row.status).toLowerCase() === 'cancelled' || includesAny(shippedRemarks(row), ['failed'])).length,
      total: slips.length,
    },
    lbcRto: {
      total: trackedSlips.length,
      delivered: trackedSlips.filter((row: any) => includesAny(shippedRemarks(row), ['delivered'])).length,
      rto: trackedSlips.filter((row: any) => includesAny(shippedRemarks(row), ['rto', 'return to origin'])).length,
      refused: trackedSlips.filter((row: any) => includesAny(shippedRemarks(row), ['refused'])).length,
      wrongAddress: trackedSlips.filter((row: any) => includesAny(shippedRemarks(row), ['wrong address'])).length,
      unclaimed: trackedSlips.filter((row: any) => includesAny(shippedRemarks(row), ['unclaimed'])).length,
    },
    returns: {
      requests: returns.length,
      inspection: returns.filter((row: any) => includesAny(row.lstatus, ['inspection', 'pending'])).length,
      approved: returns.filter((row: any) => includesAny(row.lstatus, ['approved', 'posted'])).length,
      disapproved: returns.filter((row: any) => includesAny(row.lstatus, ['disapproved', 'rejected', 'cancelled'])).length,
      replacement: returns.filter((row: any) => includesAny(`${row.lstatus} ${row.lremark}`, ['replacement'])).length,
      refunded: returns.filter((row: any) => includesAny(`${row.lstatus} ${row.lremark}`, ['refund'])).length,
    },
    collections: {
      total: currentCollection,
      sales,
      rate: sales > 0 ? (currentCollection / sales) * 100 : 0,
      previousChange: previousCollection > 0 ? ((currentCollection - previousCollection) / previousCollection) * 100 : 0,
      today: todayCollection,
    },
    receivables: { total: Number(input.receivables?.grand_total_balance || 0), ...aging },
    activities: (input.activities?.items || []).map(mapActivity),
    unavailable: input.unavailable || [],
  };
};

export const fetchOperationsDashboardSnapshot = async (selectedDate: Date): Promise<OperationsDashboardSnapshot> => {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const previous = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
  const previousEnd = endOfMonth(previous);
  const jobs: Record<string, Promise<any>> = {
    inquiries: getAllSalesInquiries(),
    currentOrders: getSalesOrdersPage({ month: selectedDate.getMonth() + 1, year: selectedDate.getFullYear(), status: 'all', page: 1, perPage: 500 }),
    previousOrders: getSalesOrdersPage({ month: previous.getMonth() + 1, year: previous.getFullYear(), status: 'all', page: 1, perPage: 500 }),
    slips: getOrderSlipsPage({ dateFrom: isoDate(monthStart), dateTo: isoDate(monthEnd), status: 'all', page: 1, perPage: 500 }),
    returns: salesReturnService.list({ month: String(selectedDate.getMonth() + 1), year: String(selectedDate.getFullYear()), page: 1, perPage: 500 }),
    currentCollections: dailyCollectionService.getSummary({ dateType: 'custom', dateFrom: isoDate(monthStart), dateTo: isoDate(monthEnd), limit: 1000 }),
    previousCollections: dailyCollectionService.getSummary({ dateType: 'custom', dateFrom: isoDate(previous), dateTo: isoDate(previousEnd), limit: 1000 }),
    todayCollections: dailyCollectionService.getSummary({ dateType: 'custom', dateFrom: isoDate(selectedDate), dateTo: isoDate(selectedDate), limit: 1000 }),
    receivables: accountsReceivableService.getReport({ debtType: 'All', dateType: 'custom', dateFrom: '2000-01-01', dateTo: isoDate(selectedDate) }),
    activities: activityLogsLocalApiService.list({ dateFrom: isoDate(selectedDate), dateTo: isoDate(selectedDate), page: 1, perPage: 20 }),
    hardwareCallLogs: fetchHardwareCallLogs(),
  };
  const entries = await Promise.all(Object.entries(jobs).map(async ([key, job]) => {
    try { return [key, await job, null] as const; }
    catch { return [key, null, key] as const; }
  }));
  const input: any = { unavailable: [] };
  entries.forEach(([key, value, errorKey]) => {
    input[key] = value;
    if (errorKey) input.unavailable.push(errorKey);
  });
  return buildOperationsDashboardSnapshot(input, selectedDate);
};
