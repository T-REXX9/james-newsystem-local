import { describe, expect, it } from 'vitest';
import {
  computeVipDocumentDiscount,
  lastMonthSpendFromSummary,
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

  it('applies VIP Gold on every deal in the benefit month', () => {
    expect(
      shouldApplyVipOnDocument({
        standing: 'gold',
        current: inquiry({ id: 'inq-2' }),
        customerDocumentsInBenefitMonth: [inquiry({ id: 'inq-1' })],
      })
    ).toBe(true);
  });

  it('applies VIP Silver only on the first live deal and its converted documents', () => {
    const first = inquiry({ id: 'inq-1', salesDate: '2026-09-01' });
    const second = inquiry({ id: 'inq-2', salesDate: '2026-09-08' });
    const convertedOrder: VipDealDocument = {
      id: 'so-1',
      kind: 'sales_order',
      salesDate: '2026-09-01',
      cancelled: false,
      deleted: false,
      inquiryId: 'inq-1',
    };

    expect(
      shouldApplyVipOnDocument({
        standing: 'silver',
        current: first,
        customerDocumentsInBenefitMonth: [first, second],
      })
    ).toBe(true);
    expect(
      shouldApplyVipOnDocument({
        standing: 'silver',
        current: convertedOrder,
        customerDocumentsInBenefitMonth: [first, second, convertedOrder],
      })
    ).toBe(true);
    expect(
      shouldApplyVipOnDocument({
        standing: 'silver',
        current: second,
        customerDocumentsInBenefitMonth: [first, second],
      })
    ).toBe(false);
  });

  it('does not let a cancelled first inquiry consume VIP Silver', () => {
    const cancelled = inquiry({ id: 'inq-1', cancelled: true, salesDate: '2026-09-01' });
    const live = inquiry({ id: 'inq-2', salesDate: '2026-09-08' });

    expect(
      shouldApplyVipOnDocument({
        standing: 'silver',
        current: live,
        customerDocumentsInBenefitMonth: [cancelled, live],
      })
    ).toBe(true);
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
