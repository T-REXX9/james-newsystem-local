import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchInventoryLogs, createInventoryLogFromPO, createInventoryLogFromInvoice, createInventoryLogFromOrderSlip, createInventoryLogFromStockAdjustment, createInventoryLogFromReturn } from '../inventoryLogService';

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('inventoryLogService local API migration', () => {
  it('loads stock movements for the selected product from all pages', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const page = new URL(url, 'http://localhost').searchParams.get('page');
      return new Response(JSON.stringify({ ok: true, data: { logs: [{ id: page, item_id: 'p1', qty_in: 2, qty_out: 0 }], meta: { total_pages: 2 } } }));
    });
    const logs = await fetchInventoryLogs({ item_id: 'p1', warehouse_id: 'WH1' });
    expect(logs.map(log => log.id)).toEqual(['1', '2']);
    expect(fetchMock.mock.calls[0][0]).toContain('/stock-movements?');
    expect(fetchMock.mock.calls[0][0]).toContain('warehouse_id=WH1');
  });
  it('requires a product instead of querying an unbounded retired table', async () => {
    await expect(fetchInventoryLogs()).rejects.toThrow('Select a product');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([createInventoryLogFromPO, createInventoryLogFromInvoice, createInventoryLogFromOrderSlip, createInventoryLogFromStockAdjustment, createInventoryLogFromReturn])('prevents duplicate client-side stock posting: %s', async post => {
    await expect(post('document-1', 'user-1')).rejects.toThrow('Inventory is posted by the local API');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
