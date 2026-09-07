import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReorderReport from '../ReorderReport';

const { fetchEntriesMock, fetchSearchOptionsMock, addToastMock, getPrsMock, getSuppliersMock, generatePrMock, createPrMock } = vi.hoisted(() => ({
  fetchEntriesMock: vi.fn(),
  fetchSearchOptionsMock: vi.fn(),
  addToastMock: vi.fn(),
  getPrsMock: vi.fn(),
  getSuppliersMock: vi.fn(),
  generatePrMock: vi.fn(),
  createPrMock: vi.fn(),
}));

vi.mock('../../services/reorderReportService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/reorderReportService')>();
  return {
    ...actual,
    fetchReorderReportEntries: fetchEntriesMock,
    fetchReorderSearchOptions: fetchSearchOptionsMock,
    hideReorderReportItems: vi.fn(),
    isReorderWorkflowActive: (row: { pr_refno?: string; po_refno?: string; rr_status?: string }) =>
      Boolean(row.pr_refno || row.po_refno) && row.rr_status !== 'Posted',
  };
});

vi.mock('../../services/purchaseRequestService', () => ({
  purchaseRequestService: {
    getPurchaseRequests: getPrsMock,
    getSuppliers: getSuppliersMock,
    generatePRNumber: generatePrMock,
    createPurchaseRequest: createPrMock,
    addPRItem: vi.fn(),
  },
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

const qkyt = { supplier_id: '11', supplier_code: 'QKYT', supplier_name: 'QKYT', supplier_cost: 48 };
const qjso = { supplier_id: '22', supplier_code: 'QJSO', supplier_name: 'QJSO', supplier_cost: 55 };
const qkhb = { supplier_id: '33', supplier_code: 'QKHB', supplier_name: 'QKHB', supplier_cost: 99 };

const reportRow = (updates: Record<string, unknown> = {}) => ({
  id: '1',
  product_session: 'session-1',
  item_code: 'QK6-022',
  part_no: 'P-DN21150',
  description: 'CONTROL VALVE PLATE',
  is_hidden: false,
  reorder_qty: 15,
  replenish_qty: 15,
  current_stock: 0,
  physical_stock: 0,
  reserved_stock: 0,
  available_stock: 0,
  total_rr: 0,
  total_return: 0,
  target_quantity: 15,
  suggested_reorder_qty: 15,
  pr_requested_qty: 0,
  preferred_supplier_id: qkyt.supplier_id,
  preferred_supplier_name: qkyt.supplier_name,
  preferred_supplier_cost: qkyt.supplier_cost,
  supplier_costs: [qkyt, qjso, qkhb],
  open_pr_qty: 0,
  po_ordered_qty: 0,
  open_po_qty: 0,
  received_qty: 0,
  accepted_qty: 0,
  remaining_qty: 0,
  overall_status: 'Needs PR',
  can_create_pr: true,
  pr_documents: [],
  po_documents: [],
  rr_documents: [],
  pr_refno: '',
  pr_no: '',
  pr_status: '',
  po_refno: '',
  po_no: '',
  po_status: '',
  rr_refno: '',
  rr_no: '',
  rr_status: '',
  last_arrival_date: '',
  last_arrival_qty: 0,
  ...updates,
});

const emptySupplierCog = {
  preferred_supplier_id: '',
  preferred_supplier_name: '',
  preferred_supplier_cost: 0,
  supplier_costs: [],
};

const masterUser = { id: 'master-1', email: 'master@example.com', role: 'Master User', user_type: '1' };

describe('Reorder Report Recommended Supplier COG', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/#/warehouse-reports-reorder-report');
    fetchSearchOptionsMock.mockResolvedValue([]);
    getPrsMock.mockResolvedValue([]);
    getSuppliersMock.mockResolvedValue([
      { id: 'HQ', company: 'HQ' },
      { id: 'FREE GIFT', company: 'FREE GIFT' },
      { id: 'OLD STOCK', company: 'OLD STOCK' },
    ]);
    generatePrMock.mockResolvedValue('PR-2699');
    createPrMock.mockResolvedValue({ id: 'PR-REF-99', pr_number: 'PR-2699' });
    fetchEntriesMock.mockResolvedValue({
      items: [reportRow()],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
    vi.clearAllMocks();
  });

  it('lets the buyer compare every Product Database Supplier COG on the row', async () => {
    render(<ReorderReport />);
    const supplierSelect = await screen.findByRole('combobox', { name: 'Recommended supplier for QK6-022' });

    expect(supplierSelect).toHaveValue('11');
    expect(screen.getByRole('option', { name: /QKYT.*₱48/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /QJSO.*₱55/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /QKHB.*₱99/ })).toBeInTheDocument();
  });

  it('writes the chosen Product Database Supplier COG onto the Purchase Request', async () => {
    render(<ReorderReport />);
    const supplierSelect = await screen.findByRole('combobox', { name: 'Recommended supplier for QK6-022' });
    fireEvent.change(supplierSelect, { target: { value: '22' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select QK6-022' }));
    fireEvent.click(screen.getByRole('button', { name: /Add to PR/i }));

    await screen.findByRole('button', { name: 'Save' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(createPrMock).toHaveBeenCalledTimes(1));
    expect(createPrMock.mock.calls[0][0].items[0]).toEqual(expect.objectContaining({
      supplier_id: '22',
      supplier_name: 'QJSO',
      unit_cost: 55,
    }));
    expect(getSuppliersMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('option', { name: 'HQ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'FREE GIFT' })).not.toBeInTheDocument();
  });

  it('does not invent a supplier when the product has no Supplier COG', async () => {
    fetchEntriesMock.mockResolvedValue({
      items: [reportRow(emptySupplierCog)],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });

    render(<ReorderReport />);
    expect((await screen.findAllByText('QK6-022')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('combobox', { name: 'Recommended supplier for QK6-022' })).not.toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('lets a Master User add Supplier COG from a row that has none', async () => {
    fetchEntriesMock.mockResolvedValue({
      items: [reportRow(emptySupplierCog)],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });

    render(<ReorderReport currentUser={masterUser} />);

    expect(await screen.findByRole('button', { name: 'Add Supplier COG' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Recommended supplier for QK6-022' })).not.toBeInTheDocument();
  });

  it('opens that product on the Product Database Supplier COG tab in a new tab', async () => {
    fetchEntriesMock.mockResolvedValue({
      items: [reportRow(emptySupplierCog)],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<ReorderReport currentUser={masterUser} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Supplier COG' }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(String(url)).toContain('#/warehouse-inventory-product-database?');
    expect(String(url)).toContain('productId=session-1');
    expect(String(url)).toContain('partNo=P-DN21150');
    expect(String(url)).toContain('detailTab=suppliers');
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');
    expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning',
      title: 'New tab was blocked',
    }));
    openSpy.mockRestore();
  });

  it('keeps a dash for warehouse staff when the product has no Supplier COG', async () => {
    fetchEntriesMock.mockResolvedValue({
      items: [reportRow(emptySupplierCog)],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });

    render(<ReorderReport currentUser={{ id: 'wh-1', email: 'warehouse@example.com', role: 'Warehouse Personnel', user_type: '4' }} />);
    expect((await screen.findAllByText('QK6-022')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Add Supplier COG' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Recommended supplier for QK6-022' })).not.toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('keeps the Recommended Supplier dropdown for a Master User when Supplier COG exists', async () => {
    render(<ReorderReport currentUser={masterUser} />);

    expect(await screen.findByRole('combobox', { name: 'Recommended supplier for QK6-022' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Supplier COG' })).not.toBeInTheDocument();
  });
});
