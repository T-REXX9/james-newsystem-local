import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StockAdjustmentView from '../StockAdjustmentView';

vi.mock('../StatusBadge', () => ({
  default: ({ status }: { status: string }) => <div>{status}</div>,
}));

vi.mock('../WorkflowStepper', () => ({
  default: ({ currentStage }: { currentStage: string }) => <div>{currentStage}</div>,
}));

vi.mock('../../services/productLocalApiService', () => ({
  fetchProducts: vi.fn(),
}));

vi.mock('../../services/stockAdjustmentService', () => ({
  createStockAdjustment: vi.fn(),
  finalizeAdjustment: vi.fn(),
  getAllStockAdjustments: vi.fn(),
  getStockAdjustment: vi.fn(),
}));

import { fetchProducts } from '../../services/productLocalApiService';
import {
  finalizeAdjustment,
  getAllStockAdjustments,
  getStockAdjustment,
} from '../../services/stockAdjustmentService';

const fetchProductsMock = vi.mocked(fetchProducts);
const getAllStockAdjustmentsMock = vi.mocked(getAllStockAdjustments);
const getStockAdjustmentMock = vi.mocked(getStockAdjustment);
const finalizeAdjustmentMock = vi.mocked(finalizeAdjustment);

describe('StockAdjustmentView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    fetchProductsMock.mockResolvedValue([
      {
        id: 'prod-1',
        part_no: 'P-100',
        oem_no: '',
        brand: 'TND',
        barcode: '',
        no_of_pieces_per_box: 0,
        item_code: 'ITEM-100',
        description: 'Brake Pad',
        size: '',
        reorder_quantity: 0,
        status: 'Active',
        category: '',
        descriptive_inquiry: '',
        no_of_holes: '',
        replenish_quantity: 0,
        original_pn_no: '',
        application: '',
        no_of_cylinder: '',
        cost: 10,
        price_aa: 0,
        price_bb: 0,
        price_cc: 0,
        price_dd: 0,
        price_vip1: 0,
        price_vip2: 0,
        stock_wh1: 5,
        stock_wh2: 0,
        stock_wh3: 0,
        stock_wh4: 0,
        stock_wh5: 0,
        stock_wh6: 0,
        is_deleted: false,
      },
    ] as any);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads stock adjustment headers and renders selected adjustment details', async () => {
    getAllStockAdjustmentsMock.mockResolvedValue([
      {
        id: 'ref-1',
        adjustment_no: 'SA26-0001',
        adjustment_date: '2026-03-07',
        warehouse_id: 'WH1',
        adjustment_type: 'physical_count',
        status: 'draft',
        created_at: '2026-03-07 09:00:00',
        updated_at: '2026-03-07 09:00:00',
        items: [],
      },
    ] as any);

    getStockAdjustmentMock.mockResolvedValue({
      id: 'ref-1',
      adjustment_no: 'SA26-0001',
      adjustment_date: '2026-03-07',
      warehouse_id: 'WH1',
      adjustment_type: 'physical_count',
      notes: 'Cycle count',
      status: 'draft',
      created_at: '2026-03-07 09:00:00',
      updated_at: '2026-03-07 09:00:00',
      items: [
        {
          id: 'row-1',
          adjustment_id: 'ref-1',
          item_id: 'prod-1',
          system_qty: 5,
          physical_qty: 7,
          difference: 2,
          reason: 'Found two extras',
        },
      ],
    } as any);

    render(<StockAdjustmentView />);

    expect((await screen.findAllByText('SA26-0001')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Cycle count')).toBeInTheDocument();
    expect(await screen.findByText('Brake Pad')).toBeInTheDocument();
    expect(screen.getByText('Found two extras')).toBeInTheDocument();
  });

  it('finalizes a draft adjustment and refreshes the list', async () => {
    const user = userEvent.setup();

    getAllStockAdjustmentsMock
      .mockResolvedValueOnce([
        {
          id: 'ref-2',
          adjustment_no: 'SA26-0002',
          adjustment_date: '2026-03-07',
          warehouse_id: 'WH1',
          adjustment_type: 'physical_count',
          status: 'draft',
          created_at: '2026-03-07 10:00:00',
          updated_at: '2026-03-07 10:00:00',
          items: [],
        },
      ] as any)
      .mockResolvedValueOnce([
        {
          id: 'ref-2',
          adjustment_no: 'SA26-0002',
          adjustment_date: '2026-03-07',
          warehouse_id: 'WH1',
          adjustment_type: 'physical_count',
          status: 'finalized',
          created_at: '2026-03-07 10:00:00',
          updated_at: '2026-03-07 11:00:00',
          items: [],
        },
      ] as any);

    getStockAdjustmentMock
      .mockResolvedValueOnce({
        id: 'ref-2',
        adjustment_no: 'SA26-0002',
        adjustment_date: '2026-03-07',
        warehouse_id: 'WH1',
        adjustment_type: 'physical_count',
        status: 'draft',
        created_at: '2026-03-07 10:00:00',
        updated_at: '2026-03-07 10:00:00',
        items: [
          {
            id: 'row-2',
            adjustment_id: 'ref-2',
            item_id: 'prod-1',
            system_qty: 5,
            physical_qty: 4,
            difference: -1,
            reason: 'One damaged piece',
          },
        ],
      } as any)
      .mockResolvedValue({
        id: 'ref-2',
        adjustment_no: 'SA26-0002',
        adjustment_date: '2026-03-07',
        warehouse_id: 'WH1',
        adjustment_type: 'physical_count',
        status: 'finalized',
        created_at: '2026-03-07 10:00:00',
        updated_at: '2026-03-07 11:00:00',
        items: [
          {
            id: 'row-2',
            adjustment_id: 'ref-2',
            item_id: 'prod-1',
            system_qty: 5,
            physical_qty: 4,
            difference: -1,
            reason: 'One damaged piece',
          },
        ],
      } as any);

    finalizeAdjustmentMock.mockResolvedValue({
      id: 'ref-2',
      adjustment_no: 'SA26-0002',
      adjustment_date: '2026-03-07',
      warehouse_id: 'WH1',
      adjustment_type: 'physical_count',
      status: 'finalized',
      created_at: '2026-03-07 10:00:00',
      updated_at: '2026-03-07 11:00:00',
      items: [],
    } as any);

    render(<StockAdjustmentView />);

    expect((await screen.findAllByText('SA26-0002')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Finalize Adjustment/i }));
    await user.click(screen.getByRole('button', { name: /^Finalize$/i }));

    await waitFor(() => expect(finalizeAdjustmentMock).toHaveBeenCalledWith('ref-2'));
    await waitFor(() => expect(getAllStockAdjustmentsMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Confirm Finalization')).not.toBeInTheDocument());
  });
});
