import { describe, expect, it } from 'vitest';
import { formatLastPurchaseForDisplay } from '../CustomerDetailPanel';

describe('CustomerDetailPanel last purchase display', () => {
  it('does not use a prospect registration/contact date when there are no purchases', () => {
    expect(formatLastPurchaseForDisplay(null)).toBe('Never');
  });

  it('displays the latest ledger purchase date when one exists', () => {
    expect(formatLastPurchaseForDisplay('2026-09-08')).toBe('2026-09-08');
  });
});
