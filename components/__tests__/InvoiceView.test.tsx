import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InvoiceView from '../InvoiceView';
import { InvoiceStatus } from '../../types';

const getAllInvoicesMock = vi.fn();
const getInvoiceMock = vi.fn();
const fetchContactsMock = vi.fn();
const fetchContactByIdMock = vi.fn();
const exportPrintSheetAsJpegMock = vi.fn();
const addToastMock = vi.fn();

vi.mock('../../services/invoiceLocalApiService', () => ({
  getInvoice: (...args: any[]) => getInvoiceMock(...args),
  getAllInvoices: (...args: any[]) => getAllInvoicesMock(...args),
  printInvoice: vi.fn(),
  cancelInvoice: vi.fn(),
  updateInvoiceNumber: vi.fn(),
  unpostInvoice: vi.fn(),
  getInvoiceNumberSequence: vi.fn(async () => ({
    prefix: 'T-',
    pad_width: 0,
    next_number: 1,
    next_invoice_no: 'T-1',
  })),
  setInvoiceNumberSequenceStart: vi.fn(),
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
}));

vi.mock('../../services/notificationLocalApiService', () => ({
  dispatchWorkflowNotification: vi.fn(),
  markNotificationsAsReadByEntityKey: vi.fn(),
  resolveNotificationUserId: vi.fn(),
}));

