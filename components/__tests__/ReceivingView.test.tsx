import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PARTIAL_DELIVERY_REASON, remainingQuantityAfterReceipt, shouldCloseRemainingPoQty } from '../../receiving.types';

const service = {
  getReceivingReportById: vi.fn(),
  finalizeReceivingReport: vi.fn(),
  updateReceivingReportItem: vi.fn(),
};
const addToast = vi.fn();

vi.mock('../../services/receivingService', () => ({ receivingService: service }));
vi.mock('../ToastProvider', () => ({ useToast: () => ({ addToast }) }));
vi.mock('../CustomLoadingSpinner', () => ({ default: () => <span>Loading spinner</span> }));
vi.mock('../ModuleRecordLink', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('../RecoveryReasonModal', () => ({ default: () => null }));

const report = {
  id: 'RRREF-1', rr_no: 'RR-2601', receive_date: '2026-08-20', supplier_id: 'S1', supplier_name: 'Supplier 1',
  po_no: 'PO-2601', po_refno: 'POREF-1', remarks: 'Received in good condition', warehouse_id: 'WH1',
  grand_total: 75, status: 'Draft', created_at: '2026-08-20T08:30:00Z', received_by: 'Warehouse User',
  item_count: 1, total_qty: 3, eta_date: null,
  po: { id: 'POREF-1', po_number: 'PO-2601', order_date: '2026-08-01', pr_reference: 'PR-2601', status: 'Posted', items: [{ id: 'POITEM-1', qty: 5, quantity_received: 0, eta_date: '2026-08-22' }] },
  items: [{ id: 'RRITEM-1', rr_id: 'RRREF-1', item_id: 'P1', item_code: 'ITEM-1', part_no: 'PART-1', original_part_no: 'OPN-1', description: 'Part 1', brand: 'Brand 1', po_item_id: 'POITEM-1', qty_ordered: 5, qty_received: 3, qty_returned: 0, unit_cost: 25, total_amount: 75, product: { brand: 'Brand 1' } }],
};

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  service.getReceivingReportById.mockResolvedValue(report);
  service.finalizeReceivingReport.mockResolvedValue(undefined);
  service.updateReceivingReportItem.mockResolvedValue(report.items[0]);
  Object.defineProperty(window, 'print', { configurable: true, value: vi.fn() });
});

