import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inquiryReportLocalApiService } from '../inquiryReportLocalApiService';

describe('inquiryReportLocalApiService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          items: [
            { id: '1', converted_to_order: true },
            { id: '2', converted_to_order: 0 },
            { id: '3' },
          ],
        },
      }),
    } as Response));
  });

  it('normalizes the conversion flag to a boolean for every row', async () => {
    const report = await inquiryReportLocalApiService.getReport({ mode: 'summary', dateType: 'today' });

    expect(report.items.map((row) => row.converted_to_order)).toEqual([true, false, false]);
  });
});
