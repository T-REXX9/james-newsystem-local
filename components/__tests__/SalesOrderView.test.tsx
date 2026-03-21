import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SalesOrderView from '../SalesOrderView';

const getSalesOrdersPageMock = vi.fn();
const getSalesOrderMock = vi.fn();
const fetchContactsMock = vi.fn();

vi.mock('../../services/salesOrderLocalApiService', () => ({
  confirmSalesOrder: vi.fn(),
  convertToDocument: vi.fn(),
  getSalesOrder: (...args: any[]) => getSalesOrderMock(...args),
  getSalesOrdersPage: (...args: any[]) => getSalesOrdersPageMock(...args),
  syncDocumentPolicyState: vi.fn(),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  fetchContacts: (...args: any[]) => fetchContactsMock(...args),
}));

describe('SalesOrderView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the redirected sales order even when it is not present in the initial list page', async () => {
    getSalesOrdersPageMock.mockResolvedValue({
      items: [
        {
          id: 'other-order',
          order_no: 'SO-OTHER',
          inquiry_id: '',
          contact_id: 'contact-1',
          sales_date: '2026-02-01',
          sales_person: 'Other Rep',
          delivery_address: '',
          reference_no: '',
          customer_reference: '',
          send_by: '',
          price_group: '',
          credit_limit: 0,
          terms: '',
          promise_to_pay: '',
          po_number: '',
          remarks: '',
          inquiry_type: '',
          urgency: '',
          urgency_date: '',
          grand_total: 0,
          status: 'Submitted',
          approved_by: '',
          approved_at: '',
          created_by: '',
          created_at: '',
          updated_at: '',
          is_deleted: false,
          items: [],
        },
      ],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });

    getSalesOrderMock.mockImplementation(async (id: string) => ({
      id,
      order_no: 'SO-TARGET',
      inquiry_id: 'inq-1',
      contact_id: 'contact-1',
      sales_date: '2026-03-13',
      sales_person: 'Redirect Rep',
      delivery_address: 'Target Address',
      reference_no: 'REF-1',
      customer_reference: 'REF-1',
      send_by: '',
    price_group: 'gold',
      credit_limit: 0,
      terms: 'VIP2',
      promise_to_pay: '',
      po_number: '',
      remarks: '',
      inquiry_type: '',
      urgency: '',
      urgency_date: '',
      grand_total: 10.5,
      status: 'Submitted',
      approved_by: '',
      approved_at: '',
      created_by: '',
      created_at: '',
      updated_at: '',
      is_deleted: false,
      items: [],
    }));

    fetchContactsMock.mockResolvedValue([
      {
        id: 'contact-1',
        company: 'Acme Corp',
        transactionType: 'Invoice',
      },
    ]);

    render(<SalesOrderView initialOrderId="target-order" />);

    await waitFor(() => {
      expect(getSalesOrderMock).toHaveBeenCalledWith('target-order');
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('SO-TARGET')).toBeInTheDocument();
    });
  });
});