describe('ReceivingView', () => {
  it('renders linked PR, PO, ETA, and item details and supports print/history', async () => {
    const { default: ReceivingView } = await import('../ReceivingStock/ReceivingView');
    render(<ReceivingView rrId="RRREF-1" onBack={vi.fn()} onCreateNew={vi.fn()} />);
    expect(await screen.findByText('Receiving Report: RR-2601')).toBeInTheDocument();
    expect(screen.getAllByText('PR-2601').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PO-2601').length).toBeGreaterThan(0);
    expect(screen.getByText(/August 22, 2026|08\/22\/2026/)).toBeInTheDocument();
    expect(screen.getByText('OPN-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /print rr/i }));
    expect(window.print).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /view history/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close history' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('posts incomplete delivery with partial reason without closing remaining PO qty', async () => {
    const { default: ReceivingView } = await import('../ReceivingStock/ReceivingView');
    render(<ReceivingView rrId="RRREF-1" onBack={vi.fn()} onCreateNew={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /post receiving/i }));
    expect(screen.getByText('Incomplete Delivery')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm & post/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(PARTIAL_DELIVERY_REASON));
    fireEvent.click(screen.getByRole('button', { name: /confirm & post/i }));
    await waitFor(() => expect(service.finalizeReceivingReport).toHaveBeenCalledWith('RRREF-1', {
      closeRemainingPoQty: false,
      incompleteDeliveryReason: PARTIAL_DELIVERY_REASON,
    }));
    expect(service.getReceivingReportById).toHaveBeenCalledTimes(2);
  });

  it('closes remaining PO qty for non-partial incomplete delivery reasons', async () => {
    const { default: ReceivingView } = await import('../ReceivingStock/ReceivingView');
    render(<ReceivingView rrId="RRREF-1" onBack={vi.fn()} onCreateNew={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /post receiving/i }));
    fireEvent.click(screen.getByLabelText('Factory out of stock — unable to complete the full delivery'));
    fireEvent.click(screen.getByRole('button', { name: /confirm & post/i }));
    await waitFor(() => expect(service.finalizeReceivingReport).toHaveBeenCalledWith('RRREF-1', {
      closeRemainingPoQty: true,
      incompleteDeliveryReason: 'Factory out of stock — unable to complete the full delivery',
    }));
  });

  it('lets an unposted receiving report be edited and posted again', async () => {
    service.getReceivingReportById.mockResolvedValue({ ...report, status: 'Unposted' });
    const { default: ReceivingView } = await import('../ReceivingStock/ReceivingView');
    render(<ReceivingView rrId="RRREF-1" onBack={vi.fn()} onCreateNew={vi.fn()} />);

    const qtyInput = await screen.findByLabelText('Edit quantity received 1');
    fireEvent.change(qtyInput, { target: { value: '' } });
    expect(qtyInput).toHaveValue(null);
    fireEvent.change(qtyInput, { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Edit unit cost 1'), { target: { value: '20' } });
    expect(screen.queryByTitle('Save item')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Edit item')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /post receiving/i }));
    fireEvent.click(screen.getByLabelText(PARTIAL_DELIVERY_REASON));
    fireEvent.click(screen.getByRole('button', { name: /confirm & post/i }));

    await waitFor(() => expect(service.updateReceivingReportItem).toHaveBeenCalledWith('RRITEM-1', expect.objectContaining({
      rr_id: 'RRREF-1',
      qty_received: 4,
      unit_cost: 20,
    })));
    await waitFor(() => expect(service.finalizeReceivingReport).toHaveBeenCalledWith('RRREF-1', {
      closeRemainingPoQty: false,
      incompleteDeliveryReason: PARTIAL_DELIVERY_REASON,
    }));
  });

  it('posts a complete delivery without asking for an incomplete-delivery reason', async () => {
    service.getReceivingReportById.mockResolvedValue({
      ...report,
      items: [{ ...report.items[0], qty_ordered: 5, qty_received: 5, total_amount: 125 }],
      po: { ...report.po, items: [{ ...report.po.items[0], qty: 5, quantity_received: 0 }] },
    });
    const { default: ReceivingView } = await import('../ReceivingStock/ReceivingView');
    render(<ReceivingView rrId="RRREF-1" onBack={vi.fn()} onCreateNew={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /post receiving/i }));
    expect(screen.queryByText('Incomplete Delivery')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirm & post/i }));
    await waitFor(() => expect(service.finalizeReceivingReport).toHaveBeenCalledWith('RRREF-1'));
  });
});

describe('remainingQuantityAfterReceipt', () => {
  it('treats under-received PO lines as remaining quantity', () => {
    expect(remainingQuantityAfterReceipt(report as any)).toBe(2);
  });

  it('keeps remaining PO lines open when they are omitted from this receiving report', () => {
    expect(remainingQuantityAfterReceipt({
      ...report,
      items: [{ ...report.items[0], qty_ordered: 5, qty_received: 5 }],
      po: {
        ...report.po,
        items: [
          { id: 'POITEM-1', qty: 5, quantity_received: 0, eta_date: '2026-08-22' },
          { id: 'POITEM-2', qty: 4, quantity_received: 0, eta_date: '2026-08-22' },
        ],
      },
    } as any)).toBe(4);
  });

  it('does not close remaining quantity for partial delivery', () => {
    expect(shouldCloseRemainingPoQty(PARTIAL_DELIVERY_REASON)).toBe(false);
    expect(shouldCloseRemainingPoQty('Missing item')).toBe(true);
  });
});
