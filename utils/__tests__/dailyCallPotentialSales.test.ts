import { describe, expect, it } from 'vitest';
import { averageMonthlyPaidSales } from '../dailyCallPotentialSales';
import { Purchase } from '../../types';

const purchase = (id: string, amount: number, purchasedAt: string): Purchase => ({
  id,
  contact_id: 'c1',
  amount,
  status: 'paid',
  purchased_at: purchasedAt,
});

describe('dailyCallPotentialSales', () => {
  it('uses last 12 months for priority average monthly sales', () => {
    const referenceDate = new Date('2026-09-09T00:00:00');
    const value = averageMonthlyPaidSales(
      [
        purchase('a', 5_000_000, '2026-01-15T00:00:00.000Z'),
        purchase('b', 5_000_000, '2026-02-15T00:00:00.000Z'),
        purchase('c', 5_000_000, '2026-03-15T00:00:00.000Z'),
        purchase('d', 5_000_000, '2026-04-15T00:00:00.000Z'),
        purchase('e', 5_000_000, '2026-05-15T00:00:00.000Z'),
        purchase('old', 25_000_000, '2024-01-15T00:00:00.000Z'),
      ],
      'priority',
      referenceDate
    );
    expect(value).toBe(5_000_000);
  });

  it('uses last 12 months ending at last purchase for recovery/blacklisted average', () => {
    const value = averageMonthlyPaidSales(
      [
        purchase('a', 35_000, '2024-01-10T00:00:00.000Z'),
        purchase('b', 35_000, '2024-02-10T00:00:00.000Z'),
        purchase('c', 35_000, '2024-03-10T00:00:00.000Z'),
        purchase('older', 200_000, '2022-06-01T00:00:00.000Z'),
      ],
      'recovery',
      new Date('2026-09-09T00:00:00')
    );
    expect(value).toBe(35_000);
  });
});
