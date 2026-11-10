import { describe, expect, it } from 'vitest';
import { formatLastPurchaseForDisplay, getPrimaryContactSummary } from '../CustomerDetailPanel';

describe('CustomerDetailPanel last purchase display', () => {
  it('does not use a prospect registration/contact date when there are no purchases', () => {
    expect(formatLastPurchaseForDisplay(null)).toBe('Never');
  });

  it('displays the latest ledger purchase date when one exists', () => {
    expect(formatLastPurchaseForDisplay('2026-09-08')).toBe('2026-09-08');
  });
});

describe('CustomerDetailPanel primary contact summary', () => {
  const contact = {
    contactPersons: [
      { id: '1', enabled: true, name: 'Maria Santos', position: '', birthday: '', telephone: '02-1234', mobile: '0917-123-4567', email: '' },
    ],
    name: 'Fallback Name',
    phone: '02-9999',
    mobile: '0918-999-9999',
  } as Parameters<typeof getPrimaryContactSummary>[0];

  it('uses the primary contact person name followed by their mobile number', () => {
    expect(getPrimaryContactSummary(contact)).toEqual({ name: 'Maria Santos', number: '0917-123-4567' });
  });

  it('falls back to the customer-level number when the contact person has no number', () => {
    expect(getPrimaryContactSummary({
      ...contact,
      contactPersons: [{ ...contact.contactPersons[0], mobile: '', telephone: '' }],
    })).toEqual({ name: 'Maria Santos', number: '0918-999-9999' });
  });
});
