import { DEFAULT_CUSTOMER_VAT_TYPE } from '../constants/customerVat';
import { normalizePreferredBrand } from '../constants/customerPreferredBrand';
import { normalizePriceGroup } from '../constants/pricingGroups';
import { Contact, ContactPerson, ContactTransaction, CustomerStatus, CustomerVatType, DealStage, Product, UserProfile } from '../types';
import { invalidateDailyCallMasterListCache } from './dailyCallMonitoringService';
import { getLocalAuthSession } from './localAuthService';
import { fetchAssignableStaff } from './staffLocalApiService';
import { customerLedgerService, ledgerRowsToContactTransactions } from './customerLedgerService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

type ApiCustomerStatus = 0 | 1 | 3 | number;
type CustomerDiscountCode = NonNullable<Contact['discountCode']>;
const CUSTOMER_DISCOUNT_CODES: CustomerDiscountCode[] = ['regular', 'vip silver', 'vip gold', 'vip platinum'];

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
  verification?: string | null;
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
  since?: string | null;
  customer_since?: string | null;
  lsince?: string | null;
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
  price_code?: string | null;
  discount_code?: string | null;
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
  preferred_brand?: string | null;
  profile_type?: string | null;
  notes?: string | null;
  duplicate_override_reason?: string | null;
  record_image?: string | null;
  record_image_position?: string | null;
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

export interface PurchasedItem {
  item_code: string;
  part_no: string;
  description: string;
  brand: string;
  unit_price: number;
  purchased_qty: number;
  returned_qty: number;
  remaining_qty: number;
}

interface ApiPurchasedItemsResponse {
  data?: {
    items?: Array<Partial<PurchasedItem>>;
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
  __salesTeamId?: string | number;
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

const EMPTY_DATE_SENTINELS = new Set(['1970-01-01', '0000-00-00', '0000-00-00 00:00:00']);

const sanitizeCustomerDate = (value: unknown): string => {
  const normalized = sanitizeLegacyString(value);
  if (!normalized) return '';
  const dateOnly = normalized.slice(0, 10);
  if (EMPTY_DATE_SENTINELS.has(normalized) || EMPTY_DATE_SENTINELS.has(dateOnly)) return '';
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
  const verification = String(row?.verification || '').trim().toLowerCase();
  const status = toNumber(row?.status, 1);

  if (debtType === 'bad') return CustomerStatus.BLACKLISTED;
  if ((profileType === 'prospect' || status === 3) && verification === 'verified') return CustomerStatus.VERIFIED_PROSPECT;
  if (profileType === 'prospect' || status === 3) return CustomerStatus.PROSPECTIVE;
  if (status === 0) return CustomerStatus.INACTIVE;
  return CustomerStatus.ACTIVE;
};

const mapUiStatusToApi = (status: CustomerStatus | string | undefined): number => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === String(CustomerStatus.INACTIVE).toLowerCase()) return 0;
  if (normalized === String(CustomerStatus.VERIFIED_PROSPECT).toLowerCase()) return 3;
  if (normalized === String(CustomerStatus.PROSPECTIVE).toLowerCase()) return 3;
  return 1;
};

const debtTypeForUiStatus = (status: CustomerStatus | string | undefined): 'Bad' | 'Good' => {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === String(CustomerStatus.BLACKLISTED).toLowerCase() ? 'Bad' : 'Good';
};

const verificationForUiStatus = (status: CustomerStatus | string | undefined): string | undefined => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === String(CustomerStatus.VERIFIED_PROSPECT).toLowerCase()) return 'Verified';
  if (normalized === String(CustomerStatus.PROSPECTIVE).toLowerCase()) return 'Unverified';
  return undefined;
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

