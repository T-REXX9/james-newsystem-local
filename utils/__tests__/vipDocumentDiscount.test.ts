import { describe, expect, it } from 'vitest';
import {
  computeVipDocumentDiscount,
  lastMonthSpendFromSummary,
  resolveLastMonthSpendForVipDocument,
  shouldApplyVipOnDocument,
  type VipDealDocument,
} from '../vipDocumentDiscount';

describe('computeVipDocumentDiscount', () => {
  it('applies 10% VIP Silver to the inquiry Grand Total from INQ26-20478', () => {
    const result = computeVipDocumentDiscount({
      grandTotal: 7560,
      standing: 'silver',
      percentage: 10,
      apply: true,
    });

    expect(result).toEqual({
      applied: true,
      tier: 'silver',
      percentage: 10,
      discountAmount: 756,
      totalToPay: 6804,
      lineLabel: '10% VIP SILVER = 756.00',
    });
  });

  it('leaves Regular customers at the undiscounted Grand Total', () => {
    const result = computeVipDocumentDiscount({
      grandTotal: 7560,
      standing: 'regular',
      percentage: 10,
      apply: false,
    });

    expect(result.applied).toBe(false);
    expect(result.discountAmount).toBe(0);
    expect(result.totalToPay).toBe(7560);
    expect(result.lineLabel).toBeNull();
  });
});

describe('shouldApplyVipOnDocument', () => {
  const inquiry = (overrides: Partial<VipDealDocument> = {}): VipDealDocument => ({
    id: 'inq-1',
    kind: 'sales_inquiry',
    salesDate: '2026-09-05',
    cancelled: false,
    deleted: false,
    ...overrides,
  });

  it('keeps VIP Gold unlimited even after a Silver benefit was redeemed', () => {
    const documents = [
      { id: 'inquiry-1', kind: 'sales_inquiry' as const },
      { id: 'inquiry-2', kind: 'sales_inquiry' as const },
      { id: 'order-slip-3', kind: 'order_slip' as const },
    ];
    for (const { id, kind } of documents) {
      expect(shouldApplyVipOnDocument({
        standing: 'gold',
        current: inquiry({ id, kind }),
        silverDiscountRedeemed: true,
      })).toBe(true);
    }
  });

  it('applies Silver to every eligible inquiry until an actual document redeems it', () => {
    const inquiry30 = inquiry({ id: 'inq-30', salesDate: '2026-09-30' });

    expect(shouldApplyVipOnDocument({
      standing: 'silver',
      current: inquiry30,
      silverDiscountRedeemed: false,
    })).toBe(true);
    expect(shouldApplyVipOnDocument({
      standing: 'silver',
      current: inquiry30,
      silverDiscountRedeemed: true,
    })).toBe(false);
  });

  it('does not show Silver on a cancelled inquiry', () => {
    const cancelled = inquiry({ id: 'inq-cancelled', cancelled: true });
    expect(shouldApplyVipOnDocument({
      standing: 'silver',
      current: cancelled,
      silverDiscountRedeemed: false,
    })).toBe(false);
  });
});

describe('lastMonthSpendFromSummary', () => {
  it('uses posted sales from the month before the document sales date', () => {
    expect(
      lastMonthSpendFromSummary('2026-09-05', [
        { year: 2026, month: 8, debit: 12000 },
        { year: 2026, month: 9, debit: 4000 },
      ])
    ).toBe(12000);
  });
});

describe('resolveLastMonthSpendForVipDocument', () => {
  it('uses the Daily Call last-month sales metric when summary rows disagree', () => {
    expect(
      resolveLastMonthSpendForVipDocument({
        salesDate: '2026-09-05',
        lastMonthSales: 30000,
        summaryRows: [{ year: 2026, month: 8, debit: 0 }],
        today: new Date('2026-09-06T00:00:00'),
      })
    ).toBe(30000);
  });

  it('does not let non-empty summary rows without last month zero a Gold customer', () => {
    expect(
      resolveLastMonthSpendForVipDocument({
        salesDate: '2026-09-05',
        lastMonthSales: 30000,
        summaryRows: [{ year: 2026, month: 1, debit: 1000 }],
        today: new Date('2026-09-06T00:00:00'),
      })
    ).toBe(30000);
  });

  it('uses summary rows for documents outside the current benefit month', () => {
    expect(
      resolveLastMonthSpendForVipDocument({
        salesDate: '2026-08-05',
        lastMonthSales: 30000,
        summaryRows: [{ year: 2026, month: 7, debit: 12000 }],
        today: new Date('2026-09-06T00:00:00'),
      })
    ).toBe(12000);
  });

  it('does not use the current last-month sales metric for non-current documents without summary rows', () => {
    expect(
      resolveLastMonthSpendForVipDocument({
        salesDate: '2026-08-05',
        lastMonthSales: 30000,
        summaryRows: [],
        today: new Date('2026-09-06T00:00:00'),
      })
    ).toBe(0);
  });
});
