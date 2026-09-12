import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SalesInquiryView, { canGenerateSalesOrderFromInquiry } from '../SalesInquiryView';

const html2canvasMock = vi.hoisted(() => vi.fn());
const addToastMock = vi.fn();
const createSalesInquiryMock = vi.fn();
const updateSalesInquiryMock = vi.fn();
const getAllSalesInquiriesMock = vi.fn();
const getSalesInquiryMock = vi.fn();
const approveInquiryMock = vi.fn();
const fetchContactsMock = vi.fn();
const fetchContactByIdMock = vi.fn();
const getProductPriceMock = vi.fn();
const fetchProductByIdMock = vi.fn();
const dispatchWorkflowNotificationMock = vi.fn();
const markNotificationsAsReadByEntityKeyMock = vi.fn();
const resolveNotificationUserIdMock = vi.fn();
const fetchCouriersMock = vi.fn();
const fetchRemarkTemplatesMock = vi.fn();

vi.mock('html2canvas', () => ({
  default: (...args: any[]) => html2canvasMock(...args),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({
    addToast: addToastMock,
  }),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  fetchContacts: (...args: any[]) => fetchContactsMock(...args),
  fetchContactById: (...args: any[]) => fetchContactByIdMock(...args),
}));

vi.mock('../../services/salesInquiryLocalApiService', () => ({
  createSalesInquiry: (...args: any[]) => createSalesInquiryMock(...args),
  getAllSalesInquiries: (...args: any[]) => getAllSalesInquiriesMock(...args),
  approveInquiry: (...args: any[]) => approveInquiryMock(...args),
  convertToOrder: vi.fn(),
  updateSalesInquiry: (...args: any[]) => updateSalesInquiryMock(...args),
  getSalesInquiry: (...args: any[]) => getSalesInquiryMock(...args),
  deleteSalesInquiry: vi.fn(),
}));

vi.mock('../../services/localAuthService', () => ({
  getLocalAuthSession: vi.fn(() => ({
    context: { user: { id: 64 } },
    userProfile: { id: '64', role: 'Sales Agent', full_name: 'test' },
  })),
}));

vi.mock('../../services/productLocalApiService', () => ({
  getProductPrice: (...args: any[]) => getProductPriceMock(...args),
  fetchProductById: (...args: any[]) => fetchProductByIdMock(...args),
}));

vi.mock('../../services/notificationLocalApiService', () => ({
  dispatchWorkflowNotification: (...args: any[]) => dispatchWorkflowNotificationMock(...args),
  markNotificationsAsReadByEntityKey: (...args: any[]) => markNotificationsAsReadByEntityKeyMock(...args),
  resolveNotificationUserId: (...args: any[]) => resolveNotificationUserIdMock(...args),
}));

vi.mock('../../services/courierLocalApiService', () => ({
  fetchCouriers: (...args: any[]) => fetchCouriersMock(...args),
}));

vi.mock('../../services/remarkTemplateLocalApiService', () => ({
  fetchRemarkTemplates: (...args: any[]) => fetchRemarkTemplatesMock(...args),
}));

vi.mock('../../services/salesOrderLocalApiService', () => ({
  getSalesOrderByInquiry: vi.fn(),
}));

vi.mock('../../services/salesOrderService', () => ({
  getSalesOrder: vi.fn(),
}));

const getVipTierConfigMock = vi.fn();
const getLedgerMock = vi.fn();

vi.mock('../../services/vipTierSettingsService', () => ({
  getVipTierConfig: (...args: any[]) => getVipTierConfigMock(...args),
}));

vi.mock('../../services/customerLedgerService', () => ({
  customerLedgerService: {
    getLedger: (...args: any[]) => getLedgerMock(...args),
  },
}));