export const mapApiCustomerToContact = (row: ApiCustomerRow): LocalContact => {
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
  const priceCode = sanitizeLegacyString(row?.price_code || row?.price_group || row?.pricing_tier || '');
  const rawDiscountCode = sanitizeLegacyString(row?.discount_code || 'regular').toLowerCase();
  const discountCode: CustomerDiscountCode = CUSTOMER_DISCOUNT_CODES.includes(rawDiscountCode as CustomerDiscountCode)
    ? rawDiscountCode as CustomerDiscountCode
    : 'regular';

  return {
    id: String(row?.session_id ?? row?.lsessionid ?? row?.id ?? ''),
    company,
    customerSince: sanitizeCustomerDate(row?.since || row?.customer_since || row?.lsince || ''),
    team: sanitizeLegacyString(row?.team || ''),
    salesman: resolvedSalesName,
    referBy: sanitizeLegacyString(row?.refer_by || ''),
    address: sanitizeLegacyString(row?.address || ''),
    province: sanitizeLegacyString(row?.province || ''),
    city: sanitizeLegacyString(row?.city || ''),
    area: sanitizeLegacyString(row?.area || ''),
    deliveryAddress: sanitizeLegacyString(row?.delivery_address || row?.address || ''),
    tin: sanitizeLegacyString(row?.tin || ''),
    priceGroup: priceCode || normalizePriceGroup(sanitizeLegacyString(row?.price_group || '')),
    priceCode,
    discountCode,
    businessLine: sanitizeLegacyString(row?.business_line || ''),
    terms: sanitizeLegacyString(row?.terms || ''),
    transactionType: sanitizeLegacyString(row?.transaction_type || ''),
    vatType: normalizeVatType(row?.vat_type),
    vatPercentage: String(toNumber(row?.vat_percent, 0.12) * 100),
    dealershipTerms: sanitizeLegacyString(row?.dealer_terms || ''),
    dealershipSince: sanitizeCustomerDate(row?.dealer_since || ''),
    dealershipQuota: toNumber(row?.dealer_quota, 0),
    creditLimit: toNumber(row?.credit_limit, 0),
    preferredBrand: normalizePreferredBrand(row?.preferred_brand) || undefined,
    status,
    verification: sanitizeLegacyString(row?.verification || ''),
    isHidden: toNumber(row?.status, 1) === 0,
    debtType: String(row?.debt_type || 'Good').toLowerCase() === 'bad' ? 'Bad' : 'Good',
    comment: sanitizeLegacyString(row?.notes || ''),
    duplicateOverrideReason: sanitizeLegacyString(row?.duplicate_override_reason || ''),
    contactPersons,
    name: primary?.name || company || 'N/A',
    title: primary?.position || '',
    email: primary?.email || fallbackEmail,
    phone: primary?.telephone || primary?.mobile || fallbackPhone || fallbackMobile,
    mobile: primary?.mobile || fallbackMobile,
    avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(String(row?.session_id ?? row?.id ?? company ?? Date.now()))}`,
    recordImage: sanitizeLegacyString(row?.record_image || ''),
    recordImagePosition: sanitizeLegacyString(row?.record_image_position || '50,50') || '50,50',
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

export const mapContactPayloadToApi = (contact: ContactPayloadWithSalesPersonId) => {
  const status = mapUiStatusToApi(contact?.status as CustomerStatus | undefined);
  const debtType = debtTypeForUiStatus(contact?.status as CustomerStatus | undefined);
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
    price_group: String(contact?.priceCode || contact?.priceGroup || ''),
    discount_code: String(contact?.discountCode || 'regular'),
    business_line: String(contact?.businessLine || ''),
    terms: String(contact?.terms || ''),
    transaction_type: String(contact?.transactionType || 'Order Slip'),
    vat_type: String(contact?.vatType || DEFAULT_CUSTOMER_VAT_TYPE),
    vat_percent: toNumber(contact?.vatPercentage, 12) / 100,
    since: sanitizeCustomerDate(contact?.customerSince || ''),
    dealer_since: sanitizeCustomerDate(contact?.dealershipSince || ''),
    dealer_quota: toNumber(contact?.dealershipQuota, 0),
    credit_limit: toNumber(contact?.creditLimit, 0),
    preferred_brand: normalizePreferredBrand(contact?.preferredBrand),
    status,
    notes: String(contact?.comment || ''),
    duplicate_override_reason: String(contact?.duplicateOverrideReason || ''),
    duplicate_override_confirmed: String(contact?.duplicateOverrideReason || '').trim() !== '',
    debt_type: debtType,
    profile_type: status === 3 ? 'Prospect' : 'Old',
    verification: verificationForUiStatus(contact?.status as CustomerStatus | undefined)
      ?? (status === 3 ? String(contact?.verification || 'Unverified') : ''),
    record_image: String(contact?.recordImage || ''),
    record_image_position: String(contact?.recordImagePosition || '50,50'),
  };
};

const hasOwn = <K extends string>(value: object, key: K): boolean => Object.prototype.hasOwnProperty.call(value, key);

export const mapContactUpdatesToApi = (contact: Partial<ContactPayloadWithSalesPersonId>) => {
  const payload: Record<string, unknown> = {};

  if (hasOwn(contact, 'company')) payload.company = String(contact.company || '');
  if (hasOwn(contact, 'email')) payload.email = String(contact.email || '');
  if (hasOwn(contact, 'phone')) payload.phone = String(contact.phone || '');
  if (hasOwn(contact, 'mobile')) payload.mobile = String(contact.mobile || '');

  if (hasOwn(contact, '__salesPersonId') || hasOwn(contact, 'salesman') || hasOwn(contact, 'assignedAgent')) {
    payload.sales_person_id = String(contact.__salesPersonId || contact.salesman || contact.assignedAgent || '').trim();
  }
  if (hasOwn(contact, '__salesTeamId')) {
    payload.sales_team_id = contact.__salesTeamId === '' || contact.__salesTeamId == null
      ? null
      : Number(contact.__salesTeamId);
  }

  if (hasOwn(contact, 'referBy')) payload.refer_by = String(contact.referBy || '');
  if (hasOwn(contact, 'address')) payload.address = String(contact.address || '');
  if (hasOwn(contact, 'deliveryAddress')) payload.delivery_address = String(contact.deliveryAddress || '');
  if (hasOwn(contact, 'area')) payload.area = String(contact.area || '');
  if (hasOwn(contact, 'city')) payload.city = String(contact.city || '');
  if (hasOwn(contact, 'province')) payload.province = String(contact.province || '');
  if (hasOwn(contact, 'tin')) payload.tin = String(contact.tin || '');
  if (hasOwn(contact, 'priceCode') || hasOwn(contact, 'priceGroup')) payload.price_group = String(contact.priceCode || contact.priceGroup || '');
  if (hasOwn(contact, 'discountCode')) payload.discount_code = String(contact.discountCode || 'regular');
  if (hasOwn(contact, 'businessLine')) payload.business_line = String(contact.businessLine || '');
  if (hasOwn(contact, 'terms')) payload.terms = String(contact.terms || '');
  if (hasOwn(contact, 'transactionType')) payload.transaction_type = String(contact.transactionType || '');
  if (hasOwn(contact, 'vatType')) payload.vat_type = String(contact.vatType || '');
  if (hasOwn(contact, 'vatPercentage')) payload.vat_percent = toNumber(contact.vatPercentage, 12) / 100;
  if (hasOwn(contact, 'customerSince')) payload.since = sanitizeCustomerDate(contact.customerSince || '');
  if (hasOwn(contact, 'dealershipSince')) payload.dealer_since = sanitizeCustomerDate(contact.dealershipSince || '');
  if (hasOwn(contact, 'dealershipQuota')) payload.dealer_quota = toNumber(contact.dealershipQuota, 0);
  if (hasOwn(contact, 'creditLimit')) payload.credit_limit = toNumber(contact.creditLimit, 0);
  if (hasOwn(contact, 'preferredBrand')) payload.preferred_brand = normalizePreferredBrand(contact.preferredBrand);
  if (hasOwn(contact, 'comment')) payload.notes = String(contact.comment || '');
  if (hasOwn(contact, 'debtType')) payload.debt_type = String(contact.debtType || 'Good');
  if (hasOwn(contact, 'verification')) payload.verification = String(contact.verification || '');
  if (hasOwn(contact, 'recordImage')) payload.record_image = String(contact.recordImage || '');
  if (hasOwn(contact, 'recordImagePosition')) payload.record_image_position = String(contact.recordImagePosition || '50,50');

  if (hasOwn(contact, 'status')) {
    const status = mapUiStatusToApi(contact.status as CustomerStatus | undefined);
    payload.status = status;
    if (contact.status !== CustomerStatus.BLACKLISTED) {
      payload.profile_type = status === 3 ? 'Prospect' : 'Old';
    }
    payload.debt_type = debtTypeForUiStatus(contact.status as CustomerStatus | undefined);
    const verification = verificationForUiStatus(contact.status as CustomerStatus | undefined);
    if (verification !== undefined) payload.verification = verification;
  } else if (hasOwn(contact, 'isHidden')) {
    payload.status = contact.isHidden ? 0 : 1;
  }

  return payload;
};

export const mapContactPersonPayloadToApi = (cp: ContactPerson) => {
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
  const headers = new Headers(init?.headers);
  const token = getLocalAuthSession()?.token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
  return (await response.json()) as T;
};

export interface SimilarCustomerNameMatch {
  session_id?: string;
  company: string;
  status?: string;
  profile_type?: string;
  matched_fields?: string[];
  is_blacklisted: boolean;
  is_exact: boolean;
}

export const fetchSimilarCustomerNames = async (
  company: string,
  details: Partial<Contact> = {},
  excludeSessionId?: string,
): Promise<SimilarCustomerNameMatch[]> => {
  const query = new URLSearchParams({
    main_id: String(API_MAIN_ID),
    company: company.trim(),
    tin: String(details.tin || ''),
    phone: String(details.phone || ''),
    mobile: String(details.mobile || ''),
    address: String(details.address || ''),
    delivery_address: String(details.deliveryAddress || ''),
    city: String(details.city || ''),
    province: String(details.province || ''),
  });
  if (excludeSessionId) query.set('exclude_session_id', excludeSessionId);

  const payload = await requestJson<{ data?: { items?: SimilarCustomerNameMatch[] } }>(
    `${API_BASE_URL}/customer-database/name-check?${query.toString()}`
  );
  return Array.isArray(payload?.data?.items) ? payload.data.items : [];
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

export const deleteCustomer = async (sessionId: string): Promise<void> => {
  const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
  await requestJson(
    `${API_BASE_URL}/customer-database/${encodeURIComponent(String(sessionId))}?${query.toString()}`,
    { method: 'DELETE' },
  );
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

export const updateContact = async (id: string, updates: Partial<ContactPayloadWithSalesPersonId>, actorId?: string): Promise<void> => {
  const payload: Record<string, unknown> = {
    main_id: API_MAIN_ID,
    user_id: actorId || String(getUserContext().userId),
    ...mapContactUpdatesToApi(updates),
  };

  // tblpatient.lphone/lmobile are VARCHAR(15). Legacy contact-person phones can be longer
  // (tblcontact_person.lc_mobile is VARCHAR(225)). Never push oversize values into patient columns,
  // and do not clear patient phones just because the contact-person value was too long to copy.
  const contactPersonMobile = String(updates.contactPersons?.[0]?.mobile || '').trim();
  const contactPersonTelephone = String(updates.contactPersons?.[0]?.telephone || '').trim();
  if (typeof payload.mobile === 'string') {
    const mobile = String(payload.mobile).trim();
    if (mobile.length > 15 || (mobile === '' && contactPersonMobile.length > 15)) {
      delete payload.mobile;
    }
  }
  if (typeof payload.phone === 'string') {
    const phone = String(payload.phone).trim();
    if (phone.length > 15 || (phone === '' && contactPersonTelephone.length > 15)) {
      delete payload.phone;
    }
  }

  await requestJson(`${API_BASE_URL}/customer-database/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (updates?.contactPersons) {
    await syncContactPersons(id, updates.contactPersons);
  }

  invalidateDailyCallMasterListCache();
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
  return fetchAssignableStaff();
};

