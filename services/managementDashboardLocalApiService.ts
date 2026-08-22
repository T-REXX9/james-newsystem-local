const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

export type DashboardKpis = {
  totalSalesYtd: number;
  totalCollectionsYtd: number;
  outstandingReceivables: number;
  activeCustomers: number;
};

export type MonthlySalesPoint = {
  month: number;
  sales: number;
  collections: number;
};

export type RankedCustomer = {
  customerName: string;
  amount: number;
};

export type RankedSalesperson = {
  salesperson: string;
  amount: number;
};

export type ItemPerformance = {
  itemCode: string;
  partNo: string;
  description: string;
  qtyYtd: number;
  qtyMtd: number;
};

export type ManagementDashboardData = {
  year: number;
  month: number;
  kpis: DashboardKpis;
  monthlySales: MonthlySalesPoint[];
  topCustomers: RankedCustomer[];
  topSalespeople: RankedSalesperson[];
  bestItems: ItemPerformance[];
  worstItems: ItemPerformance[];
  // Kept for compatibility with existing callers of the previous management view.
  team: any[];
  city: any[];
  status: any[];
  payment: any[];
  inactive: any[];
  criticalInactive: any[];
  inquiryOnly: any[];
};

const toNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const cleanText = (value: unknown, fallback: string): string => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const normalizeDashboardData = (data: any, requestedYear: number): ManagementDashboardData => {
  const year = toNumber(data?.year) || requestedYear;
  const month = toNumber(data?.month) || new Date().getMonth() + 1;
  const kpis = data?.kpis || {};
  const monthlyRows = Array.isArray(data?.monthly_sales) ? data.monthly_sales : [];
  const monthlyByMonth = new Map(monthlyRows.map((row: any) => [toNumber(row?.month), row]));
  const monthlySales = Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1;
    const row = monthlyByMonth.get(monthNumber) || {};
    return {
      month: monthNumber,
      sales: toNumber(row?.sales),
      collections: toNumber(row?.collections),
    };
  });

  const topCustomers = (Array.isArray(data?.top_customers) ? data.top_customers : []).map((row: any) => ({
    customerName: cleanText(row?.customer_name ?? row?.customerName, 'Unnamed Customer'),
    amount: toNumber(row?.amount),
  }));
  const topSalespeople = (Array.isArray(data?.top_salespeople) ? data.top_salespeople : []).map((row: any) => ({
    salesperson: cleanText(row?.salesperson, 'Unassigned'),
    amount: toNumber(row?.amount),
  }));
  const itemPerformance = (Array.isArray(data?.item_performance) ? data.item_performance : []).map((row: any) => ({
    itemCode: cleanText(row?.item_code ?? row?.itemCode, '—'),
    partNo: cleanText(row?.part_no ?? row?.partNo, '—'),
    description: cleanText(row?.description, '—'),
    qtyYtd: toNumber(row?.qty_ytd ?? row?.qtyYtd),
    qtyMtd: toNumber(row?.qty_mtd ?? row?.qtyMtd),
  }));

  return {
    year,
    month,
    kpis: {
      totalSalesYtd: toNumber(kpis.total_sales_ytd ?? kpis.totalSalesYtd),
      totalCollectionsYtd: toNumber(kpis.total_collections_ytd ?? kpis.totalCollectionsYtd),
      outstandingReceivables: toNumber(kpis.outstanding_receivables ?? kpis.outstandingReceivables),
      activeCustomers: toNumber(kpis.active_customers ?? kpis.activeCustomers),
    },
    monthlySales,
    topCustomers,
    topSalespeople,
    bestItems: itemPerformance.slice(0, 10),
    worstItems: [...itemPerformance].sort((a, b) => a.qtyYtd - b.qtyYtd || a.itemCode.localeCompare(b.itemCode)).slice(0, 10),
    team: Array.isArray(data?.team) ? data.team : [],
    city: Array.isArray(data?.city) ? data.city : [],
    status: Array.isArray(data?.status) ? data.status : [],
    payment: Array.isArray(data?.payment) ? data.payment : [],
    inactive: Array.isArray(data?.inactive) ? data.inactive : [],
    criticalInactive: Array.isArray(data?.criticalInactive) ? data.criticalInactive : [],
    inquiryOnly: Array.isArray(data?.inquiryOnly) ? data.inquiryOnly : [],
  };
};

