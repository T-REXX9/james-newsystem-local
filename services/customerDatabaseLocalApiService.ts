// @ts-nocheck
import { Contact, ContactPerson, CustomerStatus, UserProfile } from '../types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8081/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // ignore parse errors
  }
  return `API request failed (${response.status})`;
};

const getUserContext = () => {
  const session = getLocalAuthSession();
  const userId = Number(session?.context?.user?.id || 1);
  return {
    mainId: API_MAIN_ID,
    userId: Number.isFinite(userId) && userId > 0 ? userId : 1,
  };
};

const mapApiStatusToUi = (row: any): CustomerStatus => {
  const debtType = String(row?.debt_type || '').trim().toLowerCase();
  const profileType = String(row?.profile_type || '').trim().toLowerCase();
  const status = toNumber(row?.status, 1);

  if (debtType === 'bad') return CustomerStatus.BLACKLISTED;
  if (profileType === 'prospect' || status === 3) return CustomerStatus.PROSPECTIVE;
  if (status === 0) return CustomerStatus.INACTIVE;
  return CustomerStatus.ACTIVE;
};

const mapUiStatusToApi = (status: CustomerStatus | string | undefined): number => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === String(CustomerStatus.INACTIVE).toLowerCase()) return 0;
  if (normalized === String(CustomerStatus.PROSPECTIVE).toLowerCase()) return 3;
  return 1;
};