export const fetchContactTransactions = async (contactId: string): Promise<ContactTransaction[]> => {
  try {
    const payload = await requestJson<ApiPurchaseHistoryResponse>(
      `${API_BASE_URL}/customers/${encodeURIComponent(String(contactId))}/purchase-history`
    );
    const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    return rows.map((row: ApiTransactionRow, index: number) => {
      const sourceType = String(row?.source_type || '').toUpperCase();
      const txType: ContactTransaction['type'] = sourceType === 'INVOICE' ? 'invoice' : 'order_slip';
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

export const fetchPurchasedItems = async (
  contactId: string,
  search = '',
  limit = 50,
): Promise<PurchasedItem[]> => {
  const query = new URLSearchParams({
    limit: String(Math.max(1, Math.min(200, limit))),
  });
  if (search.trim()) query.set('search', search.trim());

  const payload = await requestJson<ApiPurchasedItemsResponse>(
    `${API_BASE_URL}/customers/${encodeURIComponent(String(contactId))}/purchased-items?${query.toString()}`
  );
  const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  return rows.map((row) => ({
    item_code: String(row?.item_code || ''),
    part_no: String(row?.part_no || ''),
    description: String(row?.description || ''),
    brand: String(row?.brand || ''),
    unit_price: toNumber(row?.unit_price, 0),
    purchased_qty: toNumber(row?.purchased_qty, 0),
    returned_qty: toNumber(row?.returned_qty, 0),
    remaining_qty: toNumber(row?.remaining_qty, 0),
  })).filter((row) => row.item_code || row.part_no);
};

export const purchasedItemToProduct = (item: PurchasedItem): Product => ({
  id: `${item.item_code}:${item.part_no}`,
  part_no: item.part_no,
  oem_no: '',
  brand: item.brand,
  barcode: '',
  no_of_pieces_per_box: 0,
  item_code: item.item_code,
  description: item.description,
  size: '',
  reorder_quantity: 0,
  status: 'Active',
  category: '',
  descriptive_inquiry: '',
  no_of_holes: '',
  replenish_quantity: 0,
  original_pn_no: '',
  application: '',
  no_of_cylinder: '',
  price_aa: item.unit_price,
  price_bb: 0,
  price_cc: 0,
  price_dd: 0,
  price_vip1: 0,
  price_vip2: 0,
  price_vip3: 0,
  stock_wh1: item.remaining_qty,
  stock_wh2: 0,
  stock_wh3: 0,
  stock_wh4: 0,
  stock_wh5: 0,
  stock_wh6: 0,
  total_stock: item.remaining_qty,
});

export interface LocalCustomerMetrics {
  contact_id: string;
  total_purchases: number;
  average_order_value: number;
  last_purchase_date: string | null;
  outstanding_balance: number;
  credit_limit: number;
  currency: string;
  average_monthly_purchase?: number;
  purchase_frequency?: number;
}

export const fetchCustomerMetrics = async (contactId: string): Promise<LocalCustomerMetrics | null> => {
  try {
    const ledger = await customerLedgerService.getLedger(contactId, {
      reportType: 'detailed',
      dateType: 'all',
    });
    const transactions = ledgerRowsToContactTransactions(ledger.rows);
    const total = ledger.metrics.dealership_sales;
    const avg = transactions.length > 0 ? total / transactions.length : 0;

    return {
      contact_id: contactId,
      total_purchases: total,
      average_order_value: avg,
      last_purchase_date: transactions[0]?.date || null,
      outstanding_balance: ledger.metrics.balance,
      credit_limit: ledger.metrics.credit_limit,
      currency: 'PHP',
    };
  } catch (err) {
    console.error('Error fetching customer metrics via local API:', err);
    return null;
  }
};

export const fetchCustomerTerms = async (sessionId: string): Promise<Array<ReturnType<typeof mapApiTermRow>>> => {
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

// ---------------------------------------------------------------------------
// Province Summary (for Sales Map)
// ---------------------------------------------------------------------------

export interface ProvinceSummary {
  province: string;
  customer_count: number;
}

/**
 * Fetch customer counts grouped by province.
 * The API resolves province from `lprovince` first, then falls back to
 * matching the address text against the refprovince table.
 */
export const fetchProvinceSummary = async (): Promise<ProvinceSummary[]> => {
  try {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    const payload = await requestJson<{ ok?: boolean; data: { data: ProvinceSummary[] } | ProvinceSummary[] }>(
      `${API_BASE_URL}/customer-database/province-summary?${query.toString()}`
    );
    // The API wraps as { ok, data: { data: [...] } } — unwrap the double nesting
    const inner = payload?.data;
    if (Array.isArray(inner)) return inner;
    if (inner && typeof inner === 'object' && 'data' in inner && Array.isArray((inner as any).data)) {
      return (inner as any).data;
    }
    return [];
  } catch (err) {
    console.error('Error fetching province summary:', err);
    return [];
  }
};
