import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SalesInquiryView from '../SalesInquiryView';

const addToastMock = vi.fn();
const createSalesInquiryMock = vi.fn();
const getAllSalesInquiriesMock = vi.fn();
const getSalesInquiryMock = vi.fn();
const fetchContactsMock = vi.fn();
const fetchContactByIdMock = vi.fn();

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
  approveInquiry: vi.fn(),
  convertToOrder: vi.fn(),
  updateSalesInquiry: vi.fn(),
  getSalesInquiry: (...args: any[]) => getSalesInquiryMock(...args),
  deleteSalesInquiry: vi.fn(),
}));

vi.mock('../../services/productLocalApiService', () => ({
  getProductPrice: vi.fn(() => 100),
}));

vi.mock('../../services/salesOrderLocalApiService', () => ({
  getSalesOrderByInquiry: vi.fn(),
}));

vi.mock('../../services/salesOrderService', () => ({
  getSalesOrder: vi.fn(),
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
    priceGroup: 'regular',
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
    priceGroup: 'regular',
    creditLimit: 5000,
    terms: 'COD',
    comment: '',
    dealershipTerms: '',
    transactionType: 'Invoice',
    contactPersons: [],
  },
];

describe('SalesInquiryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchContactsMock.mockResolvedValue(baseContacts);
    fetchContactByIdMock.mockImplementation(async (id: string) => baseContacts.find((contact) => contact.id === id) || null);
    getAllSalesInquiriesMock.mockResolvedValue([]);
    getSalesInquiryMock.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
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

  it('auto-selects the first customer contact and keeps PO No. editable when creating an inquiry', async () => {
    const user = userEvent.setup();
    createSalesInquiryMock.mockResolvedValue({ id: 'inq-1', contact_id: 'c-1' });

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
    await user.click(screen.getAllByText(/click to search product/i)[0]);
    await user.click(screen.getByRole('button', { name: 'Select Product' }));
    await user.click(screen.getByRole('button', { name: /create inquiry/i }));

    await waitFor(() => expect(createSalesInquiryMock).toHaveBeenCalledTimes(1));

    const payload = createSalesInquiryMock.mock.calls[0][0];
    expect(payload.contact_id).toBe('c-1');
    expect(payload.customer_reference).toBe('Bob');
    expect(payload.po_number).toBe('PO-CUSTOM-001');
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

    await waitFor(() => expect(getSalesInquiryMock).toHaveBeenCalledWith('inq-legacy'));

    const yourReferenceRow = await waitFor(() => screen.getByText('Your Reference:').closest('tr'));
    const yourReferenceSelect = within(yourReferenceRow as HTMLElement).getByRole('combobox');

    expect(yourReferenceSelect).toHaveValue('Legacy Ref');
    const referenceOptions = within(yourReferenceSelect).getAllByRole('option').map((option) => option.textContent);
    expect(referenceOptions).toEqual(expect.arrayContaining(['Legacy Ref', 'Alice', 'Bob']));
  });
});
