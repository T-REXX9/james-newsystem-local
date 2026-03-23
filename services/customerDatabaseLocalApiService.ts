import { DEFAULT_CUSTOMER_VAT_TYPE } from '../constants/customerVat';
import { normalizePriceGroup } from '../constants/pricingGroups';
import { Contact, ContactPerson, CustomerStatus, CustomerVatType, DealStage, UserProfile } from '../types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

type ApiCustomerStatus = 0 | 1 | 3 | number;

interface ApiContactPersonRow {
  id?: string | number | null;
  lid?: string | number | null;
  lfname?: string | null;
  first_name?: string | null;
  llname?: string | null;
  last_name?: string | null;
  lposition?: string | null;
  position?: string | null;
  lbday?: string | null;
  birthday?: string | null;
  lc_phone?: string | null;
  phone?: string | null;
  lc_mobile?: string | null;
  mobile?: string | null;
  lemail?: string | null;
  email?: string | null;
}

interface ApiCustomerRow {
  session_id?: string | number | null;
  lsessionid?: string | number | null;
  id?: string | number | null;
  company?: string | null;
  lcompany?: string | null;
  email?: string | null;
  lemail?: string | null;
  phone?: string | null;
  lphone?: string | null;
  mobile?: string | null;
  lmobile?: string | null;
  dealer_since?: string | null;
  date_registered?: string | null;
  ldatereg?: string | null;
  team?: string | null;
  sales_person_name?: string | null;
  salesman?: string | null;
  assigned_to?: string | null;
  sales_person_id?: string | number | null;
  lsales_person?: string | number | null;
  refer_by?: string | null;
  address?: string | null;
  province?: string | null;
  city?: string | null;
  area?: string | null;
  delivery_address?: string | null;
  tin?: string | null;
  price_group?: string | null;
  pricing_tier?: string | null;
  business_line?: string | null;
  terms?: string | null;
  transaction_type?: string | null;
  vat_type?: string | null;
  vat_percent?: string | number | null;
  dealer_terms?: string | null;
  dealer_quota?: string | number | null;
  credit_limit?: string | number | null;
  latest_balance?: string | number | null;
  status?: ApiCustomerStatus | null;
  debt_type?: string | null;
  profile_type?: string | null;
  notes?: string | null;
  contacts?: ApiContactPersonRow[] | null;
  contact_persons?: ApiContactPersonRow[] | null;
  terms_history?: ApiCustomerTermsRow[] | null;
}

interface ApiCustomerDatabaseResponse {
  data?: {
    items?: ApiCustomerRow[];
    meta?: {
      total_pages?: number | string | null;
    };
    contacts?: ApiContactPersonRow[];
  };
}

interface ApiTransactionRow {
  source_type?: string | null;
  lqty?: string | number | null;
  lprice?: string | number | null;
  source_refno?: string | null;
  source_no?: string | null;
  line_id?: string | number | null;
  id?: string | number | null;
  lid?: string | number | null;
  ldate?: string | null;
}

interface ApiPurchaseHistoryResponse {
  data?: {
    items?: ApiTransactionRow[];
  };
}

interface ApiCustomerMetricsRow {
  latest_balance?: string | number | null;
  lcredit?: string | number | null;
}

interface ApiCustomerMetricsResponse {
  data?: ApiCustomerMetricsRow;
}

interface ApiCustomerTermsRow {
  id?: string | number | null;
  lid?: string | number | null;
  since?: string | null;
  lsince?: string | null;
  class_code?: string | null;
  lclasscode?: string | null;
  quota?: string | number | null;
  lquota?: string | number | null;
  terms?: string | number | null;
  lterms?: string | number | null;
  status?: string | null;
  lstatus?: string | null;
}

interface ApiCustomerTermsResponse {
  data?: {
    items?: ApiCustomerTermsRow[];
  };
}

interface ApiCustomerDetailResponse {
  data?: ApiCustomerRow;
}

type ContactPayloadWithSalesPersonId = Partial<Contact> & {
  __salesPersonId?: string;
};

type LocalContact = Contact & {
  __salesPersonId?: string;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const sanitizeLegacyString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim();
  if (!normalized) return '';
  if (normalized.toLowerCase() === 'null') return '';
  if (normalized.toLowerCase() === 'undefined') return '';
  return normalized;
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

const mapApiStatusToUi = (row: ApiCustomerRow): CustomerStatus => {
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

const normalizeVatType = (value: unknown): CustomerVatType => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'exclusive') return 'Exclusive';
  if (normalized === 'inclusive') return 'Inclusive';
  if (normalized === 'zero-rated' || normalized === 'zero rated' || normalized === 'zerorated') return 'Zero-Rated';
  return DEFAULT_CUSTOMER_VAT_TYPE;
};

