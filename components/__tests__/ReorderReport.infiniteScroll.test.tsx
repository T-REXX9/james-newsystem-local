import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('../../services/reorderReportService', () => ({
  REORDER_WAREHOUSE_OPTIONS: [
    { id: 'total', label: 'Total Company' },
    { id: 'wh1', label: 'WH1' },
  ],
  fetchReorderReportEntries: fetchEntriesMock,
  fetchReorderSearchOptions: fetchSearchOptionsMock,
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
  physical_stock: 1,
  reserved_stock: 0,
  available_stock: 1,
  total_rr: 0,
  total_return: 0,
  target_quantity: 10,
  suggested_reorder_qty: 10,
  pr_requested_qty: 0,
  preferred_supplier_id: 'SUP-1',
  preferred_supplier_name: 'Supplier One',
  preferred_supplier_cost: 25,
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
  last_arrival_date: '2026-07-01',
  last_arrival_qty: 3,
});

describe('ReorderReport automatic loading', () => {
  let intersectionCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    window.history.replaceState(null, '', '/#/warehouse-reports-reorder-report');
    fetchSearchOptionsMock.mockResolvedValue([
      { value: 'QK6-026', category: 'Item Code' },
      { value: 'P-DN21154', category: 'Part Number' },
      { value: 'OPN-77', category: 'Original Part Number' },
      { value: 'Control Valve', category: 'Description' },
      { value: 'Plunger', category: 'Description' },
      { value: 'Rotor Head', category: 'Description' },
      { value: 'Bosch', category: 'Brand' },
    ]);
    getPrsMock.mockResolvedValue([]);
    getSuppliersMock.mockResolvedValue([{ id: 'SUP-1', company: 'Supplier One' }]);
    generatePrMock.mockResolvedValue('PR-2699');
    createPrMock.mockResolvedValue({ id: 'PR-REF-99', pr_number: 'PR-2699' });
    fetchEntriesMock.mockImplementation(async ({ page }: { page: number }) => ({
      items: page === 1 ? [reportRow('1', 'ITEM-1')] : [reportRow('2', 'ITEM-2')],
      meta: { page, per_page: 50, total: 2, total_pages: 2 },
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
    window.history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('opens directly and smart-searches every product field in realtime', async () => {
    render(<ReorderReport />);
    const reportSearch = await screen.findByRole('combobox', { name: 'Reorder report smart search' });
    await waitFor(() => expect(fetchEntriesMock).toHaveBeenCalledWith(expect.objectContaining({ search: '', page: 1 })));
    expect(screen.getAllByRole('columnheader', { name: /Available\s*Stock/i })).not.toHaveLength(0);
    expect(screen.getAllByRole('columnheader', { name: /Reorder\s*Quantity/i })).not.toHaveLength(0);
    expect(screen.queryByRole('columnheader', { name: /Physical\s*Stock/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Reserved\s*Stock/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Reorder\s*Level/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate Report' })).not.toBeInTheDocument();
    fireEvent.focus(reportSearch);
    const reportSearchListbox = screen.getByRole('listbox', { name: 'Reorder report smart suggestions' });
    expect(reportSearchListbox).toHaveClass('z-50');
    expect(reportSearchListbox.closest('form')).toHaveClass('relative', 'z-40');
    expect(await screen.findByRole('option', { name: /QK6-026.*Item Code/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /P-DN21154.*Part Number/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /OPN-77.*Original Part Number/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Bosch.*Brand/i })).toBeInTheDocument();

    fireEvent.change(reportSearch, { target: { value: 'qk6' } });
    expect(screen.getByRole('option', { name: /QK6-026.*Item Code/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Bosch.*Brand/i })).not.toBeInTheDocument();
    await waitFor(() => expect(fetchEntriesMock).toHaveBeenCalledWith(expect.objectContaining({ search: 'qk6' })));
  });

  it('shows restored rows immediately but refreshes them from the server on return', async () => {
    window.history.replaceState({
      reorderReport: {
        version: 1,
        rows: [reportRow('old', 'STALE-RR')],
        generatedAt: new Date('2026-08-01T08:00:00').toISOString(),
        selectedIds: [],
        searchInput: '',
        appliedSearch: '',
        page: 1,
        meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
        latestCreatedPr: null,
        scrollTop: 0,
      },
    }, '', '/#/warehouse-reports-reorder-report');
    fetchEntriesMock.mockResolvedValueOnce({
      items: [reportRow('fresh', 'FRESH-RR')],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });

    render(<ReorderReport />);

    expect(screen.getAllByText('STALE-RR').length).toBeGreaterThan(0);
    await waitFor(() => expect(fetchEntriesMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1, search: '' })));
    await waitFor(() => expect(screen.getAllByText('FRESH-RR').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryAllByText('STALE-RR')).toHaveLength(0));
  });

  it('force refreshes the loaded report pages from the toolbar', async () => {
    fetchEntriesMock
      .mockResolvedValueOnce({
        items: [reportRow('1', 'ITEM-1')],
        meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
      })
      .mockResolvedValueOnce({
        items: [reportRow('2', 'ITEM-2')],
        meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
      });

    render(<ReorderReport />);
    await waitFor(() => expect(screen.getAllByText('ITEM-1').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => expect(screen.getAllByText('ITEM-2').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryAllByText('ITEM-1')).toHaveLength(0));
  });

  it('shows document quantities even while a generated PO is still pending', async () => {
    fetchEntriesMock.mockResolvedValueOnce({
      items: [{
        ...reportRow('pending-po', 'QK6-026'),
        pr_requested_qty: 15,
        open_pr_qty: 0,
        po_ordered_qty: 15,
        open_po_qty: 0,
        remaining_qty: 15,
        overall_status: 'Awaiting PO',
        can_create_pr: false,
        pr_refno: 'pr-ref',
        pr_no: 'PR-26129',
        pr_status: 'Approved',
        po_refno: 'po-ref',
        po_no: 'PO-26255',
        po_status: 'Pending',
      }],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });

    render(<ReorderReport />);
    const [itemCode] = await screen.findAllByText('QK6-026');
    const cells = itemCode.closest('tr')?.querySelectorAll('td');
    expect(cells?.[9]?.textContent).toBe('15');
    expect(cells?.[11]?.textContent).toBe('15');
    expect(cells?.[12]?.textContent).toBe('-');
    expect(cells?.[13]?.textContent).toBe('0');
  });

  it('shows the configured reorder quantity instead of the suggested purchase quantity', async () => {
    fetchEntriesMock.mockResolvedValueOnce({
      items: [{
        ...reportRow('reorder-display', 'QKM2-045'),
        available_stock: 973,
        reorder_qty: 1000,
        suggested_reorder_qty: 27,
      }],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });

    render(<ReorderReport />);
    const [itemCode] = await screen.findAllByText('QKM2-045');
    const cells = itemCode.closest('tr')?.querySelectorAll('td');
    expect(cells?.[4]?.textContent).toBe('973');
    expect(cells?.[5]?.textContent).toBe('1,000');
  });

  it('opens PR, PO, and receiving records in new tabs without replacing the report', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    fetchEntriesMock.mockResolvedValueOnce({
      items: [{
        ...reportRow('linked', 'ITEM-LINKED'),
        pr_documents: [{ refno: 'pr-ref', number: 'PR-100', requested_qty: 5, request_date: '2026-08-28', status: 'Approved', supplier_id: 'SUP-1', supplier_name: 'Supplier One', po_refno: 'po-ref' }],
        po_documents: [{ refno: 'po-ref', number: 'PO-100', status: 'Posted', supplier_id: 'SUP-1', supplier_name: 'Supplier One', ordered_qty: 5, accepted_qty: 0, outstanding_qty: 5, unit_cost: 25, order_date: '2026-08-28', expected_delivery_date: '2026-08-30', pr_refno: 'pr-ref', pr_number: 'PR-100' }],
        rr_documents: [{ refno: 'rr-ref', number: 'RR-100', status: 'Pending', po_refno: 'po-ref', po_number: 'PO-100', received_qty: 5, accepted_qty: 0, receiving_date: '2026-08-28', received_by: 'User' }],
      }],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });

    render(<ReorderReport />);

    for (const name of ['PR-100', 'PO-100', 'RR-100']) {
      const link = await screen.findByRole('link', { name });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(fireEvent.click(link)).toBe(true);
    }
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('restores the generated report when browser history returns to the report', async () => {
    const firstRender = render(<ReorderReport />);
    await waitFor(() => expect(screen.getAllByText('ITEM-1').length).toBeGreaterThan(0));
    await waitFor(() => expect(window.history.state?.reorderReport?.generatedAt).toBeTruthy());

    const tableScrollContainer = screen.getByTestId('reorder-table-scroll-container');
    Object.defineProperty(tableScrollContainer, 'scrollTop', { configurable: true, value: 180, writable: true });
    fireEvent.scroll(tableScrollContainer);
    expect(window.history.state.reorderReport.scrollTop).toBe(180);

    firstRender.unmount();
    fetchEntriesMock.mockClear();
    render(<ReorderReport />);

    expect(screen.queryByRole('button', { name: 'Generate Report' })).not.toBeInTheDocument();
    expect(screen.getAllByText('ITEM-1').length).toBeGreaterThan(0);
    await waitFor(() => expect(fetchEntriesMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1, search: '' })));
  });

  it('does not expose the removed filter-generation controls', async () => {
    render(<ReorderReport />);
    await waitFor(() => expect(screen.getAllByText('ITEM-1').length).toBeGreaterThan(0));

    expect(screen.queryByRole('button', { name: 'Generate Report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to Filter' })).not.toBeInTheDocument();
  });

  it('loads the next batch when the end sentinel becomes visible without pagination controls', async () => {
    render(<ReorderReport />);

    await waitFor(() => expect(screen.getAllByText('ITEM-1').length).toBeGreaterThan(0));
    await waitFor(() => expect(intersectionCallback).not.toBeNull());

    const tableScrollContainer = screen.getByTestId('reorder-table-scroll-container');
    expect(tableScrollContainer).toHaveClass('overflow-x-hidden', 'overflow-y-auto');
    expect(tableScrollContainer.querySelector('thead')).toHaveClass('sticky', 'top-0');
    expect(tableScrollContainer.querySelector('table')).toHaveClass('w-full', 'table-fixed');
    expect(tableScrollContainer.querySelector('table')).not.toHaveClass('min-w-[2300px]');
    expect(tableScrollContainer.querySelectorAll('col')).toHaveLength(15);

    await act(async () => {
      intersectionCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    await waitFor(() => expect(screen.getAllByText('ITEM-2').length).toBeGreaterThan(0));
    expect(fetchEntriesMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2, perPage: 50 }));
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByText('All 2 entries loaded')).toBeInTheDocument();
  });

  it('selects every eligible item across all report batches', async () => {
    render(<ReorderReport />);
    await waitFor(() => expect(screen.getAllByText('ITEM-1').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('checkbox', { name: 'ALL' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Select ITEM-1' })).toBeChecked());
    expect(await screen.findByRole('checkbox', { name: 'Select ITEM-2' })).toBeChecked();
    expect(screen.getByText('2 item(s) selected')).toBeInTheDocument();
    expect(fetchEntriesMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2, perPage: 100 }));
  });

  it('keeps Add to PR accessible above the list while more items load', async () => {
    let resolveSecondPage: ((value: any) => void) | undefined;
    fetchEntriesMock.mockImplementation(({ page }: { page: number }) => {
      if (page === 1) {
        return Promise.resolve({
          items: [reportRow('1', 'ITEM-1')],
          meta: { page: 1, per_page: 50, total: 2, total_pages: 2 },
        });
      }
      return new Promise((resolve) => {
        resolveSecondPage = resolve;
      });
    });

    render(<ReorderReport />);
    await waitFor(() => expect(screen.getAllByText('ITEM-1').length).toBeGreaterThan(0));

    const actions = screen.getByTestId('reorder-selection-actions');
    const sentinel = screen.getByTestId('reorder-load-more-sentinel');
    expect(actions.compareDocumentPosition(sentinel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select ITEM-1' }));
    expect(screen.getByRole('button', { name: /Add to PR/i })).toBeEnabled();

    await act(async () => {
      intersectionCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    await screen.findByText('Loading more items...');

    fireEvent.click(screen.getByRole('button', { name: /Add to PR/i }));
    await screen.findByText('Each line uses the report’s net suggested quantity and recommended supplier. You can override the supplier for all selected lines below.');

    await act(async () => {
      resolveSecondPage?.({
        items: [reportRow('2', 'ITEM-2')],
        meta: { page: 2, per_page: 50, total: 2, total_pages: 2 },
      });
    });
  });

  it('creates one PR from multiple eligible items and blocks an item already in workflow', async () => {
    fetchEntriesMock.mockResolvedValue({
      items: [
        reportRow('1', 'ITEM-1'),
        reportRow('2', 'ITEM-2'),
        { ...reportRow('3', 'ITEM-3'), pr_refno: 'PR-ACTIVE', pr_no: 'PR-2601', pr_status: 'Pending' },
      ],
      meta: { page: 1, per_page: 50, total: 3, total_pages: 1 },
    });

    render(<ReorderReport />);
    await waitFor(() => expect(screen.getAllByText('ITEM-3').length).toBeGreaterThan(0));

    const activeCheckbox = screen.getByTitle('This item already has an active purchasing workflow');
    expect(activeCheckbox).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ALL' }));
    fireEvent.click(screen.getByRole('button', { name: /Add to PR/i }));

    await screen.findByText('Each line uses the report’s net suggested quantity and recommended supplier. You can override the supplier for all selected lines below.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(createPrMock).toHaveBeenCalledTimes(1));
    const payload = createPrMock.mock.calls[0][0];
    expect(payload.items.map((item: any) => item.item_code)).toEqual(['ITEM-1', 'ITEM-2']);
    expect(payload.items.map((item: any) => item.quantity)).toEqual([10, 10]);
    expect(payload.items.map((item: any) => item.supplier_id)).toEqual(['SUP-1', 'SUP-1']);
    await screen.findByText('PR-2699');
    expect(screen.getByText('PR Created:')).toBeInTheDocument();
  });

  it('does not show historical fallback documents in an active Needs PR row', async () => {
    fetchEntriesMock.mockResolvedValue({
      items: [{
        ...reportRow('1', 'ITEM-1'),
        overall_status: 'Needs PR',
        can_create_pr: true,
        po_refno: 'OLD-PO-REF',
        po_no: 'PO-2160',
        po_status: 'Completed',
        rr_refno: 'OLD-RR-REF',
        rr_no: 'RR-2168',
        rr_status: 'Delivered',
      }],
      meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
    });

    render(<ReorderReport />);
    await waitFor(() => expect(screen.getAllByText('ITEM-1').length).toBeGreaterThan(0));

    expect(screen.queryByText('PO-2160')).not.toBeInTheDocument();
    expect(screen.queryByText('RR-2168')).not.toBeInTheDocument();
    expect(screen.getAllByText('Needs PR').length).toBeGreaterThan(0);
  });
});