const splitName = (fullName: string): { first_name: string; last_name: string } => {
  const trimmed = String(fullName || '').trim();
  if (!trimmed) return { first_name: '', last_name: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return {
    first_name: parts.slice(0, -1).join(' '),
    last_name: parts[parts.length - 1],
  };
};

const mapApiContactPerson = (row: any, index: number): ContactPerson => {
  const firstName = String(row?.lfname || row?.first_name || '').trim();
  const lastName = String(row?.llname || row?.last_name || '').trim();
  const composedName = `${firstName} ${lastName}`.trim();
  return {
    id: String(row?.id ?? row?.lid ?? `cp-${index}`),
    enabled: true,
    name: composedName || firstName || 'N/A',
    position: String(row?.lposition || row?.position || ''),
    birthday: String(row?.lbday || row?.birthday || ''),
    telephone: String(row?.lc_phone || row?.phone || ''),
    mobile: String(row?.lc_mobile || row?.mobile || ''),
    email: String(row?.lemail || row?.email || ''),
  };
};

const mapApiCustomerToContact = (row: any): Contact => {
  const contactPersonsRaw = Array.isArray(row?.contacts)
    ? row.contacts
    : Array.isArray(row?.contact_persons)
      ? row.contact_persons
      : [];
  const contactPersons = contactPersonsRaw.map(mapApiContactPerson);
  const primary = contactPersons[0];
  const status = mapApiStatusToUi(row);
  const company = String(row?.company || row?.lcompany || '').trim();
  const salesPersonName = String(row?.sales_person_name || row?.salesman || row?.assigned_to || '').trim();
  const salesPersonId = String(row?.sales_person_id || row?.lsales_person || '').trim();
  const resolvedSalesName = salesPersonName || salesPersonId;

  return {
    id: String(row?.session_id ?? row?.lsessionid ?? row?.id ?? ''),
    company,
    customerSince: String(row?.dealer_since || row?.date_registered || row?.ldatereg || ''),
    team: String((row as any)?.team || ''),
    salesman: resolvedSalesName,
    referBy: String(row?.refer_by || ''),
    address: String(row?.address || ''),
    province: String(row?.province || ''),
    city: String(row?.city || ''),
    area: String(row?.area || ''),
    deliveryAddress: String(row?.delivery_address || row?.address || ''),
    tin: String(row?.tin || ''),
    priceGroup: String(row?.price_group || ''),
    businessLine: String(row?.business_line || ''),
    terms: String(row?.terms || ''),
    transactionType: String(row?.transaction_type || ''),
    vatType: String(row?.vat_type || ''),
    vatPercentage: String(toNumber(row?.vat_percent, 0.12) * 100),
    dealershipTerms: String(row?.dealer_terms || ''),
    dealershipSince: String(row?.dealer_since || ''),
    dealershipQuota: toNumber(row?.dealer_quota, 0),
    creditLimit: toNumber(row?.credit_limit, 0),
    status,
    isHidden: toNumber(row?.status, 1) === 0,
    debtType: String(row?.debt_type || 'Good').toLowerCase() === 'bad' ? 'Bad' : 'Good',
    comment: String(row?.notes || ''),
    contactPersons,
    name: primary?.name || company || 'N/A',
    title: primary?.position || '',
    email: primary?.email || '',
    phone: primary?.telephone || primary?.mobile || '',
    mobile: primary?.mobile || '',
    avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(String(row?.session_id ?? row?.id ?? company ?? Date.now()))}`,
    dealValue: 0,
    stage: 'New' as any,
    lastContactDate: String(row?.date_registered || ''),
    interactions: [],
    comments: [],
    salesHistory: [],
    topProducts: [],
    assignedAgent: resolvedSalesName,
    balance: toNumber(row?.latest_balance, 0),
    totalSales: 0,
    salesByYear: {},
    is_deleted: false,
    updated_at: '',
    __salesPersonId: salesPersonId,
  } as Contact;
};

const mapContactPayloadToApi = (contact: Partial<Contact>) => {
  const status = mapUiStatusToApi(contact?.status as CustomerStatus | undefined);
  const debtType = String(contact?.debtType || 'Good');
  const resolvedSalesPerson = String((contact as any)?.__salesPersonId || contact?.salesman || '').trim();

  return {
    company: String(contact?.company || ''),
    sales_person_id: resolvedSalesPerson,
    refer_by: String(contact?.referBy || ''),
    address: String(contact?.address || ''),
    delivery_address: String(contact?.deliveryAddress || contact?.address || ''),
    area: String(contact?.area || ''),
    city: String(contact?.city || ''),
    province: String(contact?.province || ''),
    tin: String(contact?.tin || ''),
    price_group: String(contact?.priceGroup || ''),
    business_line: String(contact?.businessLine || ''),
    terms: String(contact?.terms || ''),
    transaction_type: String(contact?.transactionType || 'Order Slip'),
    vat_type: String(contact?.vatType || 'Zero-Rated'),
    vat_percent: toNumber(contact?.vatPercentage, 12) / 100,
    dealer_since: String(contact?.dealershipSince || contact?.customerSince || ''),
    dealer_quota: toNumber(contact?.dealershipQuota, 0),
    credit_limit: toNumber(contact?.creditLimit, 0),
    status,
    notes: String(contact?.comment || ''),
    debt_type: debtType,
    profile_type: status === 3 ? 'Prospect' : 'Old',
  };
};

const mapContactPersonPayloadToApi = (cp: ContactPerson) => {
  const parts = splitName(cp?.name || '');
  return {
    first_name: parts.first_name || String(cp?.name || ''),
    middle_name: '',
    last_name: parts.last_name || '',
    position: String(cp?.position || ''),
    phone: String(cp?.telephone || ''),
    mobile: String(cp?.mobile || ''),
    email: String(cp?.email || ''),
    address: '',
    birthday: String(cp?.birthday || ''),
  };
};

const mergeContactPersons = (existing: ContactPerson[] = [], incoming: ContactPerson[] = []): ContactPerson[] => {
  const merged = [...existing];
  const seen = new Set(existing.map((cp) => String(cp?.id || '').trim()).filter(Boolean));

  incoming.forEach((cp) => {
    const id = String(cp?.id || '').trim();
    if (id && seen.has(id)) return;
    if (id) seen.add(id);
    merged.push(cp);
  });

  return merged;
};

const mergeContactRecords = (base: Contact, next: Contact): Contact => {
  const pick = (primary: any, fallback: any) => {
    const value = typeof primary === 'string' ? primary.trim() : primary;
    if (value === '' || value === null || value === undefined) return fallback;
    return primary;
  };

  return {
    ...base,
    ...next,
    company: pick(next.company, base.company),
    name: pick(next.name, base.name),
    email: pick(next.email, base.email),
    phone: pick(next.phone, base.phone),
    mobile: pick(next.mobile, base.mobile),
    city: pick(next.city, base.city),
    area: pick(next.area, base.area),
    province: pick(next.province, base.province),
    address: pick(next.address, base.address),
    contactPersons: mergeContactPersons(base.contactPersons || [], next.contactPersons || []),
  };
};

const requestJson = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
  return response.json();
};

export const fetchContacts = async (): Promise<Contact[]> => {
  try {
    const perPage = 500;
    let page = 1;
    let totalPages = 1;
    const merged: Contact[] = [];

    while (page <= totalPages) {
      const query = new URLSearchParams({
        main_id: String(API_MAIN_ID),
        status: 'all',
        search: '',
        page: String(page),
        per_page: String(perPage),
      });
      const payload = await requestJson(`${API_BASE_URL}/customer-database?${query.toString()}`);
      const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
      merged.push(...rows.map(mapApiCustomerToContact));
      totalPages = toNumber(payload?.data?.meta?.total_pages, 1);
      page += 1;
    }

    const dedupedById = new Map<string, Contact>();
    const contactsWithoutId: Contact[] = [];

    merged.forEach((contact) => {
      const id = String(contact?.id || '').trim();
      if (!id) {
        contactsWithoutId.push(contact);
        return;
      }

      const existing = dedupedById.get(id);
      if (!existing) {
        dedupedById.set(id, contact);
        return;
      }

      dedupedById.set(id, mergeContactRecords(existing, contact));
    });

    return [...dedupedById.values(), ...contactsWithoutId];
  } catch (err) {
    console.error('Error fetching contacts via local API:', err);
    return [];
  }
};

export const createContact = async (contact: Omit<Contact, 'id'>): Promise<Contact> => {
  const { mainId, userId } = getUserContext();
  const payload = {
    main_id: mainId,
    user_id: userId,
    ...mapContactPayloadToApi(contact),
    contacts: (contact?.contactPersons || [])
      .filter((cp) => String(cp?.name || '').trim() !== '')
      .map((cp) => mapContactPersonPayloadToApi(cp)),
  };

  const created = await requestJson(`${API_BASE_URL}/customer-database`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return mapApiCustomerToContact(created?.data || {});
};

const syncContactPersons = async (sessionId: string, contactPersons: ContactPerson[] | undefined): Promise<void> => {
  if (!Array.isArray(contactPersons)) return;

  const detailPayload = await requestJson(
    `${API_BASE_URL}/customer-database/${encodeURIComponent(String(sessionId))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
  );
  const existingRows = Array.isArray(detailPayload?.data?.contacts) ? detailPayload.data.contacts : [];
  const existingById = new Map<string, any>();
  existingRows.forEach((row: any) => {
    const id = String(row?.id ?? row?.lid ?? '');
    if (id) existingById.set(id, row);
  });

  const seenExistingIds = new Set<string>();

  for (const cp of contactPersons) {
    const candidateId = String(cp?.id || '').trim();
    const isExisting = candidateId !== '' && /^\d+$/.test(candidateId) && existingById.has(candidateId);
    const cpPayload = {
      main_id: API_MAIN_ID,
      ...mapContactPersonPayloadToApi(cp),
    };

    if (isExisting) {
      seenExistingIds.add(candidateId);
      await requestJson(`${API_BASE_URL}/customer-database/contacts/${encodeURIComponent(candidateId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cpPayload),
      });
      continue;
    }

    if (String(cp?.name || '').trim() === '') continue;
    await requestJson(`${API_BASE_URL}/customer-database/${encodeURIComponent(String(sessionId))}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cpPayload),
    });
  }

  for (const existingId of existingById.keys()) {
    if (seenExistingIds.has(existingId)) continue;
    await requestJson(
      `${API_BASE_URL}/customer-database/contacts/${encodeURIComponent(existingId)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`,
      { method: 'DELETE' }
    );
  }
};

