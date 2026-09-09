import { describe, expect, it } from 'vitest';
import { formatCustomerSince, formatDate, formatDateTime } from '../formatUtils';

describe('formatCustomerSince', () => {
  it('shows an abbreviated month, day without a leading zero, and year', () => {
    expect(formatCustomerSince('2026-09-09')).toBe('Sep 9 2026');
  });

  it('keeps empty Customer Since empty', () => {
    expect(formatCustomerSince('')).toBe('');
    expect(formatCustomerSince(null)).toBe('');
  });
});

describe('staff-facing date formatting', () => {
  it('formats timestamps in Manila time', () => {
    expect(formatDateTime('2026-09-08T16:30:00Z')).toBe('September 9, 2026 at 12:30 AM');
    expect(formatDate('2026-09-08T16:30:00Z')).toBe('September 9, 2026');
  });

  it('preserves date-only calendar values', () => {
    expect(formatDate('2026-09-09')).toBe('September 9, 2026');
    expect(formatCustomerSince('2026-09-09')).toBe('Sep 9 2026');
  });
});
