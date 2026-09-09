import { describe, expect, it } from 'vitest';
import { startForPeriod } from '../SalesReportFilter';

describe('SalesReportFilter startForPeriod', () => {
  const today = new Date(2026, 8, 9); // Sep 9, 2026 local

  it('This Week is the last 7 calendar days inclusive (today and 6 days before)', () => {
    expect(startForPeriod('week', today)).toBe('2026-09-03');
  });

  it('This Month starts on the first day of the current calendar month', () => {
    expect(startForPeriod('month', today)).toBe('2026-09-01');
  });

  it('This Year starts on January 1 of the current calendar year', () => {
    expect(startForPeriod('year', today)).toBe('2026-01-01');
  });

  it('Today starts on today', () => {
    expect(startForPeriod('today', today)).toBe('2026-09-09');
  });
});
