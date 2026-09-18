import { describe, expect, it } from 'vitest';
import { endForPeriod, startForPeriod } from '../SalesReportFilter';

describe('SalesReportFilter startForPeriod', () => {
  const today = new Date(2026, 8, 9); // Sep 9, 2026 local

  it('This Week starts one week before today like the old system', () => {
    expect(startForPeriod('week', today)).toBe('2026-09-02');
  });

  it('This Month starts on the first day of the current calendar month', () => {
    expect(startForPeriod('month', today)).toBe('2026-09-01');
  });

  it('This Month ends on the final day of the current calendar month', () => {
    expect(endForPeriod('month', today)).toBe('2026-09-30');
  });

  it('This Year starts one year before today like the old system', () => {
    expect(startForPeriod('year', today)).toBe('2025-09-09');
  });

  it('Today starts on today', () => {
    expect(startForPeriod('today', today)).toBe('2026-09-09');
  });
});
