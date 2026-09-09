import { Purchase } from '../types';

export const VERIFIED_PROSPECT_POTENTIAL = 5_000;

const monthsBefore = (date: Date, months: number) => {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() - months);
  return next;
};

const averageOfMonthlyTotals = (purchases: Purchase[]) => {
  const monthTotals = new Map<string, number>();
  purchases.forEach((purchase) => {
    const date = new Date(purchase.purchased_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    monthTotals.set(key, (monthTotals.get(key) || 0) + purchase.amount);
  });
  if (!monthTotals.size) return 0;
  const total = Array.from(monthTotals.values()).reduce((sum, value) => sum + value, 0);
  return total / monthTotals.size;
};

const paidPurchases = (purchases: Purchase[]) =>
  purchases.filter((purchase) => (
    purchase.status === 'paid'
    && purchase.purchased_at
    && !Number.isNaN(Date.parse(purchase.purchased_at))
  ));

/**
 * Client Potential Sales windows:
 * - Priority: average monthly purchase over the last 12 months
 * - Recovery / Blacklisted: average monthly purchase over the last 12 months
 *   ending at the customer's last purchase (active-year window)
 */
export const averageMonthlyPaidSales = (
  purchases: Purchase[],
  mode: 'priority' | 'recovery',
  referenceDate: Date = new Date()
) => {
  const paid = paidPurchases(purchases);
  if (!paid.length) return 0;

  if (mode === 'priority') {
    const windowStart = monthsBefore(referenceDate, 12);
    return averageOfMonthlyTotals(
      paid.filter((purchase) => {
        const date = new Date(purchase.purchased_at);
        return date >= windowStart && date <= referenceDate;
      })
    );
  }

  let lastPurchaseAt = 0;
  paid.forEach((purchase) => {
    const time = new Date(purchase.purchased_at).getTime();
    if (time > lastPurchaseAt) lastPurchaseAt = time;
  });
  if (!lastPurchaseAt) return 0;

  const windowEnd = new Date(lastPurchaseAt);
  const windowStart = monthsBefore(windowEnd, 12);
  return averageOfMonthlyTotals(
    paid.filter((purchase) => {
      const date = new Date(purchase.purchased_at);
      return date >= windowStart && date <= windowEnd;
    })
  );
};
