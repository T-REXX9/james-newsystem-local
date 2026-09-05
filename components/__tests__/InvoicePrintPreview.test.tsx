import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InvoicePrintPreview from '../InvoicePrintPreview';
import { Contact, InvoiceStatus } from '../../types';

vi.mock('lucide-react', () => ({
  Printer: () => null,
  XCircle: () => null,
}));

const invoice = {
  id: 'inv-1',
  invoice_no: 'INV26-1',
  order_id: 'so-1',
  contact_id: 'c-1',
  sales_date: '2026-09-05',
  sales_person: 'Jane',
  delivery_address: 'Taguig',
  reference_no: 'REF-1',
  customer_reference: '',
  send_by: '',
  price_group: 'regular',
  credit_limit: 0,
  terms: '30 days',
  promise_to_pay: '',
  po_number: 'PO-9',
  inquiry_type: '',
  urgency: '',
  grand_total: 7560,
  vip_applied: true,
  vip_tier: 'silver' as const,
  vip_percentage: 10,
  vip_discount_amount: 756,
  total_to_pay: 6804,
  status: InvoiceStatus.SENT,
  created_by: '1',
  created_at: '2026-09-05',
  items: [
    {
      id: 'item-1',
      invoice_id: 'inv-1',
      item_id: 'p-1',
      qty: 1,
      part_no: 'PN-1',
      item_code: 'IC-1',
      location: '',
      description: 'Widget',
      unit_price: 7560,
      amount: 7560,
      remark: '',
    },
  ],
};

describe('InvoicePrintPreview', () => {
  it('prints the A5 TND OPC form with VIP on Less: Discount and a reduced TOTAL AMOUNT DUE', () => {
    render(
      <InvoicePrintPreview
        invoice={invoice}
        customer={{
          id: 'c-1',
          company: 'WT GOMEZ',
          address: 'Taguig',
          vatType: 'Inclusive',
          tin: '123-456',
          terms: '30 days',
        } as Contact}
        onClose={() => undefined}
      />
    );

    expect(screen.getByText('TND OPC')).toBeInTheDocument();
    expect(screen.getByText('SALES INVOICE')).toBeInTheDocument();
    expect(screen.getByText('CASH SALES')).toBeInTheDocument();
    expect(screen.getByText('CHARGE SALES')).toBeInTheDocument();
    expect(screen.getByText('Less: Discount (VIP SILVER)')).toBeInTheDocument();
    expect(screen.getByText('TOTAL AMOUNT DUE')).toBeInTheDocument();
    expect(screen.getAllByText('6,804.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('Less: SC/PWD Discount')).not.toBeInTheDocument();
  });
});
