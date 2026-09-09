import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildYearlySales, customerLedgerService, ledgerRowsToContactTransactions } from '../customerLedgerService';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({ token: 'test-token', context: { user: { main_id: 1 } } }),
}));

const okResponse = (data: unknown) => ({
  ok: true,
  json: () => Promise.resolve({ ok: true, data }),
} as Response);

describe('customerLedgerService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps current-month Ishinomoto sales separately from all sales', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({
      customer: { session_id: 'cust-1', company: 'Acme', customer_code: 'C-1' },
      report_type: 'summary',
      date_type: 'all',
      metrics: {
        dealership_sales: 125000,
        ishinomoto_sales: 42000,
        monthly_sales: 50000,
      },
      rows: [],
      summary_rows: [],
      totals: {},
    }));

    const ledger = await customerLedgerService.getLedger('cust-1', { reportType: 'summary', dateType: 'all' });

    expect(ledger.metrics.dealership_sales).toBe(125000);
    expect(ledger.metrics.ishinomoto_sales).toBe(42000);
  });

  it('falls back to all sales when older APIs do not return Ishinomoto sales', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({
      customer: { session_id: 'cust-1', company: 'Acme', customer_code: 'C-1' },
      report_type: 'summary',
      date_type: 'all',
      metrics: {
        dealership_sales: 125000,
        monthly_sales: 50000,
      },
      rows: [],
      summary_rows: [],
      totals: {},
    }));

    const ledger = await customerLedgerService.getLedger('cust-1', { reportType: 'summary', dateType: 'all' });

    expect(ledger.metrics.ishinomoto_sales).toBe(125000);
  });

  it('maps each ledger sales posting once using its ledger amount', () => {
    const transactions = ledgerRowsToContactTransactions([
      {
        id: 10,
        date: '2026-09-09',
        reference: 'INV-100',
        ref_no: 'ledger-ref-100',
        ref_type: 'Invoice',
        debit: 1500,
        credit: 0,
      },
    ]);

    expect(transactions).toEqual([
      expect.objectContaining({
        id: 'ledger-ref-100:10',
        type: 'invoice',
        number: 'INV-100',
        amount: 1500,
        status: 'finalized',
      }),
    ]);
  });

  it('aggregates ledger sales by calendar year and month', () => {
    const years = buildYearlySales([
      { id: 1, date: '2024-12-31', datetime: '2024-12-31T10:00:00', ref_no: 'a', reference: 'A', ref_type: 'Invoice', debit: 100, credit: 0, pdc: 0, balance: 0, check_no: '', check_date: null, dcr: '', remarks: '', promise_to_pay: '' },
      { id: 2, date: '2024-12-31', datetime: '2024-12-31T11:00:00', ref_no: 'b', reference: 'B', ref_type: 'Order Slip', debit: 250, credit: 0, pdc: 0, balance: 0, check_no: '', check_date: null, dcr: '', remarks: '', promise_to_pay: '' },
      { id: 3, date: '2025-01-01', datetime: '2025-01-01T10:00:00', ref_no: 'c', reference: 'C', ref_type: 'Invoice', debit: 400, credit: 0, pdc: 0, balance: 0, check_no: '', check_date: null, dcr: '', remarks: '', promise_to_pay: '' },
      { id: 4, date: '2025-06-15', datetime: '2025-06-15T10:00:00', ref_no: 'd', reference: 'D', ref_type: 'Collection', debit: 999, credit: 0, pdc: 0, balance: 0, check_no: '', check_date: null, dcr: '', remarks: '', promise_to_pay: '' },
      { id: 5, date: '2025-07-15', datetime: '2025-07-15T10:00:00', ref_no: 'e', reference: 'E', ref_type: 'Invoice', debit: 50, credit: 10, pdc: 0, balance: 0, check_no: '', check_date: null, dcr: '', remarks: '', promise_to_pay: '' },
      { id: 6, date: '2025-12-01', datetime: '2025-12-01T10:00:00', ref_no: 'f', reference: 'F', ref_type: 'Invoice', debit: 700, credit: 0, pdc: 0, balance: 0, check_no: '', check_date: null, dcr: '', remarks: '', promise_to_pay: '' },
    ], new Date('2025-08-01T12:00:00'));

    expect(years).toEqual([
      { year: 2025, total: 450, months: [{ month: 1, label: 'January', total: 400 }, { month: 7, label: 'July', total: 50 }] },
      { year: 2024, total: 350, months: [{ month: 12, label: 'December', total: 350 }] },
    ]);
  });
});
