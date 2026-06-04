import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SalesOrderView from '../SalesOrderView';

const getAllSalesOrdersMock = vi.fn();
const getSalesOrderMock = vi.fn();
const fetchContactsMock = vi.fn();
const fetchContactByIdMock = vi.fn();
const fetchProfilesMock = vi.fn();

vi.mock('../../services/salesOrderLocalApiService', () => ({
  confirmSalesOrder: vi.fn(),
  convertToDocument: vi.fn(),
  getSalesOrder: (...args: any[]) => getSalesOrderMock(...args),
  getAllSalesOrders: (...args: any[]) => getAllSalesOrdersMock(...args),
  syncDocumentPolicyState: vi.fn(),
  unpostSalesOrder: vi.fn(),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  fetchContacts: (...args: any[]) => fetchContactsMock(...args),
  fetchContactById: (...args: any[]) => fetchContactByIdMock(...args),
}));

vi.mock('../../services/localAuthService', () => ({
  getLocalAuthSession: vi.fn(() => ({ userProfile: { id: 'user-1', role: 'Owner' } })),
}));

vi.mock('../../services/supabaseService', () => ({
  dispatchWorkflowNotification: vi.fn(),
  fetchProfiles: (...args: any[]) => fetchProfilesMock(...args),
}));

const makeOrder = (overrides: Record<string, any> = {}) => ({
  id: overrides.id || 'order-1',
  order_no: overrides.order_no || 'SO-1',
  inquiry_id: '',
  contact_id: overrides.contact_id || 'contact-1',
  sales_date: overrides.sales_date || '2026-01-01',
  sales_person: overrides.sales_person || 'Sales Rep',
  delivery_address: '',
  reference_no: overrides.reference_no || '',
  customer_reference: '',
  send_by: '',
  price_group: 'gold',
  credit_limit: 0,
  terms: '',
  promise_to_pay: '',
  po_number: '',
  remarks: '',
  inquiry_type: '',
  urgency: '',
  urgency_date: '',
  grand_total: 0,
  status: overrides.status || 'Submitted',
  approved_by: '',
  approved_at: '',
  created_by: '',
  created_at: overrides.created_at || overrides.sales_date || '2026-01-01',
  updated_at: '',
  is_deleted: false,
  items: [],
  ...overrides,
});

describe('SalesOrderView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProfilesMock.mockResolvedValue([]);
    fetchContactByIdMock.mockResolvedValue(null);
    getSalesOrderMock.mockResolvedValue(null);
  });

  it('shows unfiltered sales orders newest to oldest by default', async () => {
    getAllSalesOrdersMock.mockResolvedValue([
      makeOrder({ id: 'old-order', order_no: 'SO-1', sales_date: '2026-01-05' }),
      makeOrder({ id: 'new-order', order_no: 'SO-11', sales_date: '2026-04-08' }),
      makeOrder({ id: 'middle-order', order_no: 'SO-7', sales_date: '2026-03-20' }),
    ]);

    fetchContactsMock.mockResolvedValue([
      {
        id: 'contact-1',
        company: 'Acme Corp',
        transactionType: 'Invoice',
      },
    ]);

    render(<SalesOrderView />);

    const newest = await screen.findByText('SO-11');
    const middle = await screen.findByText('SO-7');
    const oldest = await screen.findByText('SO-1');

    expect(newest.compareDocumentPosition(middle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(middle.compareDocumentPosition(oldest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(getAllSalesOrdersMock).toHaveBeenCalledWith({});
  });

  it('loads the redirected sales order even when it is not present in the initial list page', async () => {
    getAllSalesOrdersMock.mockResolvedValue([
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
      ]);

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
    fetchContactByIdMock.mockResolvedValue({
      id: 'contact-1',
      company: 'Acme Corp',
      transactionType: 'Invoice',
    });

    render(<SalesOrderView initialOrderId="target-order" />);

    await waitFor(() => {
      expect(getSalesOrderMock).toHaveBeenCalledWith('target-order');
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('SO-TARGET')).toBeInTheDocument();
    });
  });

  it('shows the informational over-credit warning when balance exceeds credit limit', async () => {
    getAllSalesOrdersMock.mockResolvedValue([
      {
        id: 'target-order',
        order_no: 'SO-TARGET',
        inquiry_id: '',
        contact_id: 'contact-1',
        sales_date: '2026-03-13',
        sales_person: 'Redirect Rep',
        delivery_address: 'Target Address',
        reference_no: 'REF-1',
        customer_reference: 'REF-1',
        send_by: '',
        price_group: 'gold',
        credit_limit: 10000,
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
        created_at: '2026-03-13',
        updated_at: '',
        is_deleted: false,
        items: [],
      },
    ]);

    getSalesOrderMock.mockResolvedValue({
      id: 'target-order',
      order_no: 'SO-TARGET',
      inquiry_id: '',
      contact_id: 'contact-1',
      sales_date: '2026-03-13',
      sales_person: 'Redirect Rep',
      delivery_address: 'Target Address',
      reference_no: 'REF-1',
      customer_reference: 'REF-1',
      send_by: '',
      price_group: 'gold',
      credit_limit: 10000,
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
      created_at: '2026-03-13',
      updated_at: '',
      is_deleted: false,
      items: [],
    });

    fetchContactsMock.mockResolvedValue([
      {
        id: 'contact-1',
        company: 'Acme Corp',
        transactionType: 'Invoice',
        balance: 15000,
        creditLimit: 10000,
      },
    ]);
    fetchContactByIdMock.mockResolvedValue({
      id: 'contact-1',
      company: 'Acme Corp',
      transactionType: 'Invoice',
      balance: 15000,
      creditLimit: 10000,
    });

    render(<SalesOrderView initialOrderId="target-order" />);

    expect(await screen.findByText(/balance exceeds credit limit\./i)).toHaveTextContent(/does not block the sales order flow/i);
  });
});