export const buildManagementDashboardData = (
  snapshot: { contacts?: any[]; purchases?: any[]; inquiries?: any[]; profiles?: any[] },
  year: number,
  month: number,
  inactiveDays = 30,
  minInquiryRatio = 2,
): ManagementDashboardData => {
  const contacts = Array.isArray(snapshot.contacts) ? snapshot.contacts : [];
  const purchases = Array.isArray(snapshot.purchases) ? snapshot.purchases : [];
  const inquiries = Array.isArray(snapshot.inquiries) ? snapshot.inquiries : [];
  const profiles = new Map((snapshot.profiles || []).map((profile: any) => [String(profile.id), profile.full_name || `User ${profile.id}`]));
  const contactsById = new Map(contacts.map((contact: any) => [String(contact.id), contact]));
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  const team = new Map<string, any>();
  const city = new Map<string, any>();
  const status = new Map<string, any>();
  const payment = new Map<string, any>();
  const latestPurchase = new Map<string, Date>();
  const purchaseCounts = new Map<string, number>();
  const addPerformance = (map: Map<string, any>, key: string, base: any, amount: number, period: 'current' | 'previous', contactId: string) => {
    if (!map.has(key)) map.set(key, { ...base, currentMonthSales: 0, previousMonthSales: 0, customerIds: new Set<string>() });
    const row = map.get(key);
    row[period === 'current' ? 'currentMonthSales' : 'previousMonthSales'] += amount;
    row.customerIds.add(contactId);
  };
  for (const purchase of purchases) {
    const contactId = String(purchase.contact_id || '');
    const contact = contactsById.get(contactId) || {};
    const date = new Date(String(purchase.purchase_date || ''));
    const validDate = Number.isNaN(date.getTime()) ? null : date;
    const amount = Number(purchase.total_amount || 0);
    if (validDate && (!latestPurchase.has(contactId) || validDate > latestPurchase.get(contactId)!)) latestPurchase.set(contactId, validDate);
    purchaseCounts.set(contactId, (purchaseCounts.get(contactId) || 0) + 1);
    if (!validDate) continue;
    const period = validDate.getFullYear() === year && validDate.getMonth() + 1 === month ? 'current' : validDate.getFullYear() === previousYear && validDate.getMonth() + 1 === previousMonth ? 'previous' : null;
    if (!period) continue;
    const salesmanName = profiles.get(String(contact.salesman || contact.assignedAgent || '')) || 'Unassigned';
    const cityName = String(contact.city || '').trim() || 'Unknown';
    const rawStatus = String(contact.status || 'Unknown').trim();
    const normalizedStatus = rawStatus ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase() : 'Unknown';
    addPerformance(team, salesmanName, { salesPersonName: salesmanName }, amount, period, contactId);
    addPerformance(city, cityName, { city: cityName }, amount, period, contactId);
    addPerformance(status, normalizedStatus, { status: normalizedStatus }, amount, period, contactId);
    addPerformance(payment, 'All Transactions', { paymentType: 'All Transactions' }, amount, period, contactId);
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - inactiveDays);
  const inactive = contacts.filter((contact: any) => {
    const last = latestPurchase.get(String(contact.id));
    return String(contact.status || '').toLowerCase() === 'inactive' || (!!last && last <= cutoff);
  }).map((contact: any) => ({ ...contact, customer_metrics: [{ last_purchase_date: latestPurchase.get(String(contact.id))?.toISOString().slice(0, 10) || null, outstanding_balance: Number(contact.balance || 0) }] }));
  const inquiryCounts = new Map<string, number>();
  for (const inquiry of inquiries) inquiryCounts.set(String(inquiry.contact_id || ''), (inquiryCounts.get(String(inquiry.contact_id || '')) || 0) + 1);
  const inquiryOnly = contacts.flatMap((contact: any) => {
    const contactId = String(contact.id || '');
    const totalInquiries = inquiryCounts.get(contactId) || 0;
    const totalPurchases = purchaseCounts.get(contactId) || 0;
    if (totalInquiries === 0 || (totalPurchases > 0 && totalInquiries / totalPurchases < minInquiryRatio)) return [];
    return [{ ...contact, totalInquiries, totalPurchases, inquiryToPurchaseRatio: totalPurchases === 0 ? 'Infinity' : (totalInquiries / totalPurchases).toFixed(2) }];
  });
  const finalize = (values: Iterable<any>) => Array.from(values).map((row: any) => ({ ...row, customerCount: row.customerIds instanceof Set ? row.customerIds.size : 0, salesChange: row.currentMonthSales - row.previousMonthSales, percentageChange: row.previousMonthSales > 0 ? ((row.currentMonthSales - row.previousMonthSales) / row.previousMonthSales) * 100 : 0 }));
  const monthlySales = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, sales: purchases.filter((purchase: any) => { const date = new Date(String(purchase.purchase_date || '')); return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === index; }).reduce((sum, purchase) => sum + Number(purchase.total_amount || 0), 0), collections: 0 }));
  const totalSalesYtd = monthlySales.reduce((sum, row) => sum + row.sales, 0);
  return { year, month, kpis: { totalSalesYtd, totalCollectionsYtd: 0, outstandingReceivables: contacts.reduce((sum, contact) => sum + Number(contact.balance || 0), 0), activeCustomers: contacts.filter((contact) => String(contact.status || '').toLowerCase() === 'active').length }, monthlySales, topCustomers: [], topSalespeople: [], bestItems: [], worstItems: [], team: finalize(team.values()).sort((a, b) => b.currentMonthSales - a.currentMonthSales), city: finalize(city.values()), status: finalize(status.values()), payment: finalize(payment.values()), inactive, criticalInactive: inactive.filter((contact: any) => Number(contact.balance || 0) > 0), inquiryOnly };
};

export const fetchManagementDashboardData = async (
  mainId: number,
  year: number,
  _month: number,
): Promise<ManagementDashboardData> => {
  const query = new URLSearchParams({
    main_id: String(mainId),
    year: String(year),
  });
  const response = await fetch(`${API_BASE_URL}/daily-call-monitoring/sales-performance-dashboard?${query.toString()}`);
  if (!response.ok) throw new Error(`Sales performance dashboard request failed (${response.status})`);
  const payload = await response.json();
  return normalizeDashboardData(payload?.data || {}, year);
};
