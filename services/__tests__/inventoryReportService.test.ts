import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchInventoryReport } from '../inventoryReportService';

describe('inventoryReportService pricing mapping', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the explicit Product Database VIP 1 field instead of the legacy cost alias', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          items: [{
            id: 'item-1',
            part_no: 'PN-001',
            item_code: 'IT-001',
            description: 'NOZZLE',
            vip1_price: 18,
            cost: 0,
            total_stock: 2,
            value: 36,
          }],
          warehouses: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchInventoryReport({ reportType: 'inventory' });

    expect(result.rows[0]?.vip1Price).toBe(18);
    expect(result.rows[0]?.value).toBe(36);
  });

  it('maps last_rr_qty from the same last Receiving as last_rr_date', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          items: [{
            id: 'item-1',
            last_rr_date: '2026-08-12 09:15:00',
            last_rr_qty: 3,
          }],
          warehouses: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchInventoryReport({ reportType: 'inventory' });

    expect(result.rows[0]?.lastRrDate).toBe('2026-08-12 09:15:00');
    expect(result.rows[0]?.lastRrQty).toBe(3);
  });
});
