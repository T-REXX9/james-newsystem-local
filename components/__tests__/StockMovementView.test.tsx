import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StockMovementView from '../StockMovementView';
import { fetchStockMovementLogs, searchStockMovementProducts } from '../../services/stockMovementLocalApiService';

vi.mock('../../services/stockMovementLocalApiService', () => ({
  fetchStockMovementLogs: vi.fn(),
  searchStockMovementProducts: vi.fn(),
}));

const product = {
  id: 'ITEM-1',
  part_no: 'PN-100',
  oem_no: '',
  brand: 'ACME',
  barcode: '',
  no_of_pieces_per_box: 1,
  item_code: 'IC-100',
  description: 'Brake pad',
  size: '',
  reorder_quantity: 0,
  status: 'Active' as const,
  category: '',
  descriptive_inquiry: '',
  no_of_holes: '',
  replenish_quantity: 0,
  original_pn_no: '',
  application: '',
  no_of_cylinder: '',
  price_aa: 0,
  price_bb: 0,
  price_cc: 0,
  price_dd: 0,
  price_vip1: 0,
  price_vip2: 0,
  stock_wh1: 7,
  stock_wh2: 0,
  stock_wh3: 0,
  stock_wh4: 0,
  stock_wh5: 0,
  stock_wh6: 0,
};

const logs = [
  {
    id: '1',
    item_id: 'ITEM-1',
    date: '2026-05-21T08:00:00',
    transaction_type: 'Receiving',
    reference_no: 'RR-1',
    partner: 'Supplier One',
    warehouse_id: 'WH1',
    qty_in: 10,
    qty_out: 0,
    status_indicator: '+' as const,
    unit_price: 120,
    processed_by: 'Processor A',
    notes: 'Received stock',
    created_at: '2026-05-21T08:00:00',
    balance: 10,
  },
  {
    id: '2',
    item_id: 'ITEM-1',
    date: '2026-05-22T09:00:00',
    transaction_type: 'Stock Adjustment',
    reference_no: 'ADJ-1',
    partner: 'Customer One',
    warehouse_id: 'WH1',
    qty_in: 0,
    qty_out: 3,
    status_indicator: '-' as const,
    unit_price: 999,
    processed_by: 'Processor B',
    notes: 'Adjustment out',
    created_at: '2026-05-22T09:00:00',
    balance: 7,
  },
];

describe('StockMovementView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('defaults selected product movement filtering to WH1', async () => {
    vi.mocked(searchStockMovementProducts).mockResolvedValue([product]);
    vi.mocked(fetchStockMovementLogs).mockResolvedValue({
      item: {},
      logs,
      meta: { page: 1, per_page: 1000, total: 2, total_pages: 1 },
    });

    render(<StockMovementView />);
    fireEvent.focus(screen.getByPlaceholderText(/search by part no/i));
    fireEvent.click(await screen.findByText('PN-100'));

    await waitFor(() => {
      expect(fetchStockMovementLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ item_id: 'ITEM-1', warehouse_id: 'WH1' })
      );
    });
  });

  it('renders legacy report split columns and places movement rows on the correct side', async () => {
    vi.mocked(searchStockMovementProducts).mockResolvedValue([product]);
    vi.mocked(fetchStockMovementLogs).mockResolvedValue({
      item: {},
      logs,
      meta: { page: 1, per_page: 1000, total: 2, total_pages: 1 },
    });

    render(<StockMovementView />);
    fireEvent.focus(screen.getByPlaceholderText(/search by part no/i));
    fireEvent.click(await screen.findByText('PN-100'));
    fireEvent.click(await screen.findByRole('button', { name: /legacy report/i }));

    expect(screen.getAllByText('RECEIVED / RETURNED')[0]).toBeInTheDocument();
    expect(screen.getAllByText('RELEASED')[0]).toBeInTheDocument();
    expect(screen.getAllByText('RELEASED')[0].closest('th')).toHaveClass('border-l-4');
    expect(screen.getAllByText('Bal')[0].closest('th')).toHaveClass('border-l-4');

    const receivingRow = screen.getByTestId('legacy-stock-movement-row-1');
    expect(within(receivingRow).getByText('Processor A')).toBeInTheDocument();
    expect(within(receivingRow).getByText('Supplier One')).toBeInTheDocument();
    expect(within(receivingRow).getAllByText('10')).toHaveLength(2);

    const releaseRow = screen.getByTestId('legacy-stock-movement-row-2');
    expect(within(releaseRow).getByText('Processor B')).toBeInTheDocument();
    expect(within(releaseRow).getByText('Customer One')).toBeInTheDocument();
    expect(within(releaseRow).getByText('3')).toBeInTheDocument();
    expect(within(releaseRow).getByText('0.00')).toBeInTheDocument();
    expect(within(releaseRow).getByText('7')).toBeInTheDocument();
  });

  it('prints an old-system-style stock movement layout', async () => {
    const printMock = vi.fn();
    vi.stubGlobal('print', printMock);
    vi.mocked(searchStockMovementProducts).mockResolvedValue([product]);
    vi.mocked(fetchStockMovementLogs).mockResolvedValue({
      item: {},
      logs,
      meta: { page: 1, per_page: 1000, total: 2, total_pages: 1 },
    });

    render(<StockMovementView />);
    fireEvent.focus(screen.getByPlaceholderText(/search by part no/i));
    fireEvent.click(await screen.findByText('PN-100'));
    fireEvent.click(await screen.findByRole('button', { name: /print/i }));

    expect(printMock).toHaveBeenCalledTimes(1);

    const printArea = screen.getByTestId('stock-movement-print-area');
    expect(within(printArea).getByText('STOCK MOVEMENT')).toBeInTheDocument();
    expect(within(printArea).getByText('Warehouse:')).toBeInTheDocument();
    expect(within(printArea).getAllByText('WH1').length).toBeGreaterThan(0);
    expect(within(printArea).getByText('Item Code: IC-100')).toBeInTheDocument();
    expect(within(printArea).getByText('Part No: PN-100')).toBeInTheDocument();
    expect(within(printArea).getByText('Brand: ACME')).toBeInTheDocument();
    expect(within(printArea).getByText('Description: Brake pad')).toBeInTheDocument();
    expect(within(printArea).getByText('RECEIVED / RETURNED')).toBeInTheDocument();
    expect(within(printArea).getByText('RELEASED')).toBeInTheDocument();
    expect(within(printArea).getByText('0.00')).toBeInTheDocument();
  });
});
