import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

type CollectionAction =
  | 'submitrecord'
  | 'approverecord'
  | 'disapproverecord'
  | 'cancelrecord'
  | 'postrecord'
  | 'posttoledger';

export type DailyCollectionHeader = {
  lrefno: string;
  lcolection_no: string;
  lstatus: string;
  ldatetime?: string;
  total_amt?: number;
};

export type DailyCollectionItem = {
  lid: number;
  lrefno: string;
  lcustomer: string;
  lcustomer_fname: string;
  lcustomer_lname: string;
  ltype: string;
  lbank: string;
  lchk_no: string;
  lchk_date: string;
  lamt: number;
  lstatus: string;
  lremarks: string;
  lcollect_date: string;
  lpost: number;
  lcollection_status: string;
  ltransaction_no: string;
};

export type DailyCollectionApproverLog = {
  lid: number;
  lstatus: string;
  lremarks: string;
  lstaff_id: string;
  ldatetime: string;
  staff_fName?: string;
  staff_lName?: string;
};

export type CollectionPaymentTransaction = {
  transaction_type: 'Invoice' | 'OrderSlip';
  transaction_refno: string;
  transaction_no: string;
  transaction_amount: number;
};

export type CollectionPaymentPayload = {
  customerId: string;
  type: string;
  bank: string;
  checkNo: string;
  checkDate: string;
  amount: number;
  status: string;
  remarks: string;
  collectDate: string;
  transactions: CollectionPaymentTransaction[];
};

export type CollectionCustomer = {
  id: string;
  code: string;
  company: string;
};

export type CollectionUnpaidRow = {
  lrefno: string;
  linvoice_no: string;
  totalAmount: number;
  transactionType: 'Invoice' | 'OrderSlip';
};

export type CollectionSummaryDateType = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export type CollectionSummaryItem = {
  date: string;
  customer: string;
  dcr_no: string;
  cash: number;
  check: number;
  tt: number;
  less: number;
  remarks: string;
};

export type CollectionSummaryDebitItem = {
  lrefno: string;
  ldm_no: string;
  lcustomer_code: string;
  lcustomer_name: string;
  ldatetime: string;
  lamount: number;
};

export type CollectionSummaryResponse = {
  date_from: string;
  date_to: string;
  collection_items: CollectionSummaryItem[];
  collection_totals: {
    cash: number;
    check: number;
    tt: number;
    less: number;
  };
  debit_items: CollectionSummaryDebitItem[];
  debit_totals: {
    amount: number;
  };
};

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // no-op
  }
  return `API request failed (${response.status})`;
};

const requestApi = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));
  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.error || 'API request failed');
  return payload.data;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getUserContext = () => {
  const session = getLocalAuthSession();
  const userId = Number(session?.context?.user?.id || 1);
  return {
    mainId: API_MAIN_ID,
    userId: Number.isFinite(userId) && userId > 0 ? userId : 1,
    staffId: String(session?.context?.user?.id || userId || 1),
  };
};

