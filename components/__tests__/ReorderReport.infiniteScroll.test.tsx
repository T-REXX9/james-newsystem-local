import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReorderReport from '../ReorderReport';

const { fetchEntriesMock, addToastMock, getPrsMock, getSuppliersMock, generatePrMock, createPrMock } = vi.hoisted(() => ({
  fetchEntriesMock: vi.fn(),
  addToastMock: vi.fn(),
  getPrsMock: vi.fn(),
  getSuppliersMock: vi.fn(),
  generatePrMock: vi.fn(),
  createPrMock: vi.fn(),
}));

vi.mock('../../services/reorderReportService', () => ({
  REORDER_WAREHOUSE_OPTIONS: [
    { id: 'total', label: 'Total Company' },
    { id: 'wh1', label: 'WH1' },
  ],
  fetchReorderReportEntries: fetchEntriesMock,
  hideReorderReportItems: vi.fn(),
  isReorderWorkflowActive: (row: any) => Boolean(row.pr_refno || row.po_refno) && row.rr_status !== 'Posted',
  getReorderWorkflowStages: (row: any) => ({
    pr: row.pr_status || (row.pr_refno ? 'Active' : 'Not started'),
    po: row.po_status || (row.po_refno ? 'Active' : 'Not started'),
    receiving: row.rr_status || (row.rr_refno ? 'Active' : 'Not started'),
  }),
}));

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

const reportRow = (id: string, itemCode: string) => ({
  id,
  product_session: `session-${id}`,
  item_code: itemCode,
  part_no: `PART-${id}`,
  description: `Description ${id}`,
  is_hidden: false,
  reorder_qty: 10,
  replenish_qty: 5,
  current_stock: 1,
  total_rr: 0,
  total_return: 0,
  target_quantity: 10,
  pr_refno: '',
  pr_no: '',
  pr_status: '',
  po_refno: '',
  po_no: '',
  po_status: '',
  rr_refno: '',
  rr_no: '',
  rr_status: '',
  last_arrival_date: '2026-07-01',
  last_arrival_qty: 3,
});

describe('ReorderReport automatic loading', () => {
  let intersectionCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    getPrsMock.mockResolvedValue([]);
    getSuppliersMock.mockResolvedValue([{ id: 'SUP-1', company: 'Supplier One' }]);
    generatePrMock.mockResolvedValue('PR-2699');
    createPrMock.mockResolvedValue({ id: 'PR-REF-99', pr_number: 'PR-2699' });
    fetchEntriesMock.mockImplementation(async ({ page }: { page: number }) => ({
      items: page === 1 ? [reportRow('1', 'ITEM-1')] : [reportRow('2', 'ITEM-2')],
      meta: { page, per_page: 25, total: 2, total_pages: 2 },
    }));

    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = '';
      thresholds = [];
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('loads the next batch when the end sentinel becomes visible without pagination controls', async () => {
    render(<ReorderReport />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));

    await waitFor(() => expect(screen.getAllByText('ITEM-1').length).toBeGreaterThan(0));
    await waitFor(() => expect(intersectionCallback).not.toBeNull());

    await act(async () => {
      intersectionCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    await waitFor(() => expect(screen.getAllByText('ITEM-2').length).toBeGreaterThan(0));
    expect(fetchEntriesMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2, perPage: 25 }));
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByText('All 2 entries loaded')).toBeInTheDocument();
  });

  it('creates one PR from multiple eligible items and blocks an item already in workflow', async () => {
    fetchEntriesMock.mockResolvedValue({
      items: [
        reportRow('1', 'ITEM-1'),
        reportRow('2', 'ITEM-2'),
        { ...reportRow('3', 'ITEM-3'), pr_refno: 'PR-ACTIVE', pr_no: 'PR-2601', pr_status: 'Pending' },
      ],
      meta: { page: 1, per_page: 25, total: 3, total_pages: 1 },
    });

    render(<ReorderReport />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));
    await waitFor(() => expect(screen.getAllByText('ITEM-3').length).toBeGreaterThan(0));

    const activeCheckbox = screen.getByTitle('This item already has an active purchasing workflow');
    expect(activeCheckbox).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ALL' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to PR' }));

    await screen.findByText('2 item(s) will be added with quantity `1` each (old-system behavior).');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(createPrMock).toHaveBeenCalledTimes(1));
    const payload = createPrMock.mock.calls[0][0];
    expect(payload.items.map((item: any) => item.item_code)).toEqual(['ITEM-1', 'ITEM-2']);
    await screen.findByText('PR-2699');
    expect(screen.getByText('New PR Number')).toBeInTheDocument();
  });
});
