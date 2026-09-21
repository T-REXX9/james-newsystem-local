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
 * - green: bought this month (current-month sales or last purchase in current month)
 * - yellow: 1 month no purchase
 * - purple: 2 months no purchase
 * - white: 3+ months / no purchase yet
 * - red: blacklisted / rejected
 *
 * No-purchase rows must never resolve to green, even when monthsSinceLastPurchase is 0.
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

  if (Number(input.currentMonthSales ?? 0) > 0 || monthsSincePurchase <= 0) return 'green';
  if (monthsSincePurchase >= 3) return 'white';
  if (monthsSincePurchase === 2) return 'purple';
  return 'yellow';
};
