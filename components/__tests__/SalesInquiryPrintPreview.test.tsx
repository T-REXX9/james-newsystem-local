import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SalesInquiryPrintPreview from '../SalesInquiryPrintPreview';
import { Contact, SalesInquiryStatus } from '../../types';

afterEach(() => {
  cleanup();
});

vi.mock('lucide-react', () => ({
  Printer: () => null,
  XCircle: () => null,
}));

const inquiry = {
  id: 'inq-1',
  inquiry_no: 'INQ26-99',
  contact_id: 'c-1',
  sales_date: '2026-04-08',
  sales_time: '09:30:00',
  sales_person: 'Jane Doe',
  delivery_address: '123 Main St',
  reference_no: 'REF-STALE-99',
  customer_reference: 'Alice',
  send_by: '',
  price_group: 'regular',
  credit_limit: 10000,
  terms: '30 days',
  promise_to_pay: '',
  po_number: 'PO-9',
  remarks: '',
  inquiry_type: 'General',
  urgency: 'N/A',
  urgency_date: '',
  grand_total: 200,
  created_by: '1',
  created_at: '2026-04-08',
  status: SalesInquiryStatus.DRAFT,
  items: [
    {
      id: 'item-1',
      inquiry_id: 'inq-1',
      item_id: 'p-1',
      qty: 2,
      part_no: 'PN-1',
      item_code: 'IC-1',
      brand: 'ISHINOMOTO',
      location: '',
      description: 'Widget',
      unit_price: 100,
      amount: 200,
      remark: '',
      approval_status: 'approved' as const,
    },
  ],
};

describe('SalesInquiryPrintPreview', () => {
  it('prints the inquiry number as Our Reference even when a stored reference differs', () => {
    render(
      <SalesInquiryPrintPreview
        inquiry={inquiry}
        customer={{
          id: 'c-1',
          company: 'Acme Corp',
          address: '123 Main St',
        } as Contact}
        inquiryNumberLabel="INQ26-99"
        preparedBy="Jane Doe"
        onClose={() => undefined}
      />
    );

    expect(screen.getByText('CUSTOMER INQUIRY')).toBeInTheDocument();
    const ourReferenceValue = screen.getByText('Our Reference:').nextElementSibling;
    expect(ourReferenceValue).toHaveTextContent('INQ26-99');
    expect(ourReferenceValue).not.toHaveTextContent('REF-STALE-99');
    expect(screen.queryByText('REF-STALE-99')).not.toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByTestId('vip-standing')).toHaveTextContent('VIP Status: Regular');
    expect(screen.getByText('Brand')).toBeInTheDocument();
    expect(screen.getByText('ISHINOMOTO')).toBeInTheDocument();
    expect(screen.getByText('Warranty:')).toBeInTheDocument();
    expect(screen.getByText(/ISHINOMOTO products only/)).toBeInTheDocument();
    expect(screen.getByText('Validity:')).toBeInTheDocument();
    expect(screen.getByText(/Orders not confirmed by 6:00 PM/)).toBeInTheDocument();
    expect(screen.getByText('Order Cut-off for Same-Day Delivery:')).toBeInTheDocument();
    expect(screen.getByText(/4:00 PM for LBC; 2:00 PM for AP Cargo/)).toBeInTheDocument();
    expect(screen.getByText('VIP QUALIFICATION FOR NEXT MONTH')).toBeInTheDocument();
    expect(screen.getByText('SILVER')).toBeInTheDocument();
    expect(screen.getByText('GOLD')).toBeInTheDocument();
    expect(screen.getByText('P9,800.00 MORE NEEDED THIS MONTH')).toBeInTheDocument();
    expect(screen.getByText('P29,800.00 MORE NEEDED THIS MONTH')).toBeInTheDocument();
  });

  it('uses currentMonthSales for VIP qualification when provided', () => {
    render(
      <SalesInquiryPrintPreview
        inquiry={inquiry}
        customer={{
          id: 'c-1',
          company: 'Acme Corp',
          address: '123 Main St',
        } as Contact}
        inquiryNumberLabel="INQ26-99"
        preparedBy="Jane Doe"
        currentMonthSales={67830}
        onClose={() => undefined}
      />
    );

    expect(screen.getByText('VIP QUALIFICATION FOR NEXT MONTH')).toBeInTheDocument();
    expect(screen.getByText('Current qualifying purchase:')).toBeInTheDocument();
    expect(screen.getByText('P67,830.00')).toBeInTheDocument();
    expect(screen.getByText('SILVER')).toBeInTheDocument();
    expect(screen.getByText('GOLD')).toBeInTheDocument();
    expect(screen.getAllByText('QUALIFIED')).toHaveLength(2);
  });

  it('falls back to inquiry total when currentMonthSales is not provided', () => {
    render(
      <SalesInquiryPrintPreview
        inquiry={inquiry}
        customer={{
          id: 'c-1',
          company: 'Acme Corp',
          address: '123 Main St',
        } as Contact}
        inquiryNumberLabel="INQ26-99"
        preparedBy="Jane Doe"
        currentMonthSales={null}
        onClose={() => undefined}
      />
    );

    expect(screen.getByText('VIP QUALIFICATION FOR NEXT MONTH')).toBeInTheDocument();
    expect(screen.getByText('Current qualifying purchase:')).toBeInTheDocument();
    expect(screen.getByText('P200.00')).toBeInTheDocument();
  });

  it('handles zero currentMonthSales correctly', () => {
    render(
      <SalesInquiryPrintPreview
        inquiry={inquiry}
        customer={{
          id: 'c-1',
          company: 'Acme Corp',
          address: '123 Main St',
        } as Contact}
        inquiryNumberLabel="INQ26-99"
        preparedBy="Jane Doe"
        currentMonthSales={0}
        onClose={() => undefined}
      />
    );

    expect(screen.getByText('VIP QUALIFICATION FOR NEXT MONTH')).toBeInTheDocument();
    expect(screen.getByText('Current qualifying purchase:')).toBeInTheDocument();
    expect(screen.getByText('P0.00')).toBeInTheDocument();
    expect(screen.getByText('P10,000.00 MORE NEEDED THIS MONTH')).toBeInTheDocument();
  });
});
