import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReturnToSupplierView from '../ReturnToSupplier/ReturnToSupplierView';
import { SupplierReturn, SupplierReturnItem } from '../../returnToSupplier.types';

const {
  addToastMock,
  deleteReturnItemMock,
  finalizeReturnMock,
  getReturnItemsMock,
  unpostReturnMock,
  updateReturnItemMock,
  updateReturnMock,
} = vi.hoisted(() => ({
  addToastMock: vi.fn(),
  deleteReturnItemMock: vi.fn(),
  finalizeReturnMock: vi.fn(),
  getReturnItemsMock: vi.fn(),
  unpostReturnMock: vi.fn(),
  updateReturnItemMock: vi.fn(),
  updateReturnMock: vi.fn(),
}));

vi.mock('../../services/returnToSupplierService', () => ({
  returnToSupplierService: {
    deleteReturnItem: deleteReturnItemMock,
    finalizeReturn: finalizeReturnMock,
    getReturnItems: getReturnItemsMock,
    unpostReturn: unpostReturnMock,
    updateReturn: updateReturnMock,
    updateReturnItem: updateReturnItemMock,
  },
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

const postedReturn: SupplierReturn = {
  id: 'RTS-REF-9001',
  return_no: 'RS26-9001',
  reference_no: 'RTS-REF-9001',
  return_type: 'purchase',
  return_date: '2026-09-01',
  rr_id: 'RR-REF-7788',
  rr_no: 'RR-7788',
  supplier_id: 'SUP-01',
  supplier_name: 'ACME Parts Supply',
  po_no: 'PO-7788',
  status: 'Posted',
  grand_total: 400,
  remarks: 'Initial posted return',
  created_by: 'Master',
  created_at: '2026-09-01T08:00:00Z',
};

const baseItems: SupplierReturnItem[] = [
  {
    id: 'RTS-ITEM-1',
    return_id: 'RTS-REF-9001',
    rr_item_id: 'RR-ITEM-1',
    item_id: 'INV-001',
    item_code: 'ITEM-001',
    part_no: 'PART-001',
    description: 'Brake pad',
    qty_returned: 2,
    unit_cost: 100,
    total_amount: 200,
    return_reason: 'Damaged box',
    remarks: 'Damaged box',
    created_at: '2026-09-01T08:01:00Z',
  },
  {
    id: 'RTS-ITEM-2',
    return_id: 'RTS-REF-9001',
    rr_item_id: 'RR-ITEM-2',
    item_id: 'INV-002',
    item_code: 'ITEM-002',
    part_no: 'PART-002',
    description: 'Clutch cable',
    qty_returned: 1,
    unit_cost: 200,
    total_amount: 200,
    return_reason: 'Wrong Item',
    remarks: 'Wrong Item',
    created_at: '2026-09-01T08:02:00Z',
  },
];

const cloneItems = () => baseItems.map((item) => ({ ...item }));

describe('ReturnToSupplierView recovery workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReturnItemsMock.mockResolvedValue(cloneItems());
    updateReturnMock.mockResolvedValue(undefined);
    updateReturnItemMock.mockResolvedValue(undefined);
    deleteReturnItemMock.mockResolvedValue(undefined);
    unpostReturnMock.mockResolvedValue(undefined);
    finalizeReturnMock.mockResolvedValue(undefined);
    Object.defineProperty(window, 'print', { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows an Unpost button for a posted return and returns the record to editable state through the service', async () => {
    const onUpdate = vi.fn();
    render(<ReturnToSupplierView returnRecord={postedReturn} onUpdate={onUpdate} />);

    expect(await screen.findByDisplayValue('Brake pad')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /post return to supplier/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^unpost$/i }));
    expect(screen.getByText('Unpost Return to Supplier')).toBeInTheDocument();

    const unpostButtons = screen.getAllByRole('button', { name: /^unpost$/i });
    fireEvent.click(unpostButtons[unpostButtons.length - 1]);

    await waitFor(() => expect(unpostReturnMock).toHaveBeenCalledWith('RTS-REF-9001'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
      title: 'Return unposted',
    }));
  });

  it('lets an unposted return be edited, saved, and posted again using cleaned-up mock data', async () => {
    const onUpdate = vi.fn();
    const pendingReturn = { ...postedReturn, status: 'Pending' as const, remarks: 'Initial pending return' };
    render(<ReturnToSupplierView returnRecord={pendingReturn} onUpdate={onUpdate} />);

    await screen.findByDisplayValue('Brake pad');
    expect(screen.queryByRole('button', { name: /^unpost$/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Initial pending return'), {
      target: { value: 'Supplier accepted correction' },
    });
    fireEvent.change(screen.getByDisplayValue('2'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByDisplayValue('Brake pad'), {
      target: { value: 'Brake pad corrected' },
    });
    fireEvent.click(screen.getByRole('button', { name: /remove PART-002/i }));

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateReturnMock).toHaveBeenCalledWith('RTS-REF-9001', {
      return_date: '2026-09-01',
      remarks: 'Supplier accepted correction',
      po_no: 'PO-7788',
    }));
    expect(updateReturnItemMock).toHaveBeenCalledWith('RTS-ITEM-1', {
      qty_returned: 3,
      unit_cost: 100,
      remarks: 'Damaged box',
      description: 'Brake pad corrected',
    });
    expect(deleteReturnItemMock).toHaveBeenCalledWith('RTS-ITEM-2');
    expect(onUpdate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /post return to supplier/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /post return to supplier/i }).at(-1)!);

    await waitFor(() => expect(finalizeReturnMock).toHaveBeenCalledWith('RTS-REF-9001'));
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });
});
