import type { Product } from '../types';

/**
 * One inventory quantity per item code. Legacy warehouse fields remain in the
 * API temporarily so old documents can still be read during migration.
 */
export const getCentralStock = (product: Pick<Product,
  'total_stock' | 'stock_wh1' | 'stock_wh2' | 'stock_wh3' | 'stock_wh4' | 'stock_wh5' | 'stock_wh6'
>): number => {
  if (product.total_stock !== undefined && product.total_stock !== null) {
    return Number(product.total_stock) || 0;
  }

  return Number(product.stock_wh1 || 0)
    + Number(product.stock_wh2 || 0)
    + Number(product.stock_wh3 || 0)
    + Number(product.stock_wh4 || 0)
    + Number(product.stock_wh5 || 0)
    + Number(product.stock_wh6 || 0);
};
