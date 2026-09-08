import type { PurchaseHistoryRow } from '../services/purchaseHistoryReportService';

export type DateSubtotal = { sold: number; returned: number };

export const buildDateSubtotals = (rows: Array<Pick<PurchaseHistoryRow, 'ldate' | 'lqty' | 'lprice' | 'return_qty'>>): Record<string, DateSubtotal> => {
  const subtotals: Record<string, DateSubtotal> = {};

  for (const row of rows) {
    const dateKey = row.ldate;
    const subtotal = subtotals[dateKey] || { sold: 0, returned: 0 };
    subtotal.sold += (row.lqty || 0) * (row.lprice || 0);
    subtotal.returned += (row.return_qty || 0) * (row.lprice || 0);
    subtotals[dateKey] = subtotal;
  }

  return subtotals;
};
