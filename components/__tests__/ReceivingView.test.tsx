import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = {
  getReceivingReportById: vi.fn(),
  finalizeReceivingReport: vi.fn(),
};
const addToast = vi.fn();

vi.mock('../../services/receivingService', () => ({ receivingService: service }));
vi.mock('../ToastProvider', () => ({ useToast: () => ({ addToast }) }));
vi.mock('../CustomLoadingSpinner', () => ({ default: () => <span>Loading spinner</span> }));

const report = {
  id: 'RRREF-1', rr_no: 'RR-2601', receive_date: '2026-08-20', supplier_id: 'S1', supplier_name: 'Supplier 1',
  po_no: 'PO-2601', po_refno: 'POREF-1', remarks: 'Received in good condition', warehouse_id: 'WH1',
  grand_total: 75, status: 'Draft', created_at: '2026-08-20T08:30:00Z', received_by: 'Warehouse User',
  item_count: 1, total_qty: 3, eta_date: null,
  po: { id: 'POREF-1', po_number: 'PO-2601', order_date: '2026-08-01', pr_reference: 'PR-2601', status: 'Posted', items: [{ id: 'POITEM-1', qty: 5, eta_date: '2026-08-22' }] },
  items: [{ id: 'RRITEM-1', rr_id: 'RRREF-1', item_id: 'P1', item_code: 'ITEM-1', part_no: 'PART-1', original_part_no: 'OPN-1', description: 'Part 1', brand: 'Brand 1', qty_ordered: 5, qty_received: 3, qty_returned: 0, unit_cost: 25, total_amount: 75, product: { brand: 'Brand 1' } }],
};

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  service.getReceivingReportById.mockResolvedValue(report);
  service.finalizeReceivingReport.mockResolvedValue(undefined);
  Object.defineProperty(window, 'print', { configurable: true, value: vi.fn() });
});

describe('ReceivingView', () => {
  it('renders linked PR, PO, ETA, and item details and supports print/history', async () => {
    const { default: ReceivingView } = await import('../ReceivingStock/ReceivingView');
    render(<ReceivingView rrId="RRREF-1" onBack={vi.fn()} />);
    expect(await screen.findByText('Receiving Report: RR-2601')).toBeInTheDocument();
    expect(screen.getByText('PR-2601')).toBeInTheDocument();
    expect(screen.getByText('PO-2601')).toBeInTheDocument();
    expect(screen.getByText('08/22/2026')).toBeInTheDocument();
    expect(screen.getByText('OPN-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /print rr/i }));
    expect(window.print).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /view history/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close history' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('posts a draft receiving report and refreshes its detail', async () => {
    const { default: ReceivingView } = await import('../ReceivingStock/ReceivingView');
    render(<ReceivingView rrId="RRREF-1" onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /post receiving/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm & post/i }));
    await waitFor(() => expect(service.finalizeReceivingReport).toHaveBeenCalledWith('RRREF-1'));
    expect(service.getReceivingReportById).toHaveBeenCalledTimes(2);
  });
});
