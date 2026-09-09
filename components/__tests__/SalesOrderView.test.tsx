import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SalesOrderView from '../SalesOrderView';
import { ToastProvider } from '../ToastProvider';

const html2canvasMock = vi.hoisted(() => vi.fn());
const getAllSalesOrdersMock = vi.fn();
const getSalesOrderMock = vi.fn();
const fetchContactsMock = vi.fn();
const fetchContactByIdMock = vi.fn();
const fetchProfilesMock = vi.fn();
const getLedgerMock = vi.fn();
const getVipTierConfigMock = vi.fn();

vi.mock('html2canvas', () => ({
  default: (...args: any[]) => html2canvasMock(...args),
}));

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

vi.mock('../../services/localDataService', () => ({
  dispatchWorkflowNotification: vi.fn(),
  fetchProfiles: (...args: any[]) => fetchProfilesMock(...args),
}));

vi.mock('../../services/customerLedgerService', () => ({
  customerLedgerService: { getLedger: (...args: any[]) => getLedgerMock(...args) },
}));

vi.mock('../../services/vipTierSettingsService', () => ({
  getVipTierConfig: (...args: any[]) => getVipTierConfigMock(...args),
}));

vi.mock('../../services/notificationLocalApiService', () => ({
  markNotificationsAsReadByEntityKey: vi.fn(),
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
  const renderView = (props: React.ComponentProps<typeof SalesOrderView> = {}) =>
    render(
      <ToastProvider>
        <SalesOrderView {...props} />
      </ToastProvider>
    );

  beforeEach(() => {
    vi.clearAllMocks();
    html2canvasMock.mockResolvedValue({
      toBlob: (callback: BlobCallback) => callback(new Blob(['jpeg-data'], { type: 'image/jpeg' })),
    });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    URL.createObjectURL = vi.fn(() => 'blob:sales-order-jpeg');
    URL.revokeObjectURL = vi.fn();
    fetchProfilesMock.mockResolvedValue([]);
    fetchContactByIdMock.mockResolvedValue(null);
    getSalesOrderMock.mockResolvedValue(null);
    getLedgerMock.mockResolvedValue({ metrics: { ishinomoto_sales: 7800, monthly_sales: 29460 } });
    getVipTierConfigMock.mockResolvedValue({
      one_time_discount_threshold: 10000,
      unlimited_discount_threshold: 30000,
      discount_percentage: 10,
    });
  });

  afterEach(() => {
    cleanup();
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

    renderView();

    const newest = await screen.findByText('SO-11');
    const middle = await screen.findByText('SO-7');
    const oldest = await screen.findByText('SO-1');

    expect(newest.compareDocumentPosition(middle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(middle.compareDocumentPosition(oldest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(getAllSalesOrdersMock).toHaveBeenCalledWith({});
  });

  it('keeps every Sales Order list column visible without desktop horizontal scrolling', async () => {
    getAllSalesOrdersMock.mockResolvedValue([makeOrder()]);
    fetchContactsMock.mockResolvedValue([
      { id: 'contact-1', company: 'Acme Corp', transactionType: 'Invoice' },
    ]);

    renderView();

    await screen.findByText('SO-1');

    const list = screen.getByTestId('sales-order-list');
    expect(list).toHaveClass('overflow-x-auto', 'lg:overflow-x-hidden');
    expect(list.querySelectorAll('table')).toHaveLength(1);
    expect(list.querySelector('table')).toHaveClass('min-w-[1100px]', 'lg:min-w-0');
    ['Date', 'Customer', 'SI No.', 'SO No.', 'Transaction No.', 'Sales Person', 'Status'].forEach((heading) => {
      expect(within(list).getByText(heading)).toBeVisible();
    });
  });

  it('shows the customer summary bar with the Sales Inquiry metrics', async () => {
    const order = makeOrder({ id: 'summary-order', order_no: 'SO-SUMMARY', sales_date: '2026-09-09' });
    getAllSalesOrdersMock.mockResolvedValue([order]);
    getSalesOrderMock.mockResolvedValue(order);
    const customer = {
      id: 'contact-1',
      company: 'Acme Corp',
      transactionType: 'Invoice',
      customerSince: '2013-06-01',
      creditLimit: 50000,
      terms: '90DAYS PDC',
      balance: 4556911.24,
      priceCode: 'VIP 1',
      discountCode: 'vip gold',
      preferredBrand: 'ishinomoto',
    };
    fetchContactsMock.mockResolvedValue([customer]);
    fetchContactByIdMock.mockResolvedValue(customer);

    renderView({ initialOrderId: order.id });

    const summary = await screen.findByTestId('sales-order-customer-summary');
    ['Ishinomoto Sales', 'VIP Silver remaining', 'VIP Gold remaining', 'Total Sales for September', 'Customer Since', 'Credit Limit', 'Terms', 'Balance', 'Price Code', 'Discount Code', 'Preferred Brand'].forEach((label) => {
      expect(within(summary).getByText(label)).toBeVisible();
    });
    await waitFor(() => expect(within(summary).getByText('₱7,800')).toBeVisible());
    expect(within(summary).getByText('₱29,460')).toBeVisible();
    expect(within(summary).getByText('Jun 1 2013')).toBeVisible();
    expect(within(summary).getByText('VIP 1')).toBeVisible();
    expect(within(summary).getByText('vip gold')).toBeVisible();
    expect(within(summary).getByText('Ishinomoto')).toBeVisible();
    expect(getLedgerMock).toHaveBeenCalledWith('contact-1', { reportType: 'summary', dateType: 'all' });
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

    renderView({ initialOrderId: 'target-order' });

    await waitFor(() => {
      expect(getSalesOrderMock).toHaveBeenCalledWith('target-order');
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('SO-TARGET')).toBeInTheDocument();
    });
  });

  it('exports the sales order print layout as a JPEG', async () => {
    const user = userEvent.setup();
    getAllSalesOrdersMock.mockResolvedValue([
      makeOrder({ id: 'target-order', order_no: 'SO-TARGET', grand_total: 10.5 }),
    ]);
    getSalesOrderMock.mockResolvedValue(makeOrder({ id: 'target-order', order_no: 'SO-TARGET', grand_total: 10.5 }));
    fetchContactsMock.mockResolvedValue([
      {
        id: 'contact-1',
        company: 'Acme Corp',
        transactionType: 'Invoice',
      },
    ]);

    renderView({ initialOrderId: 'target-order' });

    await screen.findByDisplayValue('SO-TARGET');
    await user.click(screen.getByRole('button', { name: /export jpeg/i }));

    await waitFor(() => expect(html2canvasMock).toHaveBeenCalledTimes(1));
    const [capturedElement, options] = html2canvasMock.mock.calls[0];
    expect(capturedElement).toHaveTextContent('SALES ORDER');
    expect(capturedElement).toHaveTextContent('SO No.:');
    expect(capturedElement).toHaveTextContent('SO-TARGET');
    expect(capturedElement).not.toHaveTextContent('TND OPC');
    expect(capturedElement).not.toHaveTextContent('Filtered By:');
    expect(options.backgroundColor).toBe('#ffffff');
    expect(options.width).toBeGreaterThan(0);
    expect(options.height).toBeGreaterThan(0);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sales-order-jpeg');
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

    renderView({ initialOrderId: 'target-order' });

    expect(await screen.findByText(/balance exceeds credit limit\./i)).toHaveTextContent(/does not block the sales order flow/i);
  });
});
