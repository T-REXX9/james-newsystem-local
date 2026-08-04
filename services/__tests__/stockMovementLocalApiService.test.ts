import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../productLocalApiService', () => ({
  fetchProductsPage: vi.fn(),
}));

import { fetchProductsPage } from '../productLocalApiService';
import { searchStockMovementProducts } from '../stockMovementLocalApiService';

describe('stockMovementLocalApiService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fetchProductsPage).mockResolvedValue({
      items: [],
      meta: { page: 1, per_page: 50, total: 0, total_pages: 1 },
    });
  });

  it('excludes hidden products from Stock Movement search choices', async () => {
    await searchStockMovementProducts({
      part_no: 'PN-1',
      item_code: 'ITEM-1',
      description: 'brake',
      application: 'truck',
      original_pn: 'OEM-1',
    });

    expect(fetchProductsPage).toHaveBeenCalledWith(expect.objectContaining({
      status: 'active',
      partNo: 'PN-1',
      itemCode: 'ITEM-1',
      description: 'brake',
      application: 'truck',
      originalPn: 'OEM-1',
    }));
  });
});
