import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = {
  getSuppliers: vi.fn(),
  getEligiblePurchaseOrders: vi.fn(),
  getEligiblePurchaseOrderDetails: vi.fn(),
};

vi.mock('../../services/receivingService', () => ({ receivingService: service }));
vi.mock('../ToastProvider', () => ({ useToast: () => ({ addToast: vi.fn() }) }));
vi.mock('../CustomLoadingSpinner', () => ({ default: () => <span>Loading spinner</span> }));
vi.mock('../SearchableSelect', () => ({
  default: () => <select aria-label="Posted PO Reference"><option value="">Select posted PO...</option></select>,
}));

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  service.getSuppliers.mockResolvedValue([]);
  service.getEligiblePurchaseOrders.mockResolvedValue([]);
  service.getEligiblePurchaseOrderDetails.mockResolvedValue({});
});

describe('ReceivingForm', () => {
  it('does not show unit cost, line total, or grand total', async () => {
    const { default: ReceivingForm } = await import('../ReceivingStock/ReceivingForm');
    render(<ReceivingForm onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: /receiving stock/i })).toBeInTheDocument();
    expect(screen.queryByText('Unit Cost')).not.toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.queryByText('Grand Total')).not.toBeInTheDocument();
    expect(screen.getByText('Qty Recv')).toBeInTheDocument();
  });

  it('loads the linked PO and remaining quantities when opened from a PO shortcut', async () => {
    service.getEligiblePurchaseOrderDetails.mockResolvedValue({
      po_number: 'PO-2601',
      pr_reference: 'PR-2601',
      order_date: '2026-10-22',
      supplier_id: 'S1',
      supplier: { company: 'Supplier 1' },
      items: [{
        id: 'POITEM-1',
        item_id: 'P1',
        qty: 5,
        quantity_received: 2,
        unit_price: 10,
        product: { item_code: 'ITEM-1', part_no: 'PART-1', description: 'Part 1' },
      }],
    });
    const { default: ReceivingForm } = await import('../ReceivingStock/ReceivingForm');
    render(<ReceivingForm initialPurchaseOrderRefNo="POREF-1" onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(service.getEligiblePurchaseOrderDetails).toHaveBeenCalledWith('POREF-1'));
    expect(await screen.findByDisplayValue('Supplier 1')).toBeInTheDocument();
    expect(await screen.findByText('Part 1')).toBeInTheDocument();
  });
});
