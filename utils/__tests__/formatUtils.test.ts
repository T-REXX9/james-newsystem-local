import { describe, expect, it } from 'vitest';
import { formatAccountingTime, formatAccountingTimestamp, formatDate, matchesSearch } from '../formatUtils';

describe('formatDate', () => {
  it('keeps migrated date-only values on their business calendar day', () => {
    expect(formatDate('2026-09-12')).toBe('SEP‑12‑26');
  });

  it('formats UTC timestamps in Philippine time', () => {
    expect(formatDate('2026-09-12T16:00:00Z')).toBe('SEP‑13‑26');
  });
});

describe('formatAccountingTime', () => {
  it('shows a Philippine-localized time without repeating its date', () => {
    expect(formatAccountingTime('2026-07-15 10:30:00')).toBe('10:30:00 AM');
  });

  it('keeps missing legacy timestamps explicit', () => {
    expect(formatAccountingTime(null)).toBe('Unavailable');
  });
});

describe('formatAccountingTimestamp', () => {
  it('shows only the Philippine-localized clock time with seconds and meridiem', () => {
    expect(formatAccountingTimestamp('2026-10-06 13:05:09')).toBe('01:05:09 PM');
  });

  it('does not invent a time for a date-only value', () => {
    expect(formatAccountingTimestamp('2026-10-06')).toBe('Unavailable');
  });
});

describe('matchesSearch', () => {
  it('finds a customer or prospect by assigned sales agent', () => {
    expect(matchesSearch({ company: 'Northside Diesel', salesman: 'Irene Santos' }, 'irene')).toBe(true);
    expect(matchesSearch({ company: 'Northside Diesel', salesman: 'Irene Santos' }, 'other agent')).toBe(false);
  });
});