export const dailyCollectionService = {
  async listCollections(filters?: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<DailyCollectionHeader[]> {
    const query = new URLSearchParams({
      main_id: String(API_MAIN_ID),
    });
    if (filters?.search) query.set('search', filters.search);
    if (filters?.status && filters.status !== 'All') query.set('status', filters.status);
    if (filters?.dateFrom) query.set('date_from', filters.dateFrom);
    if (filters?.dateTo) query.set('date_to', filters.dateTo);

    const data = await requestApi(`${API_BASE_URL}/collections?${query.toString()}`);
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row: any) => ({
      lrefno: String(row?.lrefno || ''),
      lcolection_no: String(row?.lcolection_no || ''),
      lstatus: String(row?.lstatus || 'Pending'),
      ldatetime: String(row?.ldatetime || ''),
      total_amt: toNumber(row?.total_amt, 0),
    }));
  },

  async createCollection(): Promise<{ lrefno: string; lcolection_no: string; lstatus: string }> {
    const ctx = getUserContext();
    return requestApi(`${API_BASE_URL}/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: ctx.mainId,
        user_id: ctx.userId,
      }),
    });
  },

  async getCollection(refno: string): Promise<DailyCollectionHeader | null> {
    try {
      const data = await requestApi(`${API_BASE_URL}/collections/${encodeURIComponent(refno)}`);
      return {
        lrefno: String(data?.lrefno || ''),
        lcolection_no: String(data?.lcolection_no || ''),
        lstatus: String(data?.lstatus || 'Pending'),
        ldatetime: String(data?.ldatetime || ''),
        total_amt: toNumber(data?.total_amt, 0),
      };
    } catch {
      return null;
    }
  },

  async getCollectionItems(refno: string): Promise<DailyCollectionItem[]> {
    const data = await requestApi(`${API_BASE_URL}/collections/${encodeURIComponent(refno)}/items`);
    const rows = Array.isArray(data?.items) ? data.items : [];
    return rows.map((row: any) => ({
      lid: toNumber(row?.lid, 0),
      lrefno: String(row?.lrefno || ''),
      lcustomer: String(row?.lcustomer || ''),
      lcustomer_fname: String(row?.lcustomer_fname || ''),
      lcustomer_lname: String(row?.lcustomer_lname || ''),
      ltype: String(row?.ltype || ''),
      lbank: String(row?.lbank || ''),
      lchk_no: String(row?.lchk_no || ''),
      lchk_date: String(row?.lchk_date || ''),
      lamt: toNumber(row?.lamt, 0),
      lstatus: String(row?.lstatus || ''),
      lremarks: String(row?.lremarks || ''),
      lcollect_date: String(row?.lcollect_date || ''),
      lpost: toNumber(row?.lpost, 0),
      lcollection_status: String(row?.lcollection_status || ''),
      ltransaction_no: String(row?.ltransaction_no || ''),
    }));
  },

  async getApproverLogs(refno: string): Promise<DailyCollectionApproverLog[]> {
    const data = await requestApi(`${API_BASE_URL}/collections/${encodeURIComponent(refno)}/approver-logs`);
    const rows = Array.isArray(data?.logs) ? data.logs : [];
    return rows.map((row: any) => ({
      lid: toNumber(row?.lid, 0),
      lstatus: String(row?.lstatus || ''),
      lremarks: String(row?.lremarks || ''),
      lstaff_id: String(row?.lstaff_id || ''),
      ldatetime: String(row?.ldatetime || ''),
      staff_fName: String(row?.staff_fName || ''),
      staff_lName: String(row?.staff_lName || ''),
    }));
  },

  async getCustomers(search = ''): Promise<CollectionCustomer[]> {
    const trimmedSearch = search.trim();

    const query = new URLSearchParams({
      main_id: String(API_MAIN_ID),
      status: 'all',
      page: '1',
      per_page: trimmedSearch === '' ? '500' : '100',
      mode: 'picker',
      search: trimmedSearch,
    });
    const data = await requestApi(`${API_BASE_URL}/customer-database?${query.toString()}`);
    const rows = Array.isArray(data?.items) ? data.items : [];
    return rows.map((row: any) => ({
      id: String(row?.session_id || ''),
      code: String(row?.customer_code || ''),
      company: String(row?.company || ''),
    }));
  },

  async getUnpaidTransactions(customerId: string): Promise<CollectionUnpaidRow[]> {
    const query = new URLSearchParams({
      main_id: String(API_MAIN_ID),
      customer_id: customerId,
    });
    const data = await requestApi(`${API_BASE_URL}/collections/unpaid?${query.toString()}`);

    const invoices = Array.isArray(data?.INVLIST) ? data.INVLIST : [];
    const orders = Array.isArray(data?.ORLIST) ? data.ORLIST : [];

    return [
      ...invoices.map((row: any) => ({
        lrefno: String(row?.lrefno || ''),
        linvoice_no: String(row?.linvoice_no || ''),
        totalAmount: toNumber(row?.totalAmount, 0),
        transactionType: 'Invoice' as const,
      })),
      ...orders.map((row: any) => ({
        lrefno: String(row?.lrefno || ''),
        linvoice_no: String(row?.linvoice_no || ''),
        totalAmount: toNumber(row?.totalAmount, 0),
        transactionType: 'OrderSlip' as const,
      })),
    ];
  },

  async addPayment(refno: string, payload: CollectionPaymentPayload): Promise<void> {
    const ctx = getUserContext();
    await requestApi(`${API_BASE_URL}/collections/${encodeURIComponent(refno)}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: ctx.mainId,
        user_id: ctx.userId,
        customer_id: payload.customerId,
        type: payload.type,
        bank: payload.bank,
        check_no: payload.checkNo,
        check_date: payload.checkDate,
        amount: payload.amount,
        status: payload.status,
        remarks: payload.remarks,
        collect_date: payload.collectDate,
        transactions: payload.transactions,
      }),
    });
  },

  async deleteItem(itemId: number): Promise<void> {
    await requestApi(`${API_BASE_URL}/collection-items/${encodeURIComponent(String(itemId))}`, {
      method: 'DELETE',
    });
  },

  async postItems(refno: string, itemIds: number[]): Promise<void> {
    const ctx = getUserContext();
    await requestApi(`${API_BASE_URL}/collections/${encodeURIComponent(refno)}/items/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: ctx.mainId,
        user_id: ctx.userId,
        item_ids: itemIds,
      }),
    });
  },

  async runAction(refno: string, action: CollectionAction, remarks?: string): Promise<void> {
    const ctx = getUserContext();
    const body: Record<string, unknown> = {
      main_id: ctx.mainId,
    };
    if (action === 'approverecord' || action === 'disapproverecord') {
      body.staff_id = ctx.staffId;
      if (remarks) body.remarks = remarks;
    }
    await requestApi(`${API_BASE_URL}/collections/${encodeURIComponent(refno)}/actions/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  async getSummary(filters: {
    dateType: CollectionSummaryDateType;
    dateFrom?: string;
    dateTo?: string;
    bank?: string;
    checkStatus?: string;
    customerId?: string;
    collectionType?: string;
    limit?: number;
  }): Promise<CollectionSummaryResponse> {
    const query = new URLSearchParams({
      main_id: String(API_MAIN_ID),
      date_type: filters.dateType,
    });

    if (filters.dateType === 'custom') {
      if (filters.dateFrom) query.set('date_from', filters.dateFrom);
      if (filters.dateTo) query.set('date_to', filters.dateTo);
    }
    if (filters.bank) query.set('bank', filters.bank);
    if (filters.checkStatus) query.set('check_status', filters.checkStatus);
    if (filters.customerId) query.set('customer_id', filters.customerId);
    if (filters.collectionType && filters.collectionType !== 'All') query.set('collection_type', filters.collectionType);
    query.set('limit', String(Math.min(Math.max(Number(filters.limit || 200), 1), 1000)));

    const data = await requestApi(`${API_BASE_URL}/collections/summary?${query.toString()}`);
    const collectionRows = Array.isArray(data?.collection_items) ? data.collection_items : [];
    const debitRows = Array.isArray(data?.debit_items) ? data.debit_items : [];

    return {
      date_from: String(data?.date_from || ''),
      date_to: String(data?.date_to || ''),
      collection_items: collectionRows.map((row: any) => ({
        date: String(row?.date || ''),
        customer: String(row?.customer || ''),
        dcr_no: String(row?.dcr_no || ''),
        cash: toNumber(row?.cash),
        check: toNumber(row?.check),
        tt: toNumber(row?.tt),
        less: toNumber(row?.less),
        remarks: String(row?.remarks || ''),
      })),
      collection_totals: {
        cash: toNumber(data?.collection_totals?.cash),
        check: toNumber(data?.collection_totals?.check),
        tt: toNumber(data?.collection_totals?.tt),
        less: toNumber(data?.collection_totals?.less),
      },
      debit_items: debitRows.map((row: any) => ({
        lrefno: String(row?.lrefno || ''),
        ldm_no: String(row?.ldm_no || ''),
        lcustomer_code: String(row?.lcustomer_code || ''),
        lcustomer_name: String(row?.lcustomer_name || ''),
        ldatetime: String(row?.ldatetime || ''),
        lamount: toNumber(row?.lamount),
      })),
      debit_totals: {
        amount: toNumber(data?.debit_totals?.amount),
      },
    };
  },
};
