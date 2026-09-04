import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkflowHistoryState } from '../../utils/workflowHistory';

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

const prService = {
  getPurchaseRequests: vi.fn(),
  getPurchaseRequestById: vi.fn(),
  convertToPO: vi.fn(),
};

vi.mock('../../services/purchaseOrderService', () => ({ purchaseOrderService: service }));
vi.mock('../../services/purchaseRequestService', () => ({ purchaseRequestService: prService }));
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
  items: [
    { id: 'ITEM-1', po_id: 'POREF-1', item_id: 'P1', qty: 10, unit_price: 10, amount: 100, eta_date: '2026-08-22', quantity_received: 1, original_part_no: 'OPN-1', rr_refno: 'RRREF-1', rr_number: 'RR-2601', product: { id: 'P1', part_no: 'PART-1', item_code: 'ITEM-1', description: 'Part 1', brand: 'Brand 1' } },
    { id: 'ITEM-2', po_id: 'POREF-1', item_id: 'P2', qty: 4, unit_price: 8, amount: 32, eta_date: '2026-08-23', quantity_received: 0, original_part_no: '', rr_refno: '', rr_number: '', product: { id: 'P2', part_no: 'PART-2', item_code: 'ITEM-2', description: 'Part 2', brand: 'Brand 2' } },
  ],
  item_count: 1, total_qty: 2, first_eta_date: '2026-08-22', creator: null, approver: null,
};

const approvedPR = {
  id: 'PRREF-1',
  pr_number: 'PR-2601',
  status: 'Approved',
  notes: 'Approved note',
  items: [
    {
      id: 'PRITEM-1',
      item_id: 'P1',
      item_code: 'ITEM-1',
      part_number: 'PART-1',
      description: 'Part 1',
      quantity: 5,
      unit: 'PCS',
      unit_cost: 10,
      supplier_id: 'S1',
      supplier_name: 'Supplier 1',
    },
  ],
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
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

  prService.getPurchaseRequests.mockResolvedValue([approvedPR]);
  prService.getPurchaseRequestById.mockResolvedValue(approvedPR);
  prService.convertToPO.mockResolvedValue('POREF-1');
});

