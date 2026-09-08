import { describe, expect, it } from 'vitest';
import { buildDateSubtotals } from '../purchaseHistoryAggregates';

describe('buildDateSubtotals', () => {
  it('aggregates each date in one pass', () => {
    const rows = [
      { ldate: '2026-09-08', lqty: 2, lprice: 10, return_qty: 1 },
      { ldate: '2026-09-07', lqty: 3, lprice: 20, return_qty: 0 },
      { ldate: '2026-09-08', lqty: 4, lprice: 5, return_qty: 2 },
    ];

    expect(buildDateSubtotals(rows)).toEqual({
      '2026-09-08': { sold: 40, returned: 20 },
      '2026-09-07': { sold: 60, returned: 0 },
    });
  });
});