export const updateContact = async (id: string, updates: Partial<Contact>): Promise<void> => {
  const payload = {
    main_id: API_MAIN_ID,
    ...mapContactPayloadToApi(updates),
  };

  await requestJson(`${API_BASE_URL}/customer-database/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (updates?.contactPersons) {
    await syncContactPersons(id, updates.contactPersons);
  }
};

export const bulkUpdateContacts = async (ids: string[], updates: Partial<Contact>): Promise<void> => {
  if (!Array.isArray(ids) || ids.length === 0) return;
  for (const id of ids) {
    await updateContact(id, updates);
  }
};

export const fetchSalesAgents = async (): Promise<UserProfile[]> => {
  const contacts = await fetchContacts();
  const nameSet = new Set<string>();
  contacts.forEach((contact) => {
    const name = String(contact?.salesman || '').trim();
    if (name) nameSet.add(name);
  });

  return Array.from(nameSet)
    .sort((a, b) => a.localeCompare(b))
    .map((name, index) => ({
      id: `agent-${index + 1}`,
      email: '',
      full_name: name,
      role: 'Sales Agent',
    }));
};

export const fetchUpdatedContactDetails = async (_contactId: string): Promise<any[]> => {
  return [];
};

export const fetchContactTransactions = async (contactId: string): Promise<any[]> => {
  try {
    const payload = await requestJson(
      `${API_BASE_URL}/customers/${encodeURIComponent(String(contactId))}/purchase-history`
    );
    const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    return rows.map((row: any, index: number) => {
      const sourceType = String(row?.source_type || '').toUpperCase();
      const txType = sourceType === 'INVOICE' ? 'invoice' : 'order_slip';
      const amount = toNumber(row?.lqty, 0) * toNumber(row?.lprice, 0);
      const sourceRefNo = String(row?.source_refno || '').trim();
      const sourceNo = String(row?.source_no || '').trim();
      const lineId = String(row?.line_id ?? row?.id ?? row?.lid ?? '').trim();
      return {
        id: [sourceType || 'TX', sourceRefNo || sourceNo || 'na', lineId || String(index)].join(':'),
        type: txType,
        number: sourceNo,
        date: String(row?.ldate || ''),
        amount,
        status: 'finalized',
        label: `${sourceType || 'TRANSACTION'} ${row?.source_no || ''}`.trim(),
      };
    });
  } catch (err) {
    console.error('Error fetching contact transactions via local API:', err);
    return [];
  }
};

export const fetchCustomerMetrics = async (contactId: string): Promise<any | null> => {
  try {
    const [customerPayload, purchasePayload] = await Promise.all([
      requestJson(`${API_BASE_URL}/customers/${encodeURIComponent(String(contactId))}`),
      requestJson(`${API_BASE_URL}/customers/${encodeURIComponent(String(contactId))}/purchase-history`),
    ]);

    const customer = customerPayload?.data || {};
    const rows = Array.isArray(purchasePayload?.data?.items) ? purchasePayload.data.items : [];
    const total = rows.reduce((sum: number, row: any) => {
      return sum + toNumber(row?.lqty, 0) * toNumber(row?.lprice, 0);
    }, 0);
    const avg = rows.length > 0 ? total / rows.length : 0;

    return {
      contact_id: contactId,
      total_purchases: total,
      average_order_value: avg,
      last_purchase_date: rows[0]?.ldate || null,
      outstanding_balance: toNumber(customer?.latest_balance, 0),
      credit_limit: toNumber(customer?.lcredit, 0),
      currency: 'PHP',
    };
  } catch (err) {
    console.error('Error fetching customer metrics via local API:', err);
    return null;
  }
};