describe('PurchaseOrderView', () => {
  it('renders server summary count and ETA and starts the create workflow', async () => {
    const { default: PurchaseOrderView } = await import('../PurchaseOrderView');
    render(<PurchaseOrderView />);
    expect(await screen.findByText('1 Items')).toBeInTheDocument();
    expect(screen.getByText(/ETA: August 22, 2026/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /generate purchase order/i }));
    expect(await screen.findByText('New Purchase Order')).toBeInTheDocument();
    expect(service.generatePONumber).toHaveBeenCalled();
  });

  it('makes the PR number link directly to the matching purchase request record', async () => {
    const navigationSpy = vi.fn();
    window.addEventListener('workflow:navigate', navigationSpy);
    const { default: PurchaseOrderView } = await import('../PurchaseOrderView');

    render(<PurchaseOrderView initialPOId="POREF-1" />);

    const prLink = await screen.findByRole('link', { name: 'PR-2601' });
    expect(prLink).toHaveAttribute('href', '#/warehouse-purchasing-purchase-request?prId=PRREF-1');

    fireEvent.click(prLink);

    const navigationEvent = navigationSpy.mock.calls[0][0] as CustomEvent;
    expect(navigationEvent.type).toBe('workflow:navigate');
    expect(navigationEvent.detail).toEqual(expect.objectContaining({
      tab: 'warehouse-purchasing-purchase-request',
      payload: { prId: 'PRREF-1' },
    }));
    window.removeEventListener('workflow:navigate', navigationSpy);
  });

  it('supports all-month and all-year list filters', async () => {
    const { default: PurchaseOrderView } = await import('../PurchaseOrderView');
    render(<PurchaseOrderView />);

    await screen.findByText('1 Items');
    const monthSelect = screen.getAllByLabelText('Filter by month')[0];
    const yearSelect = screen.getAllByLabelText('Filter by year')[0];
    expect(monthSelect).toHaveTextContent('All Months');
    expect(yearSelect).toHaveTextContent('All Years');

    fireEvent.change(monthSelect, { target: { value: '' } });
    fireEvent.change(yearSelect, { target: { value: '' } });

    await waitFor(() => {
      expect(service.getPurchaseOrders).toHaveBeenCalledWith(expect.objectContaining({
        month: '',
        year: '',
      }));
    });
  });

  it.skip('allows selecting an eligible PR, auto-populates items/supplier, and converts PR to PO', async () => {
    const { default: PurchaseOrderView } = await import('../PurchaseOrderView');
    render(<PurchaseOrderView />);
    fireEvent.click(screen.getAllByRole('button', { name: /generate purchase order/i })[0]);
    expect(await screen.findByText('New Purchase Order')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole('combobox')).toBeInTheDocument(), { timeout: 5000 });

    const prSelect = screen.getByRole('combobox');
    fireEvent.change(prSelect, { target: { value: 'PRREF-1' } });

    expect(await screen.findByText('Source PR:')).toBeInTheDocument();
    expect(screen.getAllByText('PR-2601')[0]).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Supplier 1')[0]).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /create purchase order/i })[0]);
    await waitFor(() => expect(prService.convertToPO).toHaveBeenCalledWith(['PRREF-1'], ''));
  });

  it('opens an initial deep-linked PO even when it is outside the filtered list and saves inline item edits', async () => {
    service.getPurchaseOrders.mockResolvedValueOnce([]);
    const { default: PurchaseOrderView } = await import('../PurchaseOrderView');
    render(<React.StrictMode><PurchaseOrderView initialPOId="POREF-1" /></React.StrictMode>);
    await waitFor(() => {
      const poElements = screen.getAllByText('PO-2601');
      const poElement = poElements.find(el => el.className.includes('font-bold'));
      expect(poElement).toBeInTheDocument();
    });
    expect(service.getPurchaseOrderById).toHaveBeenCalledWith('POREF-1');
    const onRrCheckbox = screen.getByRole('checkbox', { name: /part-1 already on rr rr-2601, 10% completed/i });
    expect(onRrCheckbox).toBeChecked();
    expect(onRrCheckbox).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Open line receiving report RR-2601' })).toHaveAttribute(
      'href',
      '#/warehouse-purchasing-receiving-stock?rrId=RRREF-1&rrRefNo=RR-2601',
    );
    expect(screen.getByText('10%')).toBeInTheDocument();
    const openRrCheckbox = screen.getByRole('checkbox', { name: /part-2 not on rr yet/i });
    expect(openRrCheckbox).not.toBeChecked();
    expect(openRrCheckbox).toBeDisabled();
    fireEvent.click(screen.getAllByTitle('Edit item')[0]);
    fireEvent.change(screen.getAllByLabelText('Edit quantity 1')[0], { target: { value: '3' } });
    fireEvent.change(screen.getAllByLabelText('Edit COGS 1')[0], { target: { value: '12.5' } });
    fireEvent.click(screen.getByTitle('Save item'));
    await waitFor(() => expect(service.updatePurchaseOrderItem).toHaveBeenCalledWith('ITEM-1', expect.objectContaining({ qty: 3, unit_price: 12.5 })));
  });

  it('retraces the previous workflow from a linked purchase order', async () => {
    window.history.replaceState(createWorkflowHistoryState('#/warehouse-reports-reorder-report'), '', '/#/warehouse-purchasing-purchase-order?poId=POREF-1');
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { default: PurchaseOrderView } = await import('../PurchaseOrderView');
    render(<PurchaseOrderView initialPOId="POREF-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
    expect(backSpy).toHaveBeenCalledOnce();
    backSpy.mockRestore();
  });
});