const mapApiContactPerson = (row: ApiContactPersonRow, index: number): ContactPerson => {
  const firstName = sanitizeLegacyString(row?.lfname || row?.first_name || '');
  const lastName = sanitizeLegacyString(row?.llname || row?.last_name || '');
  const composedName = `${firstName} ${lastName}`.trim();
  return {
    id: String(row?.id ?? row?.lid ?? `cp-${index}`),
    enabled: true,
    name: composedName || firstName || 'N/A',
    position: sanitizeLegacyString(row?.lposition || row?.position || ''),
    birthday: sanitizeLegacyString(row?.lbday || row?.birthday || ''),
    telephone: sanitizeLegacyString(row?.lc_phone || row?.phone || ''),
    mobile: sanitizeLegacyString(row?.lc_mobile || row?.mobile || ''),
    email: sanitizeLegacyString(row?.lemail || row?.email || ''),
  };
};

const mapApiCustomerToContact = (row: ApiCustomerRow): LocalContact => {
  const contactPersonsRaw = Array.isArray(row?.contacts)
    ? row.contacts
    : Array.isArray(row?.contact_persons)
      ? row.contact_persons
      : [];
  const contactPersons = contactPersonsRaw.map(mapApiContactPerson);
  const primary = contactPersons[0];
  const status = mapApiStatusToUi(row);
  const company = sanitizeLegacyString(row?.company || row?.lcompany || '');
  const salesPersonName = sanitizeLegacyString(row?.sales_person_name || row?.salesman || row?.assigned_to || '');
  const salesPersonId = sanitizeLegacyString(row?.sales_person_id || row?.lsales_person || '');
  const resolvedSalesName = salesPersonName || salesPersonId;
  const fallbackEmail = sanitizeLegacyString(row?.email || row?.lemail || '');
  const fallbackPhone = sanitizeLegacyString(row?.phone || row?.lphone || '');
  const fallbackMobile = sanitizeLegacyString(row?.mobile || row?.lmobile || '');

  return {
    id: String(row?.session_id ?? row?.lsessionid ?? row?.id ?? ''),
    company,
    customerSince: sanitizeLegacyString(row?.dealer_since || row?.date_registered || row?.ldatereg || ''),
    team: sanitizeLegacyString(row?.team || ''),
    salesman: resolvedSalesName,
    referBy: sanitizeLegacyString(row?.refer_by || ''),
    address: sanitizeLegacyString(row?.address || ''),
    province: sanitizeLegacyString(row?.province || ''),
    city: sanitizeLegacyString(row?.city || ''),
    area: sanitizeLegacyString(row?.area || ''),
    deliveryAddress: sanitizeLegacyString(row?.delivery_address || row?.address || ''),
    tin: sanitizeLegacyString(row?.tin || ''),
    priceGroup: row?.pricing_tier ? sanitizeLegacyString(row.pricing_tier) : normalizePriceGroup(sanitizeLegacyString(row?.price_group || '')),
    businessLine: sanitizeLegacyString(row?.business_line || ''),
    terms: sanitizeLegacyString(row?.terms || ''),
    transactionType: sanitizeLegacyString(row?.transaction_type || ''),
    vatType: normalizeVatType(row?.vat_type),
    vatPercentage: String(toNumber(row?.vat_percent, 0.12) * 100),
    dealershipTerms: sanitizeLegacyString(row?.dealer_terms || ''),
    dealershipSince: sanitizeLegacyString(row?.dealer_since || ''),
    dealershipQuota: toNumber(row?.dealer_quota, 0),
    creditLimit: toNumber(row?.credit_limit, 0),
    status,
    isHidden: toNumber(row?.status, 1) === 0,
    debtType: String(row?.debt_type || 'Good').toLowerCase() === 'bad' ? 'Bad' : 'Good',
    comment: sanitizeLegacyString(row?.notes || ''),
    contactPersons,
    name: primary?.name || company || 'N/A',
    title: primary?.position || '',
    email: primary?.email || fallbackEmail,
    phone: primary?.telephone || primary?.mobile || fallbackPhone || fallbackMobile,
    mobile: primary?.mobile || fallbackMobile,
    avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(String(row?.session_id ?? row?.id ?? company ?? Date.now()))}`,
    dealValue: 0,
    stage: DealStage.NEW,
    lastContactDate: sanitizeLegacyString(row?.date_registered || ''),
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
  };
};

const mapContactPayloadToApi = (contact: ContactPayloadWithSalesPersonId) => {
  const status = mapUiStatusToApi(contact?.status as CustomerStatus | undefined);
  const debtType = String(contact?.debtType || 'Good');
  const resolvedSalesPerson = String(contact?.__salesPersonId || contact?.salesman || '').trim();

  return {
    company: String(contact?.company || ''),
    email: String(contact?.email || ''),
    phone: String(contact?.phone || ''),
    mobile: String(contact?.mobile || ''),
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
    vat_type: String(contact?.vatType || DEFAULT_CUSTOMER_VAT_TYPE),
    vat_percent: toNumber(contact?.vatPercentage, 12) / 100,
    dealer_since: String(contact?.dealershipSince || ''),
    dealer_quota: toNumber(contact?.dealershipQuota, 0),
    credit_limit: toNumber(contact?.creditLimit, 0),
    status,
    notes: String(contact?.comment || ''),
    debt_type: debtType,
    profile_type: status === 3 ? 'Prospect' : 'Old',
  };
};

const hasOwn = <K extends string>(value: object, key: K): boolean => Object.prototype.hasOwnProperty.call(value, key);

const mapContactUpdatesToApi = (contact: Partial<ContactPayloadWithSalesPersonId>) => {
  const payload: Record<string, unknown> = {};

  if (hasOwn(contact, 'company')) payload.company = String(contact.company || '');
  if (hasOwn(contact, 'email')) payload.email = String(contact.email || '');
  if (hasOwn(contact, 'phone')) payload.phone = String(contact.phone || '');
  if (hasOwn(contact, 'mobile')) payload.mobile = String(contact.mobile || '');

  if (hasOwn(contact, '__salesPersonId') || hasOwn(contact, 'salesman') || hasOwn(contact, 'assignedAgent')) {
    payload.sales_person_id = String(contact.__salesPersonId || contact.salesman || contact.assignedAgent || '').trim();
  }

  if (hasOwn(contact, 'referBy')) payload.refer_by = String(contact.referBy || '');
  if (hasOwn(contact, 'address')) payload.address = String(contact.address || '');
  if (hasOwn(contact, 'deliveryAddress')) payload.delivery_address = String(contact.deliveryAddress || '');
  if (hasOwn(contact, 'area')) payload.area = String(contact.area || '');
  if (hasOwn(contact, 'city')) payload.city = String(contact.city || '');
  if (hasOwn(contact, 'province')) payload.province = String(contact.province || '');
  if (hasOwn(contact, 'tin')) payload.tin = String(contact.tin || '');
  if (hasOwn(contact, 'priceGroup')) payload.price_group = String(contact.priceGroup || '');
  if (hasOwn(contact, 'businessLine')) payload.business_line = String(contact.businessLine || '');
  if (hasOwn(contact, 'terms')) payload.terms = String(contact.terms || '');
  if (hasOwn(contact, 'transactionType')) payload.transaction_type = String(contact.transactionType || '');
  if (hasOwn(contact, 'vatType')) payload.vat_type = String(contact.vatType || '');
  if (hasOwn(contact, 'vatPercentage')) payload.vat_percent = toNumber(contact.vatPercentage, 12) / 100;
  if (hasOwn(contact, 'dealershipSince')) payload.dealer_since = String(contact.dealershipSince || '');
  if (hasOwn(contact, 'dealershipQuota')) payload.dealer_quota = toNumber(contact.dealershipQuota, 0);
  if (hasOwn(contact, 'creditLimit')) payload.credit_limit = toNumber(contact.creditLimit, 0);
  if (hasOwn(contact, 'comment')) payload.notes = String(contact.comment || '');
  if (hasOwn(contact, 'debtType')) payload.debt_type = String(contact.debtType || 'Good');

  if (hasOwn(contact, 'status')) {
    const status = mapUiStatusToApi(contact.status as CustomerStatus | undefined);
    payload.status = status;
    payload.profile_type = status === 3 ? 'Prospect' : 'Old';
  } else if (hasOwn(contact, 'isHidden')) {
    payload.status = contact.isHidden ? 0 : 1;
  }

  return payload;
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
  const pick = <T,>(primary: T, fallback: T): T => {
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

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
  return (await response.json()) as T;
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
      const payload = await requestJson<ApiCustomerDatabaseResponse>(`${API_BASE_URL}/customer-database?${query.toString()}`);
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

    return [...dedupedById.values(), ...contactsWithoutId].sort((a, b) =>
      (a.company || '').localeCompare(b.company || ''),
    );
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

  const created = await requestJson<{ data?: ApiCustomerRow }>(`${API_BASE_URL}/customer-database`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return mapApiCustomerToContact(created?.data || {});
};

const syncContactPersons = async (sessionId: string, contactPersons: ContactPerson[] | undefined): Promise<void> => {
  if (!Array.isArray(contactPersons)) return;

  const detailPayload = await requestJson<ApiCustomerDatabaseResponse>(
    `${API_BASE_URL}/customer-database/${encodeURIComponent(String(sessionId))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
  );
  const existingRows = Array.isArray(detailPayload?.data?.contacts) ? detailPayload.data.contacts : [];
  const existingById = new Map<string, ApiContactPersonRow>();
  existingRows.forEach((row: ApiContactPersonRow) => {
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
    ...mapContactUpdatesToApi(updates),
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

export const fetchContactById = async (id: string): Promise<Contact | null> => {
  try {
    const payload = await requestJson<ApiCustomerDetailResponse>(
      `${API_BASE_URL}/customer-database/${encodeURIComponent(String(id))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    if (!payload?.data) return null;
    return mapApiCustomerToContact(payload.data);
  } catch (err) {
    console.error('Error fetching customer detail via local API:', err);
    return null;
  }
};

const mapApiTermRow = (row: ApiCustomerTermsRow, index: number) => ({
  id: String(row?.id ?? row?.lid ?? `term-${index}`),
  since: sanitizeLegacyString(row?.since || row?.lsince || ''),
  classCode: sanitizeLegacyString(row?.class_code || row?.lclasscode || ''),
  quota: toNumber(row?.quota ?? row?.lquota, 0),
  terms: sanitizeLegacyString((row as any)?.lname || row?.terms || row?.lterms || ''),
  status: sanitizeLegacyString(row?.status || row?.lstatus || ''),
});

export const bulkUpdateContacts = async (ids: string[], updates: Partial<Contact>): Promise<void> => {
  if (!Array.isArray(ids) || ids.length === 0) return;

  if (updates?.contactPersons) {
    const results = await Promise.allSettled(ids.map((id) => updateContact(id, updates)));
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length > 0) {
      const firstFailure = failures[0]?.reason;
      throw new Error(firstFailure instanceof Error ? firstFailure.message : 'Bulk update failed');
    }
    return;
  }

  const payload = {
    main_id: API_MAIN_ID,
    session_ids: ids.map((id) => String(id).trim()).filter(Boolean),
    updates: mapContactUpdatesToApi(updates),
  };

  await requestJson(`${API_BASE_URL}/customer-database/bulk`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
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

export const fetchUpdatedContactDetails = async (_contactId: string): Promise<never[]> => {
  return [];
};

export const fetchContactTransactions = async (contactId: string): Promise<Array<Record<string, unknown>>> => {
  try {
    const payload = await requestJson<ApiPurchaseHistoryResponse>(
      `${API_BASE_URL}/customers/${encodeURIComponent(String(contactId))}/purchase-history`
    );
    const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    return rows.map((row: ApiTransactionRow, index: number) => {
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

export const fetchCustomerMetrics = async (contactId: string): Promise<Record<string, unknown> | null> => {
  try {
    const [customerPayload, purchasePayload] = await Promise.all([
      requestJson<ApiCustomerMetricsResponse>(`${API_BASE_URL}/customers/${encodeURIComponent(String(contactId))}`),
      requestJson<ApiPurchaseHistoryResponse>(`${API_BASE_URL}/customers/${encodeURIComponent(String(contactId))}/purchase-history`),
    ]);

    const customer = customerPayload?.data || {};
    const rows = Array.isArray(purchasePayload?.data?.items) ? purchasePayload.data.items : [];
    const total = rows.reduce((sum: number, row: ApiTransactionRow) => {
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

export const fetchCustomerTerms = async (sessionId: string): Promise<Array<Record<string, unknown>>> => {
  try {
    const payload = await requestJson<ApiCustomerDetailResponse>(
      `${API_BASE_URL}/customer-database/${encodeURIComponent(String(sessionId))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    const rows = Array.isArray(payload?.data?.terms_history) ? payload.data.terms_history : [];
    return rows.map(mapApiTermRow);
  } catch (err) {
    console.error('Error fetching customer terms via local API:', err);
    return [];
  }
};