vi.mock('../../utils/exportPrintSheetJpeg', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/exportPrintSheetJpeg')>()),
  exportPrintSheetAsJpeg: (...args: any[]) => exportPrintSheetAsJpegMock(...args),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

vi.mock('../ModuleRecordAction', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../ModuleRecordLink', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('InvoiceView', () => {
  let offsetWidthSpy: ReturnType<typeof vi.spyOn>;
  let offsetHeightSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    offsetWidthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
    offsetHeightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100);
    fetchContactsMock.mockResolvedValue([
      { id: 'c-1', company: 'E&G DIESEL CALIBRATION', transactionType: 'Invoice' },
    ]);
    fetchContactByIdMock.mockResolvedValue(null);
    getInvoiceMock.mockResolvedValue(null);
    exportPrintSheetAsJpegMock.mockResolvedValue(undefined);
    addToastMock.mockClear();
  });

  afterEach(() => {
    offsetWidthSpy.mockRestore();
    offsetHeightSpy.mockRestore();
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

  it('keeps every Sales Invoice list column visible without desktop horizontal scrolling', async () => {
    getAllInvoicesMock.mockResolvedValue([
      {
        id: 'inv-list-1',
        invoice_no: 'INV26-1001',
        order_id: 'so-1',
        sales_no: 'SO26-1001',
        contact_id: 'c-1',
        sales_date: '2026-09-05',
        sales_person: 'Jane',
        customer_reference: 'CR-1',
        debit_memo_no: 'DM-1',
        tracking_no: 'TRACK-1',
        status: InvoiceStatus.SENT,
        items: [],
      },
    ]);

    render(<InvoiceView />);

    await screen.findByText('INV26-1001');

    const list = screen.getByTestId('sales-invoice-list');
    expect(list).toHaveClass('overflow-x-auto', 'lg:overflow-x-hidden');
    expect(list.querySelectorAll('table')).toHaveLength(1);
    expect(list.querySelector('table')).toHaveClass('min-w-[1100px]', 'lg:min-w-0');
    ['Date', 'Customer', 'SO No.', 'INV No.', 'DM No.', 'Tracking No.', 'CR No.', 'Sales Person', 'Status'].forEach((heading) => {
      expect(within(list).getByText(heading)).toBeVisible();
    });
  });

  it('loads an initial invoice directly when it is outside the loaded invoice list', async () => {
    getAllInvoicesMock.mockResolvedValue([
      {
        id: 'invoice-current',
        invoice_no: 'INV-CURRENT',
        contact_id: 'c-1',
        sales_date: '2026-09-08',
        created_at: '2026-09-08T10:00:00',
        status: InvoiceStatus.SENT,
        items: [],
      },
    ]);
    getInvoiceMock.mockResolvedValue({
      id: 'invoice-old',
      invoice_no: 'INV-OLD',
      contact_id: 'c-1',
      sales_date: '2025-12-15',
      created_at: '2025-12-15T10:00:00',
      status: InvoiceStatus.SENT,
      items: [],
    });

    render(<InvoiceView initialInvoiceId="invoice-old" />);

    await waitFor(() => expect(getInvoiceMock).toHaveBeenCalledWith('invoice-old'));
    expect(screen.getByDisplayValue('INV-OLD')).toBeInTheDocument();
  });

  it('finishes opening a deep-linked invoice under React Strict Mode when it is outside the list', async () => {
    getAllInvoicesMock.mockResolvedValue([]);
    getInvoiceMock.mockResolvedValue({
      id: 'invoice-ledger',
      invoice_no: 'INV-LEDGER',
      contact_id: 'c-1',
      sales_date: '2025-12-15',
      created_at: '2025-12-15T10:00:00',
      status: InvoiceStatus.SENT,
      items: [],
    });

    render(
      <React.StrictMode>
        <InvoiceView initialInvoiceId="invoice-ledger" />
      </React.StrictMode>
    );

    expect(await screen.findByDisplayValue('INV-LEDGER')).toBeInTheDocument();
  });

  it('warns and does not download when Export JPEG is clicked without a selected invoice', async () => {
    getAllInvoicesMock.mockResolvedValue([]);

    render(<InvoiceView />);

    fireEvent.click(await screen.findByRole('button', { name: /export jpeg/i }));

    expect(addToastMock).toHaveBeenCalledWith({
      type: 'warning',
      title: 'Nothing to export',
      description: 'Select an invoice first.',
    });
    expect(exportPrintSheetAsJpegMock).not.toHaveBeenCalled();
  });

  it('exports the A5 invoice print sheet instead of the on-screen invoice form', async () => {
    const invoice = {
      id: 'inv-1',
      invoice_no: 'INV26-1001',
      order_id: 'so-1',
      sales_no: 'SO26-1001',
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
      debit_memo_no: '',
      tracking_no: '',
      inquiry_type: '',
      urgency: '',
      grand_total: 7560,
      vip_applied: true,
      vip_tier: 'silver' as const,
      vip_percentage: 10,
      vip_discount_amount: 756,
      total_to_pay: 6804,
      status: InvoiceStatus.SENT,
      created_by: '',
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

    getAllInvoicesMock.mockResolvedValue([invoice]);
    getInvoiceMock.mockResolvedValue(invoice);
    fetchContactByIdMock.mockResolvedValue({
      id: 'c-1',
      company: 'WT GOMEZ',
      address: 'Taguig',
      vatType: 'Inclusive',
      tin: '123-456',
      terms: '30 days',
      transactionType: 'Invoice',
    });

    render(<InvoiceView />);

    fireEvent.click(await screen.findByText('INV26-1001'));
    fireEvent.click(await screen.findByRole('button', { name: /export jpeg/i }));

    await waitFor(() => expect(exportPrintSheetAsJpegMock).toHaveBeenCalledTimes(1));

    const [{ element, filename }] = exportPrintSheetAsJpegMock.mock.calls[0];
    expect(filename).toBe('INV26-1001-invoice.jpg');
    expect(element).toHaveClass('invoice-print-sheet');
    expect(element).toHaveTextContent('TND OPC');
    expect(element).toHaveTextContent('SALES INVOICE');
    expect(element).toHaveTextContent('WT GOMEZ');
    expect(element).toHaveTextContent('Less: Discount (VIP SILVER)');
    expect(element).toHaveTextContent('TOTAL AMOUNT DUE');
    expect(element.closest('.invoice-print-root')).not.toHaveStyle({ left: '-10000px' });
    expect(element).not.toHaveTextContent('Export JPEG');
    expect(element).not.toHaveTextContent('Print INV');
  });
});
