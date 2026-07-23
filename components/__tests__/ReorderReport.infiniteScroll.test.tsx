import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReorderReport from '../ReorderReport';

const { fetchEntriesMock, addToastMock } = vi.hoisted(() => ({
  fetchEntriesMock: vi.fn(),
  addToastMock: vi.fn(),
}));

vi.mock('../../services/reorderReportService', () => ({
  REORDER_WAREHOUSE_OPTIONS: [
    { id: 'total', label: 'Total Company' },
    { id: 'wh1', label: 'WH1' },
  ],
  fetchReorderReportEntries: fetchEntriesMock,
  hideReorderReportItems: vi.fn(),
}));

vi.mock('../../services/purchaseRequestService', () => ({
  purchaseRequestService: {},
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
  po_refno: '',
  po_no: '',
  rr_refno: '',
  rr_no: '',
  last_arrival_date: '2026-07-01',
  last_arrival_qty: 3,
});

describe('ReorderReport automatic loading', () => {
  let intersectionCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
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
});
