import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({
    userProfile: {
      id: '42',
      main_userid: 1,
    },
    context: {
      user: {
        id: '42',
        main_userid: 1,
      },
      main_userid: 1,
    },
  }),
}));

import {
  createStockAdjustment,
  finalizeAdjustment,
  getAllStockAdjustments,
  getStockAdjustment,
} from '../stockAdjustmentService';

describe('stockAdjustmentService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists stock adjustments from the local API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          items: [
            {
              id: 'ref-1',
              adjustment_no: 'SA26-0001',
              adjustment_date: '2026-03-07',
              warehouse_id: 'WH1',
              adjustment_type: 'physical_count',
              notes: 'Cycle count',
              status: 'draft',
              created_at: '2026-03-07 09:00:00',
              updated_at: '2026-03-07 09:00:00',
            },
          ],
        },
      }),
    } as Response);

    const result = await getAllStockAdjustments();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/stock-adjustments?main_id=1');
    expect(result).toEqual([
      expect.objectContaining({
        id: 'ref-1',
        adjustment_no: 'SA26-0001',
        status: 'draft',
      }),
    ]);
  });

  it('loads a single stock adjustment with items from the local API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'ref-9',
          adjustment_no: 'SA26-0009',
          adjustment_date: '2026-03-07',
          warehouse_id: 'WH2',
          adjustment_type: 'damage',
          status: 'draft',
          created_at: '2026-03-07 10:00:00',
          updated_at: '2026-03-07 10:00:00',
          items: [
            {
              id: 'item-row-1',
              adjustment_id: 'ref-9',
              item_id: 'prod-1',
              system_qty: 9,
              physical_qty: 7,
              difference: -2,
              reason: 'Damaged',
              location: 'Rack A',
            },
          ],
        },
      }),
    } as Response);

    const result = await getStockAdjustment('ref-9');

    expect(result).toEqual(expect.objectContaining({
      id: 'ref-9',
      warehouse_id: 'WH2',
      items: [
        expect.objectContaining({
          item_id: 'prod-1',
          difference: -2,
          location: 'Rack A',
        }),
      ],
    }));
  });

  it('creates a stock adjustment through the local API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'ref-11',
          adjustment_no: 'SA26-0011',
          adjustment_date: '2026-03-07',
          warehouse_id: 'WH1',
          adjustment_type: 'correction',
          status: 'draft',
          created_at: '2026-03-07 11:00:00',
          updated_at: '2026-03-07 11:00:00',
          items: [],
        },
      }),
    } as Response);

    const result = await createStockAdjustment({
      adjustment_no: 'manual-value',
      adjustment_date: '2026-03-07',
      warehouse_id: 'WH1',
      adjustment_type: 'correction',
      notes: 'Fix counts',
      items: [
        {
          item_id: 'prod-1',
          system_qty: 3,
          physical_qty: 5,
          reason: 'Recount',
        },
      ],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toMatchObject({
      main_id: 1,
      user_id: '42',
      warehouse_id: 'WH1',
      notes: 'Fix counts',
    });
    expect(result).toEqual(expect.objectContaining({
      id: 'ref-11',
      adjustment_no: 'SA26-0011',
    }));
  });

  it('finalizes a stock adjustment through the local API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'ref-11',
          adjustment_no: 'SA26-0011',
          adjustment_date: '2026-03-07',
          warehouse_id: 'WH1',
          adjustment_type: 'physical_count',
          status: 'finalized',
          created_at: '2026-03-07 11:00:00',
          updated_at: '2026-03-07 12:00:00',
          items: [],
        },
      }),
    } as Response);

    const result = await finalizeAdjustment('ref-11');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/stock-adjustments/ref-11/finalize');
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      main_id: 1,
      user_id: '42',
    });
    expect(result).toEqual(expect.objectContaining({
      id: 'ref-11',
      status: 'finalized',
    }));
  });
});
