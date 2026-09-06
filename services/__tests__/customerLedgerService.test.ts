import { afterEach, describe, expect, it, vi } from 'vitest';
import { customerLedgerService } from '../customerLedgerService';

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
});
