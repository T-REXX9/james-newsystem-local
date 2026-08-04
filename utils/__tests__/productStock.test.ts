import { describe, expect, it } from 'vitest';
import { getCentralStock } from '../productStock';

const legacyStock = {
  stock_wh1: 2,
  stock_wh2: 3,
  stock_wh3: 5,
  stock_wh4: 7,
  stock_wh5: 11,
  stock_wh6: 13,
};

describe('getCentralStock', () => {
  it('uses the centralized API quantity when available', () => {
    expect(getCentralStock({ ...legacyStock, total_stock: 99 })).toBe(99);
  });

  it('falls back to the complete legacy sum while old records are migrated', () => {
    expect(getCentralStock(legacyStock)).toBe(41);
  });
});