vi.mock('../CustomerAutocomplete', () => ({
  default: ({
    contacts,
    selectedCustomer,
    disabled,
    onSelect,
  }: {
    contacts: Array<{ id: string; company: string }>;
    selectedCustomer?: { id: string } | null;
    disabled?: boolean;
    onSelect: (customer: { id: string; company: string }) => void;
  }) => (
    <select
      aria-label="Customer"
      disabled={disabled}
      value={selectedCustomer?.id || ''}
      onChange={(event) => {
        const customer = contacts.find((entry) => entry.id === event.target.value);
        if (customer) onSelect(customer);
      }}
    >
      <option value="">Select customer</option>
      {contacts.map((contact) => (
        <option key={contact.id} value={contact.id}>
          {contact.company}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('../ProductSearchModal', () => ({
  default: ({ isOpen, onSelect, onClose }: { isOpen: boolean; onSelect: (product: any) => void; onClose: () => void }) => {
    if (!isOpen) return null;
    return (
      <button
        type="button"
        onClick={() => {
          onSelect({
            id: 'p-1',
            part_no: 'PN-1',
            item_code: 'IC-1',
            description: 'Widget',
            brand: 'Acme',
            price_aa: 100,
          });
          onClose();
        }}
      >
        Select Product
      </button>
    );
  },
}));

const baseContacts = [
  {
    id: 'c-1',
    company: 'Acme Corp',
    address: '123 Main St',
    deliveryAddress: '123 Main St',
    salesman: 'Jane Doe',
    priceGroup: 'vip 1',
    creditLimit: 10000,
    terms: '30 days',
    comment: 'Priority',
    dealershipTerms: 'Net 30',
    transactionType: 'Invoice',
    contactPersons: [
      { id: 'cp-1', name: 'Alice', position: '', birthday: '', telephone: '', mobile: '', email: '', enabled: true },
      { id: 'cp-2', name: 'Bob', position: '', birthday: '', telephone: '', mobile: '', email: '', enabled: true },
    ],
  },
  {
    id: 'c-2',
    company: 'No Contacts Inc',
    address: '456 Side St',
    deliveryAddress: '456 Side St',
    salesman: 'John Doe',
    priceGroup: 'vip 1',
    creditLimit: 5000,
    terms: 'COD',
    comment: '',
    dealershipTerms: '',
    transactionType: 'Invoice',
    contactPersons: [],
  },
];

const makeInquiry = (overrides: Record<string, any> = {}) => ({
  id: 'inq-1',
  inquiry_no: 'INQ26-1',
  contact_id: 'c-1',
  sales_date: '2026-01-01',
  sales_time: '09:30:00',
  sales_person: 'Jane Doe',
  delivery_address: '123 Main St',
  reference_no: 'REF-1',
  customer_reference: 'Alice',
  send_by: '',
  price_group: 'regular',
  credit_limit: 10000,
  terms: '30 days',
  promise_to_pay: '',
  po_number: '',
  remarks: '',
  inquiry_type: 'General',
  urgency: 'N/A',
  urgency_date: '',
  grand_total: 0,
  created_by: '1',
  created_at: '2026-01-01',
  updated_at: '',
  status: 'Draft',
  is_deleted: false,
  items: [],
  ...overrides,
});

describe('SalesInquiryView', () => {
  it('blocks Sales Order generation when an inquiry already has a Sales Order reference', () => {
    expect(canGenerateSalesOrderFromInquiry({ status: 'Submitted', so_refno: 'so-22' }, true, true, false, false)).toBe(false);
    expect(canGenerateSalesOrderFromInquiry({ status: 'Submitted', so_refno: '' }, true, true, false, false)).toBe(true);
  });

  it('requires System Access Approve before generating from a draft inquiry', () => {
    expect(canGenerateSalesOrderFromInquiry({ status: 'Pending', so_refno: '' }, true, true, false, false, false)).toBe(false);
    expect(canGenerateSalesOrderFromInquiry({ status: 'Pending', so_refno: '' }, true, true, false, false, true)).toBe(true);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const { getLocalAuthSession } = await import('../../services/localAuthService');
    vi.mocked(getLocalAuthSession).mockReturnValue({
      context: { user: { id: 64 } },
      userProfile: { id: '64', role: 'Sales Agent', full_name: 'test' },
    } as any);
    html2canvasMock.mockResolvedValue({
      toBlob: (callback: BlobCallback) => callback(new Blob(['jpeg-data'], { type: 'image/jpeg' })),
    });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    URL.createObjectURL = vi.fn(() => 'blob:sales-inquiry-jpeg');
    URL.revokeObjectURL = vi.fn();
    fetchContactsMock.mockResolvedValue(baseContacts);
    fetchContactByIdMock.mockImplementation(async (id: string) => baseContacts.find((contact) => contact.id === id) || null);
    getAllSalesInquiriesMock.mockResolvedValue([]);
    getSalesInquiryMock.mockResolvedValue(null);
    approveInquiryMock.mockResolvedValue(null);
    dispatchWorkflowNotificationMock.mockResolvedValue(undefined);
    markNotificationsAsReadByEntityKeyMock.mockResolvedValue(undefined);
    resolveNotificationUserIdMock.mockResolvedValue('user-2');
    fetchCouriersMock.mockResolvedValue({ items: [] });
    fetchRemarkTemplatesMock.mockResolvedValue({ items: [] });
    fetchProductByIdMock.mockImplementation(async (id: string) => (
      id
        ? {
            id,
            part_no: 'PN-1',
            item_code: 'IC-1',
            description: 'Widget',
            brand: 'Acme',
            price_aa: 100,
            price_vip1: 200,
            price_vip2: 300,
            price_vip3: 400,
          }
        : null
    ));
    getProductPriceMock.mockImplementation((_product: any, priceGroup?: string) => {
      // vip1 → 200, vip2 → 300, vip3 → 400 (VIP3 column; 0 when unset)
      const key = String(priceGroup || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
      if (key === 'vip1') return 200;
      if (key === 'vip2') return 300;
      if (key === 'vip3') return 400;
      return 100;
    });
    getVipTierConfigMock.mockResolvedValue({
      one_time_discount_threshold: 10000,
      unlimited_discount_threshold: 30000,
      discount_percentage: 10,
    });
    getLedgerMock.mockResolvedValue({
      metrics: {
        dealership_sales: 125000,
        ishinomoto_sales: 42000,
        monthly_sales: 2500,
        customer_since: '2019-03-01',
        credit_limit: 10000,
        terms: '30 days',
        balance: 0,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows unfiltered inquiries newest to oldest by default', async () => {
    getAllSalesInquiriesMock.mockResolvedValue([
      makeInquiry({ id: 'old', inquiry_no: 'INQ26-1', sales_date: '2026-01-05', created_at: '2026-01-05' }),
      makeInquiry({ id: 'new', inquiry_no: 'INQ26-11', sales_date: '2026-04-08', created_at: '2026-04-08' }),
      makeInquiry({ id: 'mid', inquiry_no: 'INQ26-7', sales_date: '2026-03-20', created_at: '2026-03-20' }),
    ]);

    render(<SalesInquiryView />);

    const newest = await screen.findByText('INQ26-11');
    const middle = await screen.findByText('INQ26-7');
    const oldest = await screen.findByText('INQ26-1');

    expect(newest.compareDocumentPosition(middle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(middle.compareDocumentPosition(oldest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps every Sales Inquiry list column visible without horizontal scrolling', async () => {
    getAllSalesInquiriesMock.mockResolvedValue([makeInquiry()]);

    render(<SalesInquiryView />);

    await screen.findByText('INQ26-1');

    const list = screen.getByTestId('sales-inquiry-list');
    expect(list).toHaveClass('overflow-x-auto', 'lg:overflow-x-hidden');
    expect(list.querySelectorAll('table')).toHaveLength(1);
    expect(list.querySelector('table')).toHaveClass('min-w-[1100px]', 'lg:min-w-0');
    ['Date', 'Customer', 'SI No.', 'SO No.', 'Transaction No.', 'Sales Person', 'Status'].forEach((heading) => {
      expect(within(list).getByText(heading)).toBeVisible();
    });
  });

  it('does not offer Generate SO when the inquiry already has a Sales Order', async () => {
    const inquiry = makeInquiry({
      id: 'inq-with-so',
      inquiry_no: 'INQ26-22',
      status: 'Approved',
      so_refno: 'so-22',
      so_no: 'SO-22',
      items: [{
        id: 'item-22',
        inquiry_id: 'inq-with-so',
        item_id: 'p-1',
        qty: 1,
        part_no: 'PN-1',
        item_code: 'IC-1',
        location: '',
        description: 'Widget',
        unit_price: 100,
        amount: 100,
        remark: 'OnStock',
        approval_status: 'approved',
      }],
    });
    getAllSalesInquiriesMock.mockResolvedValue([inquiry]);
    getSalesInquiryMock.mockResolvedValue(inquiry);

    render(<SalesInquiryView initialInquiryId="inq-with-so" />);

    await waitFor(() => expect(screen.getAllByDisplayValue('INQ26-22').length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: /generate so/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('Open Sales Order').length).toBeGreaterThan(0);
  });

  it('opens a blank draft from Create New when routed to an existing inquiry', async () => {
    const user = userEvent.setup();
    const existingInquiry = makeInquiry({
      id: 'inq-route',
      inquiry_no: 'INQ26-77',
      contact_id: 'c-1',
      delivery_address: 'Existing delivery address',
      po_number: 'PO-EXISTING',
      sales_person: 'Existing Salesperson',
      sales_date: '2026-04-08',
      sales_time: '11:45:00',
      created_at: '2026-04-08',
    });
    const workflowEvents: Array<{ tab: string; payload?: Record<string, string>; mode?: string }> = [];
    window.addEventListener('workflow:navigate', ((event: CustomEvent) => {
      workflowEvents.push(event.detail);
    }) as EventListener);
    getAllSalesInquiriesMock.mockResolvedValue([existingInquiry]);
    getSalesInquiryMock.mockResolvedValue(existingInquiry);

    render(<SalesInquiryView initialInquiryId="inq-route" />);

    await waitFor(() => expect(getSalesInquiryMock).toHaveBeenCalledWith('inq-route'));
    await waitFor(() => expect(screen.getByLabelText('Customer')).toHaveValue('c-1'));
    expect(screen.getByDisplayValue('PO-EXISTING')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create new/i }));

    await waitFor(() => expect(screen.getByLabelText('Customer')).toHaveValue(''));
    expect(screen.queryByDisplayValue('PO-EXISTING')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Existing delivery address')).not.toBeInTheDocument();
    expect(getSalesInquiryMock).toHaveBeenCalledTimes(1);
    expect(workflowEvents).toContainEqual({
      tab: 'sales-transaction-sales-inquiry',
      payload: undefined,
      mode: 'replace',
    });
  });

  it('shows a validation toast when submitting without a customer', async () => {
    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: /create inquiry/i }));

    expect(addToastMock).toHaveBeenCalledWith({
      type: 'warning',
      title: 'Fix validation issues',
      description: 'Review the highlighted fields and try again.',
    });
    expect(createSalesInquiryMock).not.toHaveBeenCalled();
  });

  it('exports the sales inquiry print layout as a JPEG', async () => {
    const user = userEvent.setup();
    getAllSalesInquiriesMock.mockResolvedValue([
      makeInquiry({
        id: 'inq-export',
        inquiry_no: 'INQ26-99',
        reference_no: 'REF-STALE-99',
        contact_id: 'c-1',
        sales_date: '2026-04-08',
        created_at: '2026-04-08',
        items: [
          {
            id: 'item-1',
            inquiry_id: 'inq-export',
            item_id: 'p-1',
            qty: 2,
            part_no: 'PN-1',
            item_code: 'IC-1',
            location: '',
            description: 'Widget',
            unit_price: 100,
            amount: 200,
            remark: '',
            approval_status: 'approved',
          },
        ],
      }),
    ]);
    getSalesInquiryMock.mockResolvedValue(
      makeInquiry({
        id: 'inq-export',
        inquiry_no: 'INQ26-99',
        reference_no: 'REF-STALE-99',
        contact_id: 'c-1',
        sales_date: '2026-04-08',
        created_at: '2026-04-08',
        items: [
          {
            id: 'item-1',
            inquiry_id: 'inq-export',
            item_id: 'p-1',
            qty: 2,
            part_no: 'PN-1',
            item_code: 'IC-1',
            location: '',
            description: 'Widget',
            unit_price: 100,
            amount: 200,
            remark: '',
            approval_status: 'approved',
          },
        ],
      })
    );

    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());
    await user.click(await screen.findByText('INQ26-99'));
    await waitFor(() => expect(getSalesInquiryMock).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /export jpeg/i }));

    await waitFor(() => expect(html2canvasMock).toHaveBeenCalledTimes(1));
    const [capturedElement, options] = html2canvasMock.mock.calls[0];
    expect(capturedElement).toHaveTextContent('CUSTOMER INQUIRY');
    expect(capturedElement).toHaveTextContent('INQ26-99');
    expect(capturedElement).not.toHaveTextContent('REF-STALE-99');
    expect(capturedElement).not.toHaveTextContent('TND OPC');
    expect(capturedElement).not.toHaveTextContent('Filtered By:');
    expect(options.backgroundColor).toBe('#ffffff');
    expect(options.width).toBeGreaterThan(0);
    expect(options.height).toBeGreaterThan(0);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sales-inquiry-jpeg');
    expect(addToastMock).toHaveBeenCalledWith({ type: 'success', message: 'Sales inquiry JPEG exported.' });
  });

  it('keeps the logged-in creator as Sales Person when a customer with another agent is selected', async () => {
    const user = userEvent.setup();
    render(<SalesInquiryView />);
    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Create New' }));
    await user.selectOptions(screen.getByLabelText('Customer'), 'c-1');

    // Customer salesman is Jane Doe; creator session is "test".
    expect(screen.getByDisplayValue('test')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Jane Doe')).not.toBeInTheDocument();
  });

  it('auto-selects the first customer contact and keeps PO No. editable when creating an inquiry', async () => {
    const user = userEvent.setup();
    createSalesInquiryMock.mockImplementation(async (data: { contact_id: string; reference_no: string }) => ({
      id: 'inq-1',
      contact_id: data.contact_id,
      inquiry_no: data.reference_no,
      reference_no: data.reference_no,
    }));

    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText('Customer'), 'c-1');

    const yourReferenceRow = screen.getByText('Your Reference:').closest('tr');
    expect(yourReferenceRow).toBeTruthy();
    const yourReferenceSelect = within(yourReferenceRow as HTMLElement).getByRole('combobox');
    expect(yourReferenceSelect).toHaveValue('Alice');

    const referenceOptions = within(yourReferenceSelect).getAllByRole('option').map((option) => option.textContent);
    expect(referenceOptions).toEqual(expect.arrayContaining(['Alice', 'Bob']));

    await user.selectOptions(yourReferenceSelect, 'Bob');
    expect(yourReferenceSelect).toHaveValue('Bob');

    const poRow = screen.getByText('PO No.:').closest('tr');
    expect(poRow).toBeTruthy();
    const poInput = within(poRow as HTMLElement).getAllByRole('textbox')[1] as HTMLInputElement;
    await user.type(poInput, 'PO-CUSTOM-001');
    expect(poInput).toHaveValue('PO-CUSTOM-001');

    await user.click(screen.getByRole('button', { name: /add item/i }));
    expect(screen.getByRole('button', { name: 'Select Product' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select Product' }));
    await user.click(screen.getByRole('button', { name: /create inquiry/i }));

    await waitFor(() => expect(createSalesInquiryMock).toHaveBeenCalledTimes(1));

    const payload = createSalesInquiryMock.mock.calls[0][0];
    expect(payload.contact_id).toBe('c-1');
    expect(payload.customer_reference).toBe('Bob');
    expect(payload.po_number).toBe('PO-CUSTOM-001');
    expect(payload.reference_no).toMatch(/^INQ\d{2}-\d+$/);

    const ourReferenceAfterSave = await waitFor(() => screen.getByText('Our Reference:').closest('tr'));
    expect(within(ourReferenceAfterSave as HTMLElement).getByDisplayValue(payload.reference_no)).toBeInTheDocument();
  });

  it('opens a focused modal for adding a not-listed item with only Product No., Description, and Qty', async () => {
    const user = userEvent.setup();

    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText('Customer'), 'c-1');
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.click(screen.getByRole('button', { name: 'Select Product' }));

    await user.click(screen.getByRole('button', { name: 'Not Listed Product' }));

    const modal = screen.getByRole('dialog', { name: 'Add Not Listed Product' });
    expect(within(modal).getByLabelText('Product No.')).toBeInTheDocument();
    expect(within(modal).getByLabelText('Description')).toBeInTheDocument();
    expect(within(modal).getByLabelText('Qty')).toBeInTheDocument();
    expect(within(modal).queryByLabelText('Item Code')).not.toBeInTheDocument();
    expect(within(modal).queryByLabelText('Unit Price')).not.toBeInTheDocument();

    await user.type(within(modal).getByLabelText('Product No.'), 'PN-MANUAL-1');
    await user.type(within(modal).getByLabelText('Description'), 'Special filter');
    await user.clear(within(modal).getByLabelText('Qty'));
    await user.type(within(modal).getByLabelText('Qty'), '3');
    await user.click(within(modal).getByRole('button', { name: 'Add Item' }));

    expect(screen.queryByRole('dialog', { name: 'Add Not Listed Product' })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('PN-MANUAL-1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SPECIAL FILTER')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    expect(screen.getByText('NotListed')).toBeInTheDocument();
  });

  it('keeps an incomplete not-listed item in the modal and cancels without adding a row', async () => {
    const user = userEvent.setup();

    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText('Customer'), 'c-1');
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.click(screen.getByRole('button', { name: 'Select Product' }));
    await user.click(screen.getByRole('button', { name: 'Not Listed Product' }));

    const modal = screen.getByRole('dialog', { name: 'Add Not Listed Product' });
    await user.click(within(modal).getByRole('button', { name: 'Add Item' }));

    expect(screen.getByText('Please enter a Product No.')).toBeInTheDocument();
    expect(screen.getByText('Please enter a description.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Add Not Listed Product' })).toBeInTheDocument();

    const modalAfterValidation = screen.getByRole('dialog', { name: 'Add Not Listed Product' });
    await user.type(within(modalAfterValidation).getByRole('textbox', { name: /Product No\./ }), 'PN-MANUAL-1');
    await user.type(within(modalAfterValidation).getByRole('textbox', { name: /Description/ }), 'Special filter');
    await user.clear(within(modalAfterValidation).getByLabelText('Qty'));
    await user.type(within(modalAfterValidation).getByLabelText('Qty'), '0');
    await user.click(within(modalAfterValidation).getByRole('button', { name: 'Add Item' }));

    expect(screen.getByText('Please enter a valid quantity greater than 0.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Add Not Listed Product' })).toBeInTheDocument();

    await user.click(within(modal).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Add Not Listed Product' })).not.toBeInTheDocument();
    expect(screen.queryByText('NotListed')).not.toBeInTheDocument();
  });

  it('shows the generated inquiry number as Our Reference on a new inquiry', async () => {
    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());

    const ourReferenceRow = screen.getByText('Our Reference:').closest('tr');
    expect(ourReferenceRow).toBeTruthy();
    expect(within(ourReferenceRow as HTMLElement).getByDisplayValue(/^INQ\d{2}-\d+$/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/^REF/)).not.toBeInTheDocument();
  });

  it('defaults the inquiry price group from the selected customer', async () => {
    const user = userEvent.setup();
    fetchContactsMock.mockResolvedValue([
      {
        ...baseContacts[0],
        priceGroup: 'gold',
      },
      {
        ...baseContacts[0],
        id: 'c-3',
        company: 'VIP Three Customer',
        priceCode: 'vip 3',
        priceGroup: 'vip3',
      },
    ]);
    fetchContactByIdMock.mockImplementation(async (id: string) => {
      if (id === 'c-3') {
        return {
          ...baseContacts[0],
          id: 'c-3',
          company: 'VIP Three Customer',
          priceCode: 'vip 3',
          priceGroup: 'vip3',
        };
      }
      return { ...baseContacts[0], priceGroup: 'gold' };
    });

    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText('Customer'), 'c-1');

    const priceGroupRow = screen.getByText('Price Code:').closest('tr');
    expect(priceGroupRow).toBeTruthy();
    const priceGroupSelect = within(priceGroupRow as HTMLElement).getByRole('combobox');
    expect(priceGroupSelect).toHaveValue('vip 2');

    await user.selectOptions(screen.getByLabelText('Customer'), 'c-3');
    await waitFor(() => expect(priceGroupSelect).toHaveValue('vip 3'));
  });

  it('reprices existing inquiry items when switching to a customer with a different default price group', async () => {
    const user = userEvent.setup();
    fetchContactsMock.mockResolvedValue([
      {
        ...baseContacts[0],
        priceGroup: 'gold',
      },
      {
        ...baseContacts[1],
        priceGroup: 'silver',
      },
    ]);
    fetchContactByIdMock.mockImplementation(async (id: string) => {
      if (id === 'c-1') {
        return { ...baseContacts[0], priceGroup: 'gold' };
      }
      if (id === 'c-2') {
        return { ...baseContacts[1], priceGroup: 'silver' };
      }
      return null;
    });

    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText('Customer'), 'c-1');
    await user.click(screen.getByRole('button', { name: /add item/i }));
    expect(screen.getByRole('button', { name: 'Select Product' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select Product' }));

    // Use writable vip 2 → DB VIP2 column
    expect(await screen.findByDisplayValue('300')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Customer'), 'c-2');

    // Use writable vip 1 → DB VIP 1 column
    expect(await screen.findByDisplayValue('200')).toBeInTheDocument();
  });

  it('shows an empty Your Reference dropdown when the customer has no contact persons', async () => {
    const user = userEvent.setup();
    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText('Customer'), 'c-2');

    const yourReferenceRow = screen.getByText('Your Reference:').closest('tr');
    expect(yourReferenceRow).toBeTruthy();
    const yourReferenceSelect = within(yourReferenceRow as HTMLElement).getByRole('combobox');
    expect(yourReferenceSelect).toHaveValue('');
    expect(within(yourReferenceSelect).getAllByRole('option')).toHaveLength(1);
    expect(within(yourReferenceSelect).getByRole('option')).toHaveTextContent('Select reference');
  });

  it('shows the legacy informational warning when balance exceeds credit limit', async () => {
    const user = userEvent.setup();
    fetchContactsMock.mockResolvedValue([
      {
        ...baseContacts[0],
        creditLimit: 10000,
        balance: 15000,
      },
    ]);
    fetchContactByIdMock.mockResolvedValue({
      ...baseContacts[0],
      creditLimit: 10000,
      balance: 15000,
    });

    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText('Customer'), 'c-1');

    expect(await screen.findByText(/balance exceeds credit limit\./i)).toHaveTextContent(/informational only/i);
  });

  it('preserves a saved customer reference even when it is no longer in the current contact list', async () => {
    getAllSalesInquiriesMock.mockResolvedValue([
      {
        id: 'inq-legacy',
        inquiry_no: 'INQ26-1',
        contact_id: 'c-1',
        sales_date: '2026-03-24',
        sales_person: 'Jane Doe',
        delivery_address: '123 Main St',
        reference_no: 'REF2603241',
        customer_reference: 'Legacy Ref',
        send_by: '',
        price_group: 'regular',
        credit_limit: 10000,
        terms: '30 days',
        promise_to_pay: '',
        po_number: 'PO-OLD-1',
        remarks: '',
        inquiry_type: 'General',
        urgency: 'N/A',
        urgency_date: '',
        grand_total: 0,
        created_by: '1',
        created_at: '2026-03-24',
        updated_at: '',
        status: 'Draft',
        is_deleted: false,
        items: [],
      },
    ]);

    getSalesInquiryMock.mockResolvedValue({
      id: 'inq-legacy',
      inquiry_no: 'INQ26-1',
      contact_id: 'c-1',
      sales_date: '2026-03-24',
      sales_person: 'Jane Doe',
      delivery_address: '123 Main St',
      reference_no: 'REF2603241',
      customer_reference: 'Legacy Ref',
      send_by: '',
      price_group: 'regular',
      credit_limit: 10000,
      terms: '30 days',
      promise_to_pay: '',
      po_number: 'PO-OLD-1',
      remarks: '',
      inquiry_type: 'General',
      urgency: 'N/A',
      urgency_date: '',
      grand_total: 0,
      created_by: '1',
      created_at: '2026-03-24',
      updated_at: '',
      status: 'Draft',
      is_deleted: false,
      items: [],
    });

    render(<SalesInquiryView />);

    // The page intentionally starts without selecting a record.
    await userEvent.click(await screen.findByText('INQ26-1'));
    await waitFor(() => expect(getSalesInquiryMock).toHaveBeenCalledWith('inq-legacy'));

    const yourReferenceRow = await waitFor(() => screen.getByText('Your Reference:').closest('tr'));
    const yourReferenceSelect = within(yourReferenceRow as HTMLElement).getByRole('combobox');

    expect(yourReferenceSelect).toHaveValue('Legacy Ref');
    const referenceOptions = within(yourReferenceSelect).getAllByRole('option').map((option) => option.textContent);
    expect(referenceOptions).toEqual(expect.arrayContaining(['Legacy Ref', 'Alice', 'Bob']));
  });

  it('shows the inquiry number as Our Reference when a saved reference differs', async () => {
    getAllSalesInquiriesMock.mockResolvedValue([
      makeInquiry({
        id: 'inq-stale-reference',
        inquiry_no: 'INQ26-500',
        reference_no: 'REF2603241',
      }),
    ]);
    getSalesInquiryMock.mockResolvedValue(
      makeInquiry({
        id: 'inq-stale-reference',
        inquiry_no: 'INQ26-500',
        reference_no: 'REF2603241',
      })
    );

    render(<SalesInquiryView />);

    await userEvent.click(await screen.findByText('INQ26-500'));
    await waitFor(() => expect(getSalesInquiryMock).toHaveBeenCalledWith('inq-stale-reference'));

    const ourReferenceRow = await waitFor(() => screen.getByText('Our Reference:').closest('tr'));
    expect(within(ourReferenceRow as HTMLElement).getByDisplayValue('INQ26-500')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('REF2603241')).not.toBeInTheDocument();
  });

  it('saves the inquiry number as the reference for existing inquiries', async () => {
    const user = userEvent.setup();
    const inquiry = makeInquiry({
      id: 'inq-save-reference',
      inquiry_no: 'INQ26-501',
      reference_no: 'REF2603242',
      items: [
        {
          id: 'item-1',
          inquiry_id: 'inq-save-reference',
          item_id: 'p-1',
          qty: 1,
          part_no: 'PN-1',
          item_code: 'IC-1',
          location: '',
          description: 'Widget',
          unit_price: 100,
          amount: 100,
          remark: '',
          approval_status: 'approved',
        },
      ],
    });
    getAllSalesInquiriesMock.mockResolvedValue([inquiry]);
    getSalesInquiryMock.mockResolvedValue(inquiry);
    updateSalesInquiryMock.mockResolvedValue(inquiry);

    render(<SalesInquiryView />);

    await user.click(await screen.findByText('INQ26-501'));
    await waitFor(() => expect(getSalesInquiryMock).toHaveBeenCalledWith('inq-save-reference'));
    await user.click(screen.getByRole('button', { name: /create inquiry/i }));

    await waitFor(() => expect(updateSalesInquiryMock).toHaveBeenCalledTimes(1));
    expect(updateSalesInquiryMock.mock.calls[0][1].reference_no).toBe('INQ26-501');
  });

  it('saves the newly selected customer instead of restoring the original customer', async () => {
    const user = userEvent.setup();
    const inquiry = makeInquiry({
      id: 'inq-customer-change',
      contact_id: 'c-1',
      items: [{
        id: 'item-customer-change',
        inquiry_id: 'inq-customer-change',
        item_id: 'p-1',
        qty: 1,
        part_no: 'PN-1',
        item_code: 'IC-1',
        location: '',
        description: 'Widget',
        unit_price: 100,
        amount: 100,
        remark: '',
        approval_status: 'approved',
      }],
    });
    const replacementCustomer = { ...baseContacts[1], id: 'c-sunle', company: 'Sunle Diesel Calibration' };
    fetchContactsMock.mockResolvedValue([...baseContacts, replacementCustomer]);
    fetchContactByIdMock.mockImplementation(async (id: string) => (
      [...baseContacts, replacementCustomer].find((contact) => contact.id === id) || null
    ));
    getAllSalesInquiriesMock.mockResolvedValue([inquiry]);
    getSalesInquiryMock.mockResolvedValue(inquiry);
    updateSalesInquiryMock.mockResolvedValue({ ...inquiry, contact_id: replacementCustomer.id });

    render(<SalesInquiryView />);

    await user.click(await screen.findByText('INQ26-1'));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Customer' })).toHaveValue('c-1'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Customer' }), replacementCustomer.id);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Customer' })).toHaveValue(replacementCustomer.id));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateSalesInquiryMock).toHaveBeenCalledTimes(1));
    expect(updateSalesInquiryMock.mock.calls[0][1].contact_id).toBe(replacementCustomer.id);
  });

  it('shows preferred brand from the selected customer profile', async () => {
    const user = userEvent.setup();
    fetchContactsMock.mockResolvedValue([
      {
        ...baseContacts[0],
        preferredBrand: 'Ishinomoto',
      },
    ]);
    fetchContactByIdMock.mockResolvedValue({
      ...baseContacts[0],
      preferredBrand: 'Ishinomoto',
    });

    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText('Customer'), 'c-1');

    await waitFor(() => {
      expect(screen.getAllByText('Preferred Brand').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Ishinomoto').length).toBeGreaterThan(0);
    });
  });

  it('shows Ishinomoto Sales and VIP remaining instead of dealership quota', async () => {
    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());

    expect(screen.getByText('Ishinomoto Sales')).toBeInTheDocument();
    expect(screen.getByText('VIP Silver remaining')).toBeInTheDocument();
    expect(screen.getByText('VIP Gold remaining')).toBeInTheDocument();
    expect(screen.getByText('Price Code')).toBeInTheDocument();
    expect(screen.getByText('Discount Code')).toBeInTheDocument();
    expect(screen.getByText('Customer Since')).toBeInTheDocument();
    expect(screen.queryByText('Dealership Since')).not.toBeInTheDocument();
    expect(screen.queryByText('Dealership Sales')).not.toBeInTheDocument();
    expect(screen.queryByText('Dealership Quota')).not.toBeInTheDocument();
    expect(screen.queryByText('Price Group:')).not.toBeInTheDocument();
  });

  it('shows VIP Silver discount and TOTAL to pay on a qualifying first inquiry', async () => {
    const user = userEvent.setup();
    getLedgerMock.mockResolvedValue({
      metrics: {
        dealership_sales: 125000,
        ishinomoto_sales: 42000,
        monthly_sales: 2500,
        last_month_sales: 15000,
        customer_since: '2019-03-01',
        credit_limit: 10000,
        terms: '30 days',
        balance: 0,
      },
      summary_rows: [],
    });
    getAllSalesInquiriesMock.mockResolvedValue([
      makeInquiry({
        id: 'inq-vip',
        inquiry_no: 'INQ26-20478',
        contact_id: 'c-1',
        sales_date: '2026-09-05',
        created_at: '2026-09-05',
        grand_total: 7560,
        items: [
          {
            id: 'item-1',
            inquiry_id: 'inq-vip',
            item_id: 'p-1',
            qty: 1,
            part_no: 'PN-1',
            item_code: 'IC-1',
            location: '',
            description: 'Widget',
            unit_price: 7560,
            amount: 7560,
            remark: '',
            approval_status: 'approved',
          },
        ],
      }),
    ]);
    getSalesInquiryMock.mockResolvedValue(
      makeInquiry({
        id: 'inq-vip',
        inquiry_no: 'INQ26-20478',
        contact_id: 'c-1',
        sales_date: '2026-09-05',
        created_at: '2026-09-05',
        grand_total: 7560,
        items: [
          {
            id: 'item-1',
            inquiry_id: 'inq-vip',
            item_id: 'p-1',
            qty: 1,
            part_no: 'PN-1',
            item_code: 'IC-1',
            location: '',
            description: 'Widget',
            unit_price: 7560,
            amount: 7560,
            remark: '',
            approval_status: 'approved',
          },
        ],
      })
    );

    render(<SalesInquiryView today={new Date('2026-09-06T00:00:00')} />);

    await user.click(await screen.findByText('INQ26-20478'));
    await waitFor(() => expect(getLedgerMock).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByText('10% VIP SILVER = 756.00')).toBeInTheDocument();
      expect(screen.getByText('TOTAL to pay :')).toBeInTheDocument();
      expect(screen.getByText('6804.00')).toBeInTheDocument();
    });
  });

  it('shows VIP Gold discount and TOTAL to pay on a new qualifying inquiry', async () => {
    const user = userEvent.setup();
    getLedgerMock.mockResolvedValue({
      metrics: {
        dealership_sales: 125000,
        ishinomoto_sales: 42000,
        monthly_sales: 2500,
        last_month_sales: 30000,
        customer_since: '2019-03-01',
        credit_limit: 10000,
        terms: '30 days',
        balance: 0,
      },
      summary_rows: [{ year: 2026, month: 1, debit: 1000 }],
    });
    const { container } = render(<SalesInquiryView today={new Date('2026-09-06T00:00:00')} />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText('Customer'), 'c-1');
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    await user.clear(dateInput);
    await user.type(dateInput, '2026-09-05');
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.click(screen.getByRole('button', { name: 'Select Product' }));

    await waitFor(() => {
      expect(screen.getByText('10% VIP GOLD = 20.00')).toBeInTheDocument();
      expect(screen.getByText('TOTAL to pay :')).toBeInTheDocument();
      expect(screen.getByText('180.00')).toBeInTheDocument();
    });
  });

  it('shows VIP Gold when summary rows are non-empty but last month is absent', async () => {
    const user = userEvent.setup();
    const goldInquiryItems = [
      {
        id: 'item-1',
        inquiry_id: 'inq-gold',
        item_id: 'p-1',
        qty: 1,
        part_no: 'PN-1',
        item_code: 'IC-1',
        location: '',
        description: 'Widget',
        unit_price: 1000,
        amount: 1000,
        remark: '',
        approval_status: 'approved',
      },
    ];
    const goldInquiry = makeInquiry({
      id: 'inq-gold',
      inquiry_no: 'INQ26-30000',
      contact_id: 'c-1',
      sales_date: '2026-09-05',
      created_at: '2026-09-05',
      grand_total: 1000,
      items: goldInquiryItems,
    });
    getLedgerMock.mockResolvedValue({
      metrics: {
        dealership_sales: 125000,
        ishinomoto_sales: 42000,
        monthly_sales: 2500,
        last_month_sales: 30000,
        customer_since: '2019-03-01',
        credit_limit: 10000,
        terms: '30 days',
        balance: 0,
      },
      summary_rows: [{ year: 2026, month: 1, debit: 1000 }],
    });
    getAllSalesInquiriesMock.mockResolvedValue([goldInquiry]);
    getSalesInquiryMock.mockResolvedValue(goldInquiry);

    render(<SalesInquiryView today={new Date('2026-09-06T00:00:00')} />);

    await user.click(await screen.findByText('INQ26-30000'));
    await waitFor(() => expect(getLedgerMock).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByText('10% VIP GOLD = 100.00')).toBeInTheDocument();
      expect(screen.getByText('TOTAL to pay :')).toBeInTheDocument();
      expect(screen.getByText('900.00')).toBeInTheDocument();
    });
  });

  it('shows how much more this month is needed for VIP Silver and VIP Gold', async () => {
    const user = userEvent.setup();
    render(<SalesInquiryView />);

    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText('Customer'), 'c-1');

    await waitFor(() => {
      expect(getLedgerMock).toHaveBeenCalled();
      expect(screen.getByText('₱7,500.00')).toBeInTheDocument();
      expect(screen.getByText('₱27,500.00')).toBeInTheDocument();
      expect(screen.getByText('₱42,000.00')).toBeInTheDocument();
    });
  });

  it('keeps catalog unit prices read-only without Edit unit price permission', async () => {
    // Default action permissions leave can_edit_unit_price false.
    const inquiry = makeInquiry({
      id: 'inq-price-locked',
      inquiry_no: 'INQ26-700',
      items: [{
        id: 'item-locked',
        inquiry_id: 'inq-price-locked',
        item_id: 'p-1',
        qty: 1,
        part_no: 'PN-1',
        item_code: 'IC-1',
        location: '',
        description: 'Widget',
        unit_price: 100,
        amount: 100,
        remark: 'OnStock',
        approval_status: 'approved',
      }],
    });
    getAllSalesInquiriesMock.mockResolvedValue([inquiry]);
    getSalesInquiryMock.mockResolvedValue(inquiry);

    render(<SalesInquiryView />);
    await userEvent.click(await screen.findByText('INQ26-700'));
    await waitFor(() => expect(getSalesInquiryMock).toHaveBeenCalledWith('inq-price-locked'));

    const priceInput = await screen.findByRole('spinbutton', { name: 'Unit price for PN-1' }) as HTMLInputElement;
    expect(priceInput.readOnly || priceInput.disabled).toBe(true);
  });

  it('allows catalog unit price edits when Edit unit price permission is granted', async () => {
    const { getLocalAuthSession } = await import('../../services/localAuthService');
    vi.mocked(getLocalAuthSession).mockReturnValue({
      context: { user: { id: 64 } },
      userProfile: {
        id: '64',
        role: 'Sales Agent',
        full_name: 'test',
        user_type: '2',
        action_permissions: {
          global: {
            can_view: true,
            can_approve: true,
            can_add: true,
            can_edit: true,
            can_delete: true,
            can_post: true,
            can_unpost: true,
            can_edit_invoice_number: false,
            can_edit_unit_price: false,
          },
          pages: {
            'Sales Inquiry': {
              can_view: true,
              can_approve: true,
              can_add: true,
              can_edit: true,
              can_delete: true,
              can_post: true,
              can_unpost: true,
              can_edit_invoice_number: false,
              can_edit_unit_price: true,
            },
          },
        },
      },
      token: 'token',
    } as any);

    const inquiry = makeInquiry({
      id: 'inq-price-open',
      inquiry_no: 'INQ26-701',
      items: [{
        id: 'item-open',
        inquiry_id: 'inq-price-open',
        item_id: 'p-1',
        qty: 1,
        part_no: 'PN-1',
        item_code: 'IC-1',
        location: '',
        description: 'Widget',
        unit_price: 100,
        amount: 100,
        remark: 'OnStock',
        approval_status: 'approved',
      }],
    });
    getAllSalesInquiriesMock.mockResolvedValue([inquiry]);
    getSalesInquiryMock.mockResolvedValue(inquiry);

    render(<SalesInquiryView />);
    await userEvent.click(await screen.findByText('INQ26-701'));
    await waitFor(() => expect(getSalesInquiryMock).toHaveBeenCalledWith('inq-price-open'));

    const priceInput = await screen.findByRole('spinbutton', { name: 'Unit price for PN-1' }) as HTMLInputElement;
    expect(priceInput.readOnly).toBe(false);
    expect(priceInput.disabled).toBe(false);
  });

  it('locks catalog unit price on Create New without Edit unit price permission', async () => {
    const user = userEvent.setup();
    render(<SalesInquiryView />);
    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Create New' }));
    await user.selectOptions(screen.getByLabelText('Customer'), 'c-1');
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.click(screen.getByRole('button', { name: 'Select Product' }));

    const priceInput = await screen.findByRole('spinbutton', { name: 'Unit price for PN-1' }) as HTMLInputElement;
    expect(priceInput.readOnly || priceInput.disabled).toBe(true);
  });

  it('allows catalog unit price edits on Create New when Edit unit price permission is granted', async () => {
    const { getLocalAuthSession } = await import('../../services/localAuthService');
    vi.mocked(getLocalAuthSession).mockReturnValue({
      context: { user: { id: 64 } },
      userProfile: {
        id: '64',
        role: 'Sales Agent',
        full_name: 'test',
        user_type: '2',
        action_permissions: {
          global: {
            can_view: true,
            can_approve: true,
            can_add: true,
            can_edit: true,
            can_delete: true,
            can_post: true,
            can_unpost: true,
            can_edit_invoice_number: false,
            can_edit_unit_price: false,
          },
          pages: {
            'Sales Inquiry': {
              can_view: true,
              can_approve: true,
              can_add: true,
              can_edit: true,
              can_delete: true,
              can_post: true,
              can_unpost: true,
              can_edit_invoice_number: false,
              can_edit_unit_price: true,
            },
          },
        },
      },
      token: 'token',
    } as any);

    const user = userEvent.setup();
    render(<SalesInquiryView />);
    await waitFor(() => expect(fetchContactsMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Create New' }));
    await user.selectOptions(screen.getByLabelText('Customer'), 'c-1');
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.click(screen.getByRole('button', { name: 'Select Product' }));

    const priceInput = await screen.findByRole('spinbutton', { name: 'Unit price for PN-1' }) as HTMLInputElement;
    expect(priceInput.readOnly).toBe(false);
    expect(priceInput.disabled).toBe(false);
  });
});
