const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

type OwnerSnapshot = {
  contacts?: any[];
  purchases?: any[];
  inquiries?: any[];
  profiles?: any[];
};

export type ManagementDashboardData = {
  team: any[];
  city: any[];
  status: any[];
  payment: any[];
  inactive: any[];
  criticalInactive: any[];
  inquiryOnly: any[];
};

const normalizeDate = (value: unknown): Date | null => {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
};

const isMonth = (date: Date | null, year: number, month: number): boolean =>
  !!date && date.getFullYear() === year && date.getMonth() + 1 === month;

const previousPeriod = (year: number, month: number) =>
  month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

const finalizePerformance = (values: Iterable<any>) => Array.from(values).map((row: any) => ({
  ...row,
  customerCount: row.customerIds instanceof Set ? row.customerIds.size : Number(row.customerCount || 0),
  salesChange: row.currentMonthSales - row.previousMonthSales,
  percentageChange: row.previousMonthSales > 0
    ? ((row.currentMonthSales - row.previousMonthSales) / row.previousMonthSales) * 100
    : 0,
  customerIds: undefined,
}));

export const buildManagementDashboardData = (
  snapshot: OwnerSnapshot,
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
  const previous = previousPeriod(year, month);
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
    const date = normalizeDate(purchase.purchase_date);
    const amount = Number(purchase.total_amount || 0);
    if (date && (!latestPurchase.has(contactId) || date > latestPurchase.get(contactId)!)) latestPurchase.set(contactId, date);
    purchaseCounts.set(contactId, (purchaseCounts.get(contactId) || 0) + 1);

    const period = isMonth(date, year, month) ? 'current' : isMonth(date, previous.year, previous.month) ? 'previous' : null;
    if (!period) continue;

    const salesmanId = String(contact.salesman || contact.assignedAgent || '');
    const salesmanName = profiles.get(salesmanId) || 'Unassigned';
    const cityName = String(contact.city || '').trim();
    const normalizedCity = !cityName || cityName.toLowerCase() === 'null' ? 'Unknown' : cityName;
    const rawStatus = String(contact.status || 'Unknown').trim();
    const normalizedStatus = rawStatus ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase() : 'Unknown';

    addPerformance(team, salesmanName, { salesPersonName: salesmanName }, amount, period, contactId);
    addPerformance(city, normalizedCity, { city: normalizedCity }, amount, period, contactId);
    addPerformance(status, normalizedStatus, { status: normalizedStatus }, amount, period, contactId);
    addPerformance(payment, 'All Transactions', { paymentType: 'All Transactions' }, amount, period, contactId);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - inactiveDays);
  const inactive = contacts.filter((contact: any) => {
    const last = latestPurchase.get(String(contact.id));
    return String(contact.status || '').toLowerCase() === 'inactive' || (!!last && last <= cutoff);
  }).map((contact: any) => ({
    ...contact,
    customer_metrics: {
      last_purchase_date: latestPurchase.get(String(contact.id))?.toISOString().slice(0, 10) || null,
      outstanding_balance: Number(contact.balance || 0),
    },
  }));
  const criticalInactive = inactive.filter((contact: any) => Number(contact.balance || 0) > 0);
  const inquiryCounts = new Map<string, number>();
  for (const inquiry of inquiries) {
    const contactId = String(inquiry.contact_id || '');
    inquiryCounts.set(contactId, (inquiryCounts.get(contactId) || 0) + 1);
  }
  const inquiryOnly = contacts.flatMap((contact: any) => {
    const contactId = String(contact.id || '');
    const totalInquiries = inquiryCounts.get(contactId) || 0;
    const totalPurchases = purchaseCounts.get(contactId) || 0;
    if (totalInquiries === 0 || (totalPurchases > 0 && totalInquiries / totalPurchases < minInquiryRatio)) return [];
    return [{
      ...contact,
      totalInquiries,
      totalPurchases,
      inquiryToPurchaseRatio: totalPurchases === 0 ? 'Infinity' : (totalInquiries / totalPurchases).toFixed(2),
    }];
  });

  return {
    team: finalizePerformance(team.values()).sort((a, b) => b.currentMonthSales - a.currentMonthSales),
    city: finalizePerformance(city.values()).sort((a, b) => b.currentMonthSales - a.currentMonthSales),
    status: finalizePerformance(status.values()),
    payment: finalizePerformance(payment.values()),
    inactive,
    criticalInactive,
    inquiryOnly,
  };
};

export const fetchManagementDashboardData = async (
  mainId: number,
  year: number,
  month: number,
): Promise<ManagementDashboardData> => {
  const response = await fetch(`${API_BASE_URL}/daily-call-monitoring/owner-snapshot?main_id=${encodeURIComponent(mainId)}`);
  if (!response.ok) throw new Error(`Management dashboard request failed (${response.status})`);
  const payload = await response.json();
  return buildManagementDashboardData(payload?.data || {}, year, month);
};
