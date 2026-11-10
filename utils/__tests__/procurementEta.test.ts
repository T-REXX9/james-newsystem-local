import { describe, expect, it } from 'vitest';
import { resolvePurchaseOrderEta } from '../procurementEta';

describe('resolvePurchaseOrderEta', () => {
  it('uses a valid purchase-order item ETA when present', () => {
    expect(resolvePurchaseOrderEta('2026-08-01', ['2026-08-22'])).toBe('2026-08-22');
  });

  it('defaults ETA to 30 days after the purchase-order date when item ETA is missing or the 1970 sentinel', () => {
    expect(resolvePurchaseOrderEta('2024-02-14', ['1970-01-01'])).toBe('2024-03-15');
    expect(resolvePurchaseOrderEta('2024-02-14', [])).toBe('2024-03-15');
  });

  it('returns null when neither a valid ETA nor a valid purchase-order date is available', () => {
    expect(resolvePurchaseOrderEta('', ['1970-01-01'])).toBeNull();
  });
});
