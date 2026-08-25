import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = {
  getPurchaseOrders: vi.fn(),
  getPurchaseOrderById: vi.fn(),
  getSuppliers: vi.fn(),
  generatePONumber: vi.fn(),
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrder: vi.fn(),
  updatePurchaseOrderItem: vi.fn(),
  addPurchaseOrderItem: vi.fn(),
  deletePurchaseOrderItem: vi.fn(),
  unpostPurchaseOrder: vi.fn(),
};

vi.mock('../../services/purchaseOrderService', () => ({ purchaseOrderService: service }));
vi.mock('../ToastProvider', () => ({ useToast: () => ({ addToast: vi.fn() }) }));
vi.mock('../../services/localAuthService', () => ({ getLocalAuthSession: () => ({ userProfile: { id: '7', role: 'Purchasing Manager' } }) }));
vi.mock('../../services/notificationLocalApiService', () => ({
  dispatchWorkflowNotification: vi.fn().mockResolvedValue(undefined),
  markNotificationsAsReadByEntityKey: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../ProductAutocomplete', () => ({ default: ({ onSelect }: { onSelect: (product: unknown) => void }) => <button type="button" onClick={() => onSelect({ id: 'P2', part_no: 'PART-2', description: 'Part 2' })}>Choose product</button> }));
vi.mock('../SearchableSelect', () => ({ default: ({ onChange }: { onChange: (value: string) => void }) => <select aria-label="Supplier" onChange={event => onChange(event.target.value)}><option value="">Select</option><option value="S1">Supplier 1</option></select> }));

const po = {
  id: 'POREF-1', po_number: 'PO-2601', order_date: '2026-08-20', supplier_id: 'S1', warehouse_id: 'WH1',
  remarks: '', pr_reference: 'PR-2601', status: 'Pending', grand_total: 20,
  supplier: { id: 'S1', company: 'Supplier 1', address: '', transactionType: 'PO' },
  items: [{ id: 'ITEM-1', po_id: 'POREF-1', item_id: 'P1', qty: 2, unit_price: 10, amount: 20, eta_date: '2026-08-22', quantity_received: 0, product: { id: 'P1', part_no: 'PART-1', item_code: 'ITEM-1', description: 'Part 1', brand: 'Brand 1' } }],
  item_count: 1, total_qty: 2, first_eta_date: '2026-08-22', creator: null, approver: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  service.getPurchaseOrders.mockResolvedValue([po]);
  service.getPurchaseOrderById.mockResolvedValue(po);
  service.getSuppliers.mockResolvedValue([po.supplier]);
  service.generatePONumber.mockResolvedValue('PO-2602');
  service.updatePurchaseOrderItem.mockResolvedValue(po.items[0]);
  service.createPurchaseOrder.mockResolvedValue(po);
  service.addPurchaseOrderItem.mockResolvedValue(po.items[0]);
  service.deletePurchaseOrderItem.mockResolvedValue(undefined);
  service.updatePurchaseOrder.mockResolvedValue(po);
  service.unpostPurchaseOrder.mockResolvedValue(po);
});

describe('PurchaseOrderView', () => {
  it('renders server summary count and ETA and starts the create workflow', async () => {
    const { default: PurchaseOrderView } = await import('../PurchaseOrderView');
    render(<PurchaseOrderView />);
    expect(await screen.findByText('1 Items')).toBeInTheDocument();
    expect(screen.getByText(/ETA: Aug 22, 2026/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /generate purchase order/i }));
    expect(await screen.findByText('New Purchase Order')).toBeInTheDocument();
    expect(service.generatePONumber).toHaveBeenCalled();
  });

  it('opens an initial deep-linked PO even when it is outside the filtered list and saves inline item edits', async () => {
    service.getPurchaseOrders.mockResolvedValueOnce([]);
    const { default: PurchaseOrderView } = await import('../PurchaseOrderView');
    render(<React.StrictMode><PurchaseOrderView initialPOId="POREF-1" /></React.StrictMode>);
    expect(await screen.findByText('PO-2601')).toBeInTheDocument();
    expect(service.getPurchaseOrderById).toHaveBeenCalledWith('POREF-1');
    fireEvent.click(await screen.findByTitle('Edit item'));
    fireEvent.change(screen.getByLabelText('Edit quantity 1'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Edit COGS 1'), { target: { value: '12.5' } });
    fireEvent.click(screen.getByTitle('Save item'));
    await waitFor(() => expect(service.updatePurchaseOrderItem).toHaveBeenCalledWith('ITEM-1', expect.objectContaining({ qty: 3, unit_price: 12.5 })));
  });
});
