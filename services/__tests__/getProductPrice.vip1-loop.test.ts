import { describe, expect, it } from 'vitest';
import { getProductPrice } from '../productLocalApiService';
import { normalizeToWritablePriceCode } from '../../constants/pricingGroups';
import type { Product } from '../../types';

/**
 * Price codes are only vip1 / vip2 / vip3.
 *   vip1 → price_vip1 ("VIP 1"), fallback price_aa
 *   vip2 → price_vip2 ("VIP2"), fallback price_aa
 *   vip3 → price_vip3 ("VIP3"); no AA fallback (empty until set)
 *
 * Sales Inquiry prices via:
 *   getProductPrice(product, normalizeToWritablePriceCode(priceGroup))
 */
const product = {
  price_aa: 100,
  price_bb: 90,
  price_cc: 80,
  price_dd: 70,
  price_vip1: 200,
  price_vip2: 300,
  price_vip3: 400,
} as Product;

const emptyVipProduct = {
  ...product,
  price_vip1: 0,
  price_vip2: 0,
  price_vip3: 0,
} as Product;

const salesInquiryUnitPrice = (customerPriceCode: string): number =>
  getProductPrice(product, normalizeToWritablePriceCode(customerPriceCode));

describe('getProductPrice vip1/vip2/vip3 + AA fallback', () => {
  it.each(['vip 1', 'vip1', 'VIP1', 'VIP 1', 'silver'])(
    'price code %s uses DB VIP 1 (price_vip1)',
    (priceCode) => {
      expect(getProductPrice(product, priceCode)).toBe(200);
      expect(salesInquiryUnitPrice(priceCode)).toBe(200);
    }
  );

  it.each(['vip 2', 'vip2', 'VIP2', 'VIP 2', 'gold'])(
    'price code %s uses DB VIP 2 (price_vip2)',
    (priceCode) => {
      expect(getProductPrice(product, priceCode)).toBe(300);
      expect(salesInquiryUnitPrice(priceCode)).toBe(300);
    }
  );

  it.each(['vip 3', 'vip3', 'VIP3', 'VIP 3', 'platinum'])(
    'price code %s uses DB VIP3 (price_vip3)',
    (priceCode) => {
      expect(getProductPrice(product, priceCode)).toBe(400);
      expect(salesInquiryUnitPrice(priceCode)).toBe(400);
    }
  );

  it.each(['aaa', 'aa', 'regular'])(
    'legacy %s customer code maps to vip3 and reads VIP3 (not AA)',
    (priceCode) => {
      expect(getProductPrice(product, priceCode)).toBe(400);
      expect(getProductPrice(product, priceCode)).not.toBe(product.price_aa);
    }
  );

  it('falls back to AA when vip1 is empty', () => {
    expect(getProductPrice(emptyVipProduct, 'vip 1')).toBe(100);
    expect(getProductPrice(emptyVipProduct, 'silver')).toBe(100);
  });

  it('falls back to AA when vip2 is empty', () => {
    expect(getProductPrice(emptyVipProduct, 'vip 2')).toBe(100);
    expect(getProductPrice(emptyVipProduct, 'gold')).toBe(100);
  });

  it('does not fall back to AA when vip3 is empty', () => {
    expect(getProductPrice(emptyVipProduct, 'vip 3')).toBe(0);
    expect(getProductPrice(emptyVipProduct, 'vip 3')).not.toBe(product.price_aa);
  });

  it('does not fall back when vip column is positive', () => {
    expect(getProductPrice(product, 'vip 1')).not.toBe(product.price_aa);
    expect(getProductPrice(product, 'vip 2')).not.toBe(product.price_aa);
  });

  it('returns AA when price group is missing (base / unset selection)', () => {
    expect(getProductPrice(product, undefined)).toBe(100);
    expect(getProductPrice(product, '')).toBe(100);
    expect(getProductPrice(product, '   ')).toBe(100);
  });

  it('returns 0 when product is missing', () => {
    expect(getProductPrice(null as unknown as Product, 'vip 1')).toBe(0);
  });

  it('SI writable normalization never changes the resolved column vs raw code', () => {
    for (const raw of ['vip1', 'VIP 2', 'VIP3', 'silver', 'gold', 'regular', 'vip 3']) {
      expect(getProductPrice(product, normalizeToWritablePriceCode(raw))).toBe(
        getProductPrice(product, raw)
      );
    }
  });
});
