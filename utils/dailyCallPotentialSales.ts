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

const mostRecentActiveMonthPurchases = (purchases: Purchase[], limit = 12) => {
  const activeMonths = new Set(
    purchases.map((purchase) => {
      const date = new Date(purchase.purchased_at);
      return `${date.getFullYear()}-${date.getMonth()}`;
    })
  );
  const selectedMonths = new Set(
    Array.from(activeMonths)
      .sort((left, right) => {
        const [leftYear, leftMonth] = left.split('-').map(Number);
        const [rightYear, rightMonth] = right.split('-').map(Number);
        return (rightYear * 12 + rightMonth) - (leftYear * 12 + leftMonth);
      })
      .slice(0, limit)
  );

  return purchases.filter((purchase) => {
    const date = new Date(purchase.purchased_at);
    return selectedMonths.has(`${date.getFullYear()}-${date.getMonth()}`);
  });
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
 * - Recovery / Blacklisted: average monthly purchase over the last 12 active months
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

  return averageOfMonthlyTotals(mostRecentActiveMonthPurchases(paid));
};
