export type DailyCallPurchaseHighlightColor = 'green' | 'yellow' | 'purple' | 'white' | 'red';

export type DailyCallPurchaseHighlightInput = {
  isBlocked?: boolean;
  lastPurchaseDateRaw?: string | null;
  monthsSinceLastPurchase?: number | null;
  currentMonthSales?: number | null;
  purchaseAgeGroup?: string | null;
  purchaseCount?: number | null;
  ledgerTransactionCount?: number | null;
  referenceDate?: Date;
};

const normalizePurchaseDate = (raw?: string | null): string => {
  const value = String(raw || '').trim();
  if (!value || value === '—') return '';
  return value.slice(0, 10);
};

/**
 * Purchase-age row colours for Daily Call lists:
 * - green: actually bought this month (posted current-month sales > 0)
 * - yellow: 1 month no purchase
 * - purple: 2 months no purchase
 * - white: 3+ months / no purchase yet
 * - red: blacklisted / rejected
 *
 * No-purchase rows must never resolve to green, even when monthsSinceLastPurchase is 0.
 *
 * "Green = bought this month" means real posted sales this month, NOT merely a
 * ledger date landing in the current month. Last-purchase reflects any ledger
 * activity (payments, returns, adjustments, credits), so a row can have a
 * current-month last-purchase date while current-month SALES are ₱0 — that row
 * is NOT green. currentMonthSales is authoritative when supplied: an explicit 0
 * falls through to the age-based colour. The last-purchase-in-current-month
 * fallback only applies when currentMonthSales is not provided at all.
 */
export const resolveDailyCallPurchaseHighlightColor = (
  input: DailyCallPurchaseHighlightInput
): DailyCallPurchaseHighlightColor => {
  if (input.isBlocked) return 'red';

  const rawDate = normalizePurchaseDate(input.lastPurchaseDateRaw);
  const lastPurchase = rawDate ? new Date(`${rawDate}T00:00:00`) : null;
  const hasValidPurchaseDate = Boolean(lastPurchase && !Number.isNaN(lastPurchase.getTime()));
  // Never treat "0 months since purchase" as green when there is no real purchase history.
  if (!hasValidPurchaseDate || input.purchaseAgeGroup === 'no_purchase') return 'white';

  const reference = input.referenceDate ?? new Date();
  const monthsSincePurchase = hasValidPurchaseDate
    ? ((reference.getFullYear() - lastPurchase!.getFullYear()) * 12)
      + (reference.getMonth() - lastPurchase!.getMonth())
    : Number(input.monthsSinceLastPurchase ?? 0);

  // currentMonthSales is authoritative when supplied. An explicit 0 must NOT be
  // overridden to green just because the last ledger date is in the current
  // month — that ledger date can be a payment/return/adjustment, not a sale.
  const currentMonthSales = input.currentMonthSales;
  const hasCurrentMonthSalesSignal = currentMonthSales !== null && currentMonthSales !== undefined;
  const boughtThisMonth = hasCurrentMonthSalesSignal
    ? Number(currentMonthSales) > 0
    : monthsSincePurchase <= 0;

  if (boughtThisMonth) return 'green';
  if (monthsSincePurchase >= 3) return 'white';
  if (monthsSincePurchase === 2) return 'purple';
  return 'yellow';
};
