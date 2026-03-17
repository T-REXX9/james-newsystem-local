import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpecialPrice from '../Maintenance/Product/SpecialPrice';

const addToastMock = vi.fn();
const fetchSpecialPricesMock = vi.fn();
const fetchProductsMock = vi.fn();
const fetchSpecialPriceDetailMock = vi.fn();
const createSpecialPriceMock = vi.fn();
const updateSpecialPriceMock = vi.fn();
const deleteSpecialPriceMock = vi.fn();
const fetchCustomerPickerMock = vi.fn();
const addCustomerMock = vi.fn();

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

vi.mock('../ConfirmModal', () => ({
  default: ({
    isOpen,
    onConfirm,
    onClose,
    title,
    confirmLabel,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onClose: () => void;
    title: string;
    confirmLabel: string;
  }) =>
    isOpen ? (
      <div>
        <div>{title}</div>
        <button
          onClick={async () => {
            await onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('../../services/specialPriceService', () => ({
  addArea: vi.fn(),
  addCategory: vi.fn(),
  addCustomer: (...args: any[]) => addCustomerMock(...args),
  createSpecialPrice: (...args: any[]) => createSpecialPriceMock(...args),
  deleteSpecialPrice: (...args: any[]) => deleteSpecialPriceMock(...args),
  fetchAreaPicker: vi.fn(async () => ({ items: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 0 } })),
  fetchCategoryPicker: vi.fn(async () => ({ items: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 0 } })),
  fetchCustomerPicker: (...args: any[]) => fetchCustomerPickerMock(...args),
  fetchProducts: (...args: any[]) => fetchProductsMock(...args),
  fetchSpecialPriceDetail: (...args: any[]) => fetchSpecialPriceDetailMock(...args),
  fetchSpecialPrices: (...args: any[]) => fetchSpecialPricesMock(...args),
  removeArea: vi.fn(),
  removeCategory: vi.fn(),
  removeCustomer: vi.fn(),
  updateSpecialPrice: (...args: any[]) => updateSpecialPriceMock(...args),
}));

describe('SpecialPrice', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('uses record and product pagination controls to request incremental pages', async () => {
    fetchSpecialPricesMock.mockImplementation(async (_search: string, page: number, perPage: number) => ({
      items: [
        {
          refno: `sp-${page}`,
          item_session: `itm-${page}`,
          item_code: `CODE-${page}`,
          part_no: `PART-${page}`,
          description: `Record ${page}`,
          type: 'Fix Amount',
          amount: page,
        },
      ],
      meta: { page, per_page: perPage, total: 60, total_pages: 3 },
    }));

    fetchProductsMock.mockImplementation(async (search: string, page: number, perPage: number) => ({
      items: [
        {
          lsession: `prod-${search || 'default'}-${page}`,
          litemcode: `ITEM-${search || 'default'}-${page}`,
          lpartno: `PART-${page}`,
          ldescription: `Product ${page}`,
        },
      ],
      meta: { page, per_page: perPage, total: 40, total_pages: 2 },
    }));

    fetchSpecialPriceDetailMock.mockResolvedValue({
      refno: 'sp-1',
      item_session: 'itm-1',
      item_code: 'CODE-1',
      part_no: 'PART-1',
      description: 'Record 1',
      type: 'Fix Amount',
      amount: 10,
      customers: [],
      areas: [],
      categories: [],
    });

    render(<SpecialPrice />);

    await waitFor(() => expect(fetchSpecialPricesMock).toHaveBeenCalledWith('', 1, 25));
    await waitFor(() => expect(fetchProductsMock).toHaveBeenCalledWith('', 1, 20));

    const productSearch = screen.getByPlaceholderText('Search products by code, part no, or description...');
    await userEvent.type(productSearch, 'brake');
    await waitFor(() => expect(fetchProductsMock).toHaveBeenLastCalledWith('brake', 1, 20));

    const nextButtons = screen.getAllByRole('button', { name: 'Next' });
    await userEvent.click(nextButtons[0]);
    await waitFor(() => expect(fetchProductsMock).toHaveBeenLastCalledWith('brake', 2, 20));

    await userEvent.click(nextButtons[1]);
    await waitFor(() => expect(fetchSpecialPricesMock).toHaveBeenLastCalledWith('', 2, 25));
  });

  it('supports create, update, customer association, and delete flows', async () => {
    let detail = {
      refno: 'sp-created',
      item_session: 'prod-1',
      item_code: 'ITEM-1',
      part_no: 'PART-1',
      description: 'Product 1',
      type: 'Fix Amount',
      amount: 50,
      customers: [] as Array<{ patient_refno: string; company: string; patient_code: string }>,
      areas: [],
      categories: [],
    };

    fetchSpecialPricesMock.mockResolvedValue({
      items: [
        {
          refno: 'sp-created',
          item_session: 'prod-1',
          item_code: 'ITEM-1',
          part_no: 'PART-1',
          description: 'Product 1',
          type: 'Fix Amount',
          amount: 50,
        },
      ],
      meta: { page: 1, per_page: 25, total: 1, total_pages: 1 },
    });

    fetchProductsMock.mockResolvedValue({
      items: [
        {
          lsession: 'prod-1',
          litemcode: 'ITEM-1',
          lpartno: 'PART-1',
          ldescription: 'Product 1',
        },
      ],
      meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
    });

    fetchSpecialPriceDetailMock.mockImplementation(async () => detail);
    createSpecialPriceMock.mockImplementation(async () => detail);
    updateSpecialPriceMock.mockImplementation(async (_refno: string, type: string, amount: number) => {
      detail = { ...detail, type, amount };
      return detail;
    });
    fetchCustomerPickerMock.mockResolvedValue({
      items: [{ lsessionid: 'cust-1', lcompany: 'Acme Corp', lpatient_code: 'C-001' }],
      meta: { page: 1, per_page: 100, total: 1, total_pages: 1 },
    });
    addCustomerMock.mockImplementation(async () => {
      detail = {
        ...detail,
        customers: [{ patient_refno: 'cust-1', company: 'Acme Corp', patient_code: 'C-001' }],
      };
      return detail;
    });
    deleteSpecialPriceMock.mockResolvedValue(undefined);

    render(<SpecialPrice />);

    await userEvent.click(await screen.findByText('Product 1'));

    const amountInput = screen.getAllByRole('spinbutton')[0];
    fireEvent.change(amountInput, { target: { value: '50' } });
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(createSpecialPriceMock).toHaveBeenCalledWith('prod-1', 'Fix Amount', 50));

    const updatedAmountInput = await screen.findByDisplayValue('50');
    fireEvent.change(updatedAmountInput, { target: { value: '75' } });
    await userEvent.click(screen.getByRole('button', { name: 'Update Changes' }));
    await waitFor(() => expect(updateSpecialPriceMock).toHaveBeenCalledWith('sp-created', 'Fix Amount', 75));

    await userEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    await waitFor(() => expect(fetchCustomerPickerMock).toHaveBeenCalled());
    await userEvent.click(await screen.findByText('Acme Corp'));
    await userEvent.click(screen.getAllByRole('button', { name: 'Add Customer' })[1]);
    await waitFor(() => expect(addCustomerMock).toHaveBeenCalledWith('sp-created', 'cust-1'));
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await userEvent.click(deleteButtons[0]);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete' }))[1]);
    await waitFor(() => expect(deleteSpecialPriceMock).toHaveBeenCalledWith('sp-created'));
  });
});
