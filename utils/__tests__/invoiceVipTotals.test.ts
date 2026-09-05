import { describe, expect, it } from 'vitest';
import { buildInvoiceVipSummary } from '../invoiceVipTotals';

describe('buildInvoiceVipSummary', () => {
  it('reduces TOTAL AMOUNT DUE by VIP Silver on an inclusive invoice', () => {
    const summary = buildInvoiceVipSummary({
      lineGrandTotal: 7560,
      vatType: 'Inclusive',
      vip_applied: true,
      vip_tier: 'silver',
      vip_percentage: 10,
    });

    expect(summary.discount.discountAmount).toBe(756);
    expect(summary.totalAmountDue).toBe(6804);
    expect(summary.finalTotal).toBe(6804);
  });

  it('subtracts VIP from the VAT-grossed exclusive total used on the ledger', () => {
    const summary = buildInvoiceVipSummary({
      lineGrandTotal: 1000,
      vatType: 'Exclusive',
      vip_applied: true,
      vip_tier: 'gold',
      vip_percentage: 10,
    });

    expect(summary.discount.discountAmount).toBe(100);
    expect(summary.addVat).toBe(120);
    expect(summary.totalAmountDue).toBe(1020);
  });
});
