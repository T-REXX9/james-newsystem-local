import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import InvoiceView from '../InvoiceView';
import { InvoiceStatus } from '../../types';

const getAllInvoicesMock = vi.fn();
const getInvoiceMock = vi.fn();
const fetchContactsMock = vi.fn();
const fetchContactByIdMock = vi.fn();

vi.mock('../../services/invoiceLocalApiService', () => ({
  getInvoice: (...args: any[]) => getInvoiceMock(...args),
  getAllInvoices: (...args: any[]) => getAllInvoicesMock(...args),
  printInvoice: vi.fn(),
  cancelInvoice: vi.fn(),
  updateInvoiceNumber: vi.fn(),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  fetchContacts: (...args: any[]) => fetchContactsMock(...args),
  fetchContactById: (...args: any[]) => fetchContactByIdMock(...args),
}));

vi.mock('../../services/localAuthService', () => ({
  getLocalAuthSession: vi.fn(() => ({
    userProfile: { id: 'user-1', role: 'Owner' },
    context: { user: { id: 1, type: 'Owner' }, user_type: 'Owner' },
  })),
}));

vi.mock('../../services/salesOrderLocalApiService', () => ({
  isInvoiceAllowedForTransactionType: () => true,
  syncDocumentPolicyState: vi.fn(),
  unpostSalesOrder: vi.fn(),
}));

vi.mock('../../services/notificationLocalApiService', () => ({
  dispatchWorkflowNotification: vi.fn(),
  markNotificationsAsReadByEntityKey: vi.fn(),
  resolveNotificationUserId: vi.fn(),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('../ModuleRecordAction', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../ModuleRecordLink', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('InvoiceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchContactsMock.mockResolvedValue([
      { id: 'c-1', company: 'E&G DIESEL CALIBRATION', transactionType: 'Invoice' },
    ]);
    fetchContactByIdMock.mockResolvedValue(null);
    getInvoiceMock.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the formatted sales order number instead of the timestamp order id', async () => {
    getAllInvoicesMock.mockResolvedValue([
      {
        id: 'inv-1',
        invoice_no: 'T-01542',
        order_id: '20260827172321',
        sales_no: 'SO26-20478',
        contact_id: 'c-1',
        sales_date: '2026-08-27',
        sales_person: 'Jane',
        delivery_address: '',
        reference_no: '',
        customer_reference: '',
        send_by: '',
        price_group: '',
        credit_limit: 0,
        terms: '',
        promise_to_pay: '',
        po_number: '',
        debit_memo_no: 'DM26-12696',
        tracking_no: '',
        inquiry_type: '',
        urgency: '',
        grand_total: 0,
        status: InvoiceStatus.SENT,
        created_by: '',
        created_at: '2026-08-27',
        items: [],
      },
    ]);

    render(<InvoiceView />);

    expect(await screen.findByText('SO26-20478')).toBeInTheDocument();
    expect(screen.getByText('T-01542')).toBeInTheDocument();
    expect(screen.queryByText('20260827172321')).not.toBeInTheDocument();
  });
});
