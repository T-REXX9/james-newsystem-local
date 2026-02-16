import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SalesInquiryView from '../SalesInquiryView';

const addToastMock = vi.fn();
const createSalesInquiryMock = vi.fn();
const refetchInquiriesMock = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    }
  }
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({
    addToast: addToastMock
  })
}));

vi.mock('../../hooks/useRealtimeList', () => ({
  useRealtimeList: () => ({
    data: [
      {
        id: 'c-1',
        company: 'Acme Corp',
        deliveryAddress: '123 Main St',
        salesman: 'Jane Doe',
        priceGroup: 'AA',
        creditLimit: 10000,
        terms: '30 days',
        comment: 'Priority',
        dealershipTerms: 'Net 30'
      }
    ]
  })
}));

vi.mock('../../hooks/useRealtimeNestedList', () => ({
  useRealtimeNestedList: () => ({
    data: [],
    isLoading: false,
    setData: vi.fn(),
    refetch: refetchInquiriesMock
  })
}));

vi.mock('../../services/salesInquiryService', () => ({
  createSalesInquiry: (...args: any[]) => createSalesInquiryMock(...args),
  getAllSalesInquiries: vi.fn(),
  approveInquiry: vi.fn(),
  convertToOrder: vi.fn(),
  updateInquiryStatus: vi.fn()
}));

vi.mock('../../services/productService', () => ({
  getProductPrice: vi.fn(() => 100)
}));

vi.mock('../../services/salesOrderService', () => ({
  getSalesOrderByInquiry: vi.fn()
}));

vi.mock('../../services/supabaseService', () => ({
  fetchContacts: vi.fn(),
  createNotification: vi.fn()
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
            price_aa: 100
          });
          onClose();
        }}
      >
        Select Product
      </button>
    );
  }
}));

describe('SalesInquiryView', () => {
  beforeEach(() => {
    addToastMock.mockReset();
    createSalesInquiryMock.mockReset();
    refetchInquiriesMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a validation toast when submitting without a customer', async () => {
    const user = userEvent.setup();
    render(<SalesInquiryView />);

    const form = document.getElementById('salesInquiryForm') as HTMLFormElement;
    expect(form).toBeTruthy();
    fireEvent.submit(form);

    expect(addToastMock).toHaveBeenCalledWith({
      type: 'warning',
      title: 'Fix validation issues',
      description: 'Review the highlighted fields and try again.'
    });
    expect(createSalesInquiryMock).not.toHaveBeenCalled();
  });

  it('creates a sales inquiry after selecting a customer and product', async () => {
    const user = userEvent.setup();
    createSalesInquiryMock.mockResolvedValue({ id: 'inq-1' });

    render(<SalesInquiryView />);

    const customerLabel = screen.getAllByText(/Customer/i).find((el) => el.tagName.toLowerCase() === 'label');
    expect(customerLabel).toBeTruthy();
    const customerSelect = customerLabel?.parentElement?.querySelector('select') as HTMLSelectElement;
    expect(customerSelect).toBeTruthy();
    await user.selectOptions(customerSelect, 'c-1');

    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.click(screen.getByText(/click to search product/i));
    await user.click(screen.getByRole('button', { name: 'Select Product' }));

    await user.click(screen.getByRole('button', { name: /create inquiry/i }));

    await waitFor(() => expect(createSalesInquiryMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refetchInquiriesMock).toHaveBeenCalledTimes(1));

    const payload = createSalesInquiryMock.mock.calls[0][0];
    expect(payload.contact_id).toBe('c-1');
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toEqual(expect.objectContaining({
      item_id: 'p-1',
      part_no: 'PN-1',
      item_code: 'IC-1',
      description: 'Widget'
    }));

    expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success'
    }));
  });
});
