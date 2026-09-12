import { DailyCallMasterCustomerRow } from '../types';
import { isBlockedDailyCallMasterRow } from './dailyCallBlockedCustomer';

/** Ledger activity on/after this date belongs on the Priority List. */
export const DAILY_CALL_PRIORITY_FROM_DATE = '2025-10-01';

export type DailyCallListCategory = 'priority' | 'recovery' | 'no_purchase';

export type DailyCallMonitorBucket =
  | 'priority'
  | 'recovery'
  | 'verified'
  | 'unverified'
  | 'blocked';

type ListCategoryInput = Pick<
  DailyCallMasterCustomerRow,
  | 'listCategory'
  | 'priorityTransactionCount'
  | 'ledgerTransactionCount'
  | 'historicalTransactionCount'
  | 'purchaseCount'
  | 'lastPurchaseDateRaw'
>;

type MonitorBucketInput = ListCategoryInput &
  Pick<DailyCallMasterCustomerRow, 'customerStatus' | 'debtType' | 'profileType' | 'verification'>;

const isProspectProfile = (profileType?: string) =>
  String(profileType || '').trim().toLowerCase().includes('prospect');

/** Legacy status 3 = Prospective in tblpatient.lstatus. */
const isProspectiveCustomerStatus = (customerStatus?: number) => Number(customerStatus) === 3;

const normalizePurchaseDate = (raw?: string): string => {
  const value = String(raw || '').trim();
  if (!value || value === '—') return '';
  return value.slice(0, 10);
};

const hasAnyLedgerActivity = (row: ListCategoryInput): boolean => {
  if (Number(row.priorityTransactionCount ?? 0) > 0) return true;
  if (Number(row.ledgerTransactionCount ?? 0) > 0) return true;
  if (Number(row.historicalTransactionCount ?? 0) > 0) return true;
  if (Number(row.purchaseCount ?? 0) > 0) return true;
  return Boolean(normalizePurchaseDate(row.lastPurchaseDateRaw));
};

/**
 * Strict Priority / Recovery / no-purchase rule:
 * - Priority: any ledger activity from Oct 2025 onwards
 * - Recovery: ledger activity only before Oct 2025
 * - no_purchase: no ledger activity (prospects live here until first purchase)
 *
 * Never treat purchaseCount alone as Priority — that mis-files Recovery buyers.
 * Always honor lastPurchaseDateRaw / ledger counts over a stale listCategory.
 */
export const resolveDailyCallListCategory = (row: ListCategoryInput): DailyCallListCategory => {
  const priorityTransactions = Number(row.priorityTransactionCount ?? 0);
  if (priorityTransactions > 0) return 'priority';

  const ledgerTransactions = Number(row.ledgerTransactionCount ?? 0);
  const historicalTransactions = Number(row.historicalTransactionCount ?? 0);
  if (ledgerTransactions > 0 || historicalTransactions > 0) return 'recovery';

  const purchaseCount = Number(row.purchaseCount ?? 0);
  const lastPurchase = normalizePurchaseDate(row.lastPurchaseDateRaw);
  if (purchaseCount > 0 || lastPurchase) {
    if (lastPurchase && lastPurchase >= DAILY_CALL_PRIORITY_FROM_DATE) return 'priority';
    if (lastPurchase && lastPurchase < DAILY_CALL_PRIORITY_FROM_DATE) return 'recovery';
    // Purchase count without a usable date: treat as recovery rather than Priority/prospect.
    if (purchaseCount > 0) return 'recovery';
  }

  const explicit = String(row.listCategory || '');
  if (explicit === 'priority' || explicit === 'recovery' || explicit === 'no_purchase') {
    return explicit;
  }

  return 'no_purchase';
};

/**
 * UI buckets for master + agent Daily Call Monitoring.
 * Verified/Unverified only include true no-purchase prospects.
 * Existing buyers (any ledger / last purchase) never stay in prospect buckets,
 * even if profile_type/verification were left as Prospective + Verified.
 * Active/Inactive customer statuses also never stay in prospect buckets.
 */
export const resolveDailyCallMonitorBucket = (row: MonitorBucketInput): DailyCallMonitorBucket | null => {
  if (isBlockedDailyCallMasterRow(row)) return 'blocked';

  const listCategory = resolveDailyCallListCategory(row);
  if (listCategory === 'priority') return 'priority';
  if (listCategory === 'recovery') return 'recovery';

  // Defense in depth: any purchase signal leaves prospect buckets.
  if (hasAnyLedgerActivity(row)) {
    return 'recovery';
  }

  const customerStatus = Number(row.customerStatus ?? 0);
  // 1 Active / 2 Inactive are existing customer records, not awaiting first-purchase approval.
  if (customerStatus === 1 || customerStatus === 2) return null;

  const looksLikeProspect = isProspectProfile(row.profileType) || isProspectiveCustomerStatus(row.customerStatus);
  if (!looksLikeProspect) return null;

  return String(row.verification || '') === 'Verified' ? 'verified' : 'unverified';
};

export const matchesDailyCallMonitorBucket = (
  row: MonitorBucketInput,
  bucket: DailyCallMonitorBucket
): boolean => resolveDailyCallMonitorBucket(row) === bucket;
