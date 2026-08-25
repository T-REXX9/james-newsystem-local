import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReturnToSupplierNew from '../ReturnToSupplier/ReturnToSupplierNew';

const { searchRRsMock, getRRItemsForReturnMock, addToastMock } = vi.hoisted(() => ({
  searchRRsMock: vi.fn(),
  getRRItemsForReturnMock: vi.fn(),
  addToastMock: vi.fn(),
}));

vi.mock('../../services/returnToSupplierService', () => ({
  returnToSupplierService: {
    searchRRs: searchRRsMock,
    getRRItemsForReturn: getRRItemsForReturnMock,
    createReturn: vi.fn(),
  },
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

const reports = [
  {
    id: 'RR-REF-1',
    rr_no: 'RR-26390',
    supplier_name: 'QAOJ',
    po_no: 'PO-26301',
    created_at: '2026-08-25',
  },
  {
    id: 'RR-REF-2',
    rr_no: 'RR-26389',
    supplier_name: 'QKYT',
    po_no: 'PO-26300',
    created_at: '2026-08-24',
  },
];

describe('ReturnToSupplierNew receiving report smart search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRRItemsForReturnMock.mockResolvedValue([]);
    searchRRsMock.mockImplementation(async (query: string) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return reports;
      return reports.filter((report) =>
        [report.rr_no, report.supplier_name, report.po_no]
          .some((value) => value.toLowerCase().includes(normalized)),
      );
    });
  });

  afterEach(() => cleanup());

  it('shows available reports on focus and filters the dropdown while typing', async () => {
    render(<ReturnToSupplierNew onClose={vi.fn()} onSuccess={vi.fn()} />);

    const search = screen.getByRole('combobox', { name: 'Receiving report smart search' });
    fireEvent.focus(search);

    expect(await screen.findByRole('option', { name: /RR-26390/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /RR-26389/ })).toBeInTheDocument();
    expect(screen.getByRole('listbox')).toHaveClass('z-50');
    expect(screen.getByRole('listbox').closest('.overflow-visible')).not.toBeNull();
    expect(searchRRsMock).toHaveBeenCalledWith('');

    fireEvent.change(search, { target: { value: 'QKYT' } });

    await waitFor(() => expect(searchRRsMock).toHaveBeenLastCalledWith('QKYT'));
    expect(await screen.findByRole('option', { name: /RR-26389/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /RR-26390/ })).not.toBeInTheDocument();
  });

  it('selects a suggested report and continues to the return form', async () => {
    render(<ReturnToSupplierNew onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.focus(screen.getByRole('combobox', { name: 'Receiving report smart search' }));
    fireEvent.click(await screen.findByRole('option', { name: /RR-26390/ }));

    expect(await screen.findByText('Return Items')).toBeInTheDocument();
    expect(screen.getByText('QAOJ')).toBeInTheDocument();
    expect(screen.getByText('RR-26390')).toBeInTheDocument();
    expect(screen.getByText('PO-26301')).toBeInTheDocument();
  });

  it('opens the item dropdown without crashing when returnable items load', async () => {
    getRRItemsForReturnMock.mockResolvedValue([
      {
        id: 'RR-ITEM-1',
        item_id: 'ITEM-1',
        item_code: 'QK6-022',
        part_number: 'P-DN21150',
        description: 'CONTROL VALVE PLATE',
        quantity_received: 10,
        qty_returned_already: 2,
        unit_cost: 25,
      },
    ]);
    render(<ReturnToSupplierNew onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.focus(screen.getByRole('combobox', { name: 'Receiving report smart search' }));
    fireEvent.click(await screen.findByRole('option', { name: /RR-26390/ }));
    fireEvent.focus(screen.getByPlaceholderText('Search part no, item code, or description from this RR...'));

    expect(await screen.findByText('P-DN21150')).toBeInTheDocument();
    expect(screen.getByText('Available to Return: 8')).toBeInTheDocument();
  });
});
