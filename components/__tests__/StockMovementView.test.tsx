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
  reorder_quantity: 8,
  status: 'Active' as const,
  category: '',
  descriptive_inquiry: '',
  no_of_holes: '',
  replenish_quantity: 0,
  original_pn_no: '',
  application: 'ISUZU 4JA1 / 4JB1',
  no_of_cylinder: '',
  price_aa: 0,
  price_bb: 0,
  price_cc: 0,
  price_dd: 0,
  price_vip1: 0,
  price_vip2: 0,
  price_baa: 10,
  price_bbb: 20,
  price_bcc: 30,
  price_bdd: 40,
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

  it('starts with a blank legacy search grid until Search is submitted', async () => {
    vi.mocked(searchStockMovementProducts).mockResolvedValue([product]);

    render(<StockMovementView />);

    expect(screen.queryByText('PN-100')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Part No.' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Item Code' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Description' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total Stock' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveClass('stock-product-grid');

    await new Promise(resolve => window.setTimeout(resolve, 300));
    expect(searchStockMovementProducts).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    expect(await screen.findByText('PN-100')).toBeInTheDocument();
  });

  it('defaults selected product movement filtering to WH1', async () => {
    vi.mocked(searchStockMovementProducts).mockResolvedValue([product]);
    vi.mocked(fetchStockMovementLogs).mockResolvedValue({
      item: {},
      logs,
      meta: { page: 1, per_page: 1000, total: 2, total_pages: 1 },
    });

    render(<StockMovementView />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    fireEvent.click(await screen.findByText('PN-100'));
    fireEvent.click(screen.getByRole('button', { name: /view movement/i }));

    expect(screen.queryByPlaceholderText('Search Part No.')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search Item Code')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetchStockMovementLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ item_id: 'ITEM-1', warehouse_id: 'WH1' })
      );
    });
  });

  it('uses old-system separate search fields before viewing movement', async () => {
    const secondProduct = {
      ...product,
      id: 'ITEM-2',
      part_no: 'PN-200',
      item_code: 'IC-200',
      description: 'Clutch disc',
      application: 'MITSUBISHI 4D56',
      original_pn_no: 'OPN-200',
    };

    vi.mocked(searchStockMovementProducts).mockResolvedValue([product, secondProduct]);
    vi.mocked(fetchStockMovementLogs).mockResolvedValue({
      item: {},
      logs,
      meta: { page: 1, per_page: 1000, total: 2, total_pages: 1 },
    });

    render(<StockMovementView />);

    expect(screen.getByPlaceholderText('Search Part No.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search Item Code')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search Item Description')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search Item Application')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search Original P/N')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search Part No.'), { target: { value: 'PN-100' } });
    fireEvent.change(screen.getByPlaceholderText('Search Item Application'), { target: { value: '4JA1' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      expect(searchStockMovementProducts).toHaveBeenLastCalledWith({
        part_no: 'PN-100',
        item_code: '',
        description: '',
        application: '4JA1',
        original_pn: '',
      }, 100);
      expect(screen.getByText('PN-100')).toBeInTheDocument();
      expect(screen.queryByText('PN-200')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /view movement/i })).toBeDisabled();

    fireEvent.click(await screen.findByText('PN-100'));
    expect(screen.getByRole('button', { name: /view movement/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /view movement/i }));

    await waitFor(() => {
      expect(fetchStockMovementLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ item_id: 'ITEM-1', warehouse_id: 'WH1' })
      );
    });
  });

  it('smart-searches from each separate field as the user types', async () => {
    vi.mocked(searchStockMovementProducts).mockResolvedValue([product]);

    render(<StockMovementView />);

    fireEvent.change(screen.getByPlaceholderText('Search Item Code'), { target: { value: 'IC-100' } });

    await waitFor(() => {
      expect(searchStockMovementProducts).toHaveBeenLastCalledWith({
        part_no: '',
        item_code: 'IC-100',
        description: '',
        application: '',
        original_pn: '',
      }, 100);
      expect(screen.getByText('PN-100')).toBeInTheDocument();
    });
  });

  it('renders current pricing tiers and one consolidated stock total per product', async () => {
    vi.mocked(searchStockMovementProducts).mockResolvedValue([{
      ...product,
      price_aa: 100,
      price_vip1: 90,
      price_vip2: 80,
      stock_wh1: 1,
      stock_wh2: 2,
      stock_wh3: 3,
      stock_wh4: 4,
      stock_wh5: 5,
      stock_wh6: 6,
    }]);

    render(<StockMovementView />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    const row = await screen.findByTestId('stock-product-row-ITEM-1');
    expect(screen.getByRole('columnheader', { name: 'Regular' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Silver' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Gold' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total Stock' })).toBeInTheDocument();
    expect(within(row).getByText('100.00')).toBeInTheDocument();
    expect(within(row).getByText('90.00')).toBeInTheDocument();
    expect(within(row).getByText('80.00')).toBeInTheDocument();
    expect(within(row).getByText('21')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'AA' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'WH1' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('stock-product-row-ITEM-1-B')).not.toBeInTheDocument();
  });

  it('renders legacy report split columns and places movement rows on the correct side', async () => {
    vi.mocked(searchStockMovementProducts).mockResolvedValue([product]);
    vi.mocked(fetchStockMovementLogs).mockResolvedValue({
      item: {},
      logs,
      meta: { page: 1, per_page: 1000, total: 2, total_pages: 1 },
    });

    render(<StockMovementView />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    fireEvent.click(await screen.findByText('PN-100'));
    fireEvent.click(screen.getByRole('button', { name: /view movement/i }));
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
    const focusMock = vi.fn();
    const printMock = vi.fn();
    vi.stubGlobal('focus', focusMock);
    vi.stubGlobal('print', printMock);
    vi.mocked(searchStockMovementProducts).mockResolvedValue([product]);
    vi.mocked(fetchStockMovementLogs).mockResolvedValue({
      item: {},
      logs,
      meta: { page: 1, per_page: 1000, total: 2, total_pages: 1 },
    });

    render(<StockMovementView />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    fireEvent.click(await screen.findByText('PN-100'));
    fireEvent.click(screen.getByRole('button', { name: /view movement/i }));
    fireEvent.click(await screen.findByRole('button', { name: /print/i }));

    expect(focusMock).toHaveBeenCalledTimes(1);
    expect(printMock).toHaveBeenCalledTimes(1);

    const printArea = screen.getByTestId('stock-movement-print-area');
    expect(within(printArea).getByText('STOCK MOVEMENT')).toBeInTheDocument();
    expect(within(printArea).getByText('Warehouse:')).toBeInTheDocument();
    expect(within(printArea).getAllByText('WH1').length).toBeGreaterThan(0);
    expect(within(printArea).getByText('Item Code: IC-100')).toBeInTheDocument();
    expect(within(printArea).getByText('Part No: PN-100')).toBeInTheDocument();
    expect(within(printArea).getByText('Brand: ACME')).toBeInTheDocument();
    expect(within(printArea).getByText('Description: Brake pad')).toBeInTheDocument();
    expect(within(printArea).getByText('Application: ISUZU 4JA1 / 4JB1')).toBeInTheDocument();
    expect(within(printArea).getByText('Reorder Qty: 8')).toBeInTheDocument();
    expect(within(printArea).getByText('RECEIVED / RETURNED')).toBeInTheDocument();
    expect(within(printArea).getByText('RELEASED')).toBeInTheDocument();
    expect(within(printArea).getByText('0.00')).toBeInTheDocument();
  });

  it('shows application details and reorder quantity for the selected product', async () => {
    vi.mocked(searchStockMovementProducts).mockResolvedValue([product]);
    vi.mocked(fetchStockMovementLogs).mockResolvedValue({
      item: {},
      logs,
      meta: { page: 1, per_page: 1000, total: 2, total_pages: 1 },
    });

    render(<StockMovementView />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    const option = await screen.findByText('PN-100');
    expect(screen.getByText('ISUZU 4JA1 / 4JB1')).toBeInTheDocument();
    expect(screen.getByText('Reorder Qty')).toBeInTheDocument();

    fireEvent.click(option);
    fireEvent.click(screen.getByRole('button', { name: /view movement/i }));

    await waitFor(() => {
      const printArea = screen.getByTestId('stock-movement-print-area');
      expect(within(printArea).getByText('Application: ISUZU 4JA1 / 4JB1')).toBeInTheDocument();
      expect(within(printArea).getByText('Reorder Qty: 8')).toBeInTheDocument();
    });
  });
});
